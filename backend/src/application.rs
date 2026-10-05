use crate::{
    domain::{self, id, n, now, s},
    error::{invalid, Error, Result},
    jobs, media, providers,
    secrets::Secrets,
    storage::{self, Repository},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub api_version: u32,
    pub request_id: String,
    pub project_id: Option<String>,
    pub expected_revision: Option<u64>,
    pub payload: Value,
}
struct Token {
    path: PathBuf,
    kind: String,
    expires: Instant,
}
pub struct State {
    pub repository: Option<Repository>,
    pub settings: Value,
    pub recent: Vec<Value>,
    tokens: HashMap<String, Token>,
    preflights: HashMap<String, (Value, Instant)>,
    pub secrets: Secrets,
}
pub struct Engine {
    pub root: PathBuf,
    pub state: Mutex<State>,
    pub job_mutex: Mutex<()>,
    _owner: fs::File,
}
impl Engine {
    pub fn new(root: PathBuf) -> Result<Arc<Self>> {
        fs::create_dir_all(&root)?;
        let owner = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(root.join(".owner.lock"))?;
        fs2::FileExt::try_lock_exclusive(&owner).map_err(|_| {
            Error::new(
                "PROJECT_LOCKED",
                "AI Video Studio đã chạy với thư mục dữ liệu này",
            )
        })?;
        for d in [
            "config",
            "database/merge-jobs",
            "projects",
            "exports",
            "backups",
            "logs",
        ] {
            fs::create_dir_all(root.join(d))?;
        }
        let config = root.join("config/settings.json");
        let settings = if config.exists() {
            storage::read(&config)?
        } else {
            json!({"theme":"dark","language":"vi","connections":[],"telemetry":false})
        };
        let mut recent = storage::read(&root.join("database/projects-index.json"))
            .ok()
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default();
        for e in fs::read_dir(root.join("projects"))?.take(1000) {
            let dir = e?.path();
            if let Ok(v) = storage::read(&dir.join("project.json")) {
                if domain::validate(&v).is_ok() && !recent.iter().any(|r| r["id"] == v["id"]) {
                    recent.push(json!({"id":v["id"],"title":v["title"],"path":dir,"updatedAt":v["updatedAt"]}));
                }
            }
        }
        jobs::recover(&root.join("database/merge-jobs"))?;
        for r in &recent {
            if let Some(p) = r["path"].as_str() {
                jobs::recover(&Path::new(p).join("jobs"))?;
            }
        }
        Ok(Arc::new(Self {
            root,
            state: Mutex::new(State {
                repository: None,
                settings,
                recent,
                tokens: HashMap::new(),
                preflights: HashMap::new(),
                secrets: Secrets::default(),
            }),
            job_mutex: Mutex::new(()),
            _owner: owner,
        }))
    }
    pub fn grant(&self, path: PathBuf, kind: &str) -> Result<Value> {
        let path = if kind == "save" {
            let parent = path
                .parent()
                .ok_or_else(|| invalid("Invalid destination"))?
                .canonicalize()?;
            parent.join(
                path.file_name()
                    .ok_or_else(|| invalid("Invalid filename"))?,
            )
        } else {
            path.canonicalize()?
        };
        let token = id();
        self.state.lock().unwrap().tokens.insert(
            token.clone(),
            Token {
                path: path.clone(),
                kind: kind.into(),
                expires: Instant::now() + Duration::from_secs(900),
            },
        );
        Ok(json!({"token":token,"name":path.file_name().unwrap_or_default().to_string_lossy()}))
    }
    fn token(st: &State, token: &str, kind: &str) -> Result<PathBuf> {
        let t = st
            .tokens
            .get(token)
            .ok_or_else(|| invalid("Chọn lại file/thư mục bằng hộp thoại"))?;
        if t.kind != kind || t.expires < Instant::now() {
            return Err(invalid("Quyền chọn file hết hạn; chọn lại"));
        }
        Ok(t.path.clone())
    }
    fn repo(st: &mut State) -> Result<&mut Repository> {
        st.repository
            .as_mut()
            .ok_or_else(|| invalid("Chưa mở dự án"))
    }
    fn remember(&self, st: &mut State) -> Result<()> {
        if let Some(repo) = &st.repository {
            st.recent.retain(|r| r["id"] != repo.snapshot["id"]);
            st.recent.insert(0,json!({"id":repo.snapshot["id"],"title":repo.snapshot["title"],"path":repo.dir,"updatedAt":repo.snapshot["updatedAt"]}));
        }
        storage::atomic(
            &self.root.join("database/projects-index.json"),
            &json!(st.recent),
        )
    }
    pub fn dispatch(&self, command: &str, r: Request) -> Value {
        let rid = r.request_id.clone();
        let result = self.handle(command, r);
        match result {
            Ok(data) => json!({"ok":true,"requestId":rid,"data":data}),
            Err(error) => json!({"ok":false,"requestId":rid,"error":error}),
        }
    }
    fn handle(&self, command: &str, r: Request) -> Result<Value> {
        if r.api_version != 1 || uuid::Uuid::parse_str(&r.request_id).is_err() {
            return Err(invalid("Invalid IPC version/request ID"));
        }
        crate::contracts::validate(command, &r.payload)?;
        let payload = r.payload;
        let request = &r.request_id;
        let expected = || {
            r.expected_revision
                .ok_or_else(|| invalid("expectedRevision là bắt buộc"))
        };
        let mut st = self.state.lock().unwrap();
        if let Some(pid) = r.project_id.as_ref() {
            if st
                .repository
                .as_ref()
                .is_none_or(|repo| repo.snapshot["id"] != *pid)
            {
                return Err(invalid("Dự án không còn đang mở"));
            }
        }
        match command {
            "app_bootstrap" => Ok(
                json!({"settings":st.settings,"recentProjects":st.recent,"dataRoot":self.root,"diagnostics":{"ffmpeg":media::version("ffmpeg").ok(),"ffprobe":media::version("ffprobe").ok(),"version":env!("CARGO_PKG_VERSION"),"platform":std::env::consts::OS},"project":st.repository.as_ref().map(|r|&r.snapshot)}),
            ),
            "project_list" => Ok(json!(st.recent)),
            "project_create" => {
                let parent = if let Some(token) = payload["token"].as_str() {
                    Self::token(&st, token, "directory")?
                } else {
                    self.root.join("projects")
                };
                let repo = Repository::create(parent.join(id()), s(&payload, "title"))?;
                st.repository = Some(repo);
                self.remember(&mut st)?;
                Ok(Self::repo(&mut st)?.snapshot.clone())
            }
            "project_open" => {
                let path = if let Some(token) = payload["token"].as_str() {
                    Self::token(&st, token, "directory")?
                } else {
                    st.recent
                        .iter()
                        .find(|p| p["id"] == payload["id"])
                        .and_then(|p| p["path"].as_str())
                        .map(PathBuf::from)
                        .ok_or_else(|| invalid("Không tìm thấy dự án; chọn folder"))?
                };
                if st.repository.as_ref().is_some_and(|r| r.dir == path) {
                    return Ok(Self::repo(&mut st)?.snapshot.clone());
                }
                let repo = Repository::open(path)?;
                st.repository = Some(repo);
                self.remember(&mut st)?;
                Ok(Self::repo(&mut st)?.snapshot.clone())
            }
            "project_recovery_list" => {
                let dir = Self::token(&st, s(&payload, "token"), "directory")?;
                let mut records = vec![];
                for entry in fs::read_dir(dir.join("revisions"))?.take(10000) {
                    let path = entry?.path();
                    let name = path.file_stem().and_then(|v| v.to_str()).unwrap_or("");
                    if name.len() == 12 && name.bytes().all(|b| b.is_ascii_digit()) {
                        if let Ok(snapshot) = storage::read(&path) {
                            if domain::validate(&snapshot).is_ok() {
                                records.push(json!({"revision":snapshot["revision"],"title":snapshot["title"],"updatedAt":snapshot["updatedAt"]}));
                            }
                        }
                    }
                }
                records.sort_by_key(|v| std::cmp::Reverse(n(v, "revision")));
                Ok(json!(records))
            }
            "project_recover" => {
                let dir = Self::token(&st, s(&payload, "token"), "directory")?;
                Repository::recover(&dir, n(&payload, "revision"))?;
                st.repository = Some(Repository::open(dir)?);
                self.remember(&mut st)?;
                Ok(Self::repo(&mut st)?.snapshot.clone())
            }
            "project_get" => Ok(Self::repo(&mut st)?.snapshot.clone()),
            "project_update" | "timeline_update" => {
                let snapshot = Self::repo(&mut st)?.update(payload, expected()?, request)?;
                self.remember(&mut st)?;
                Ok(snapshot)
            }
            "project_duplicate" => {
                let parent = if let Some(token) = payload["token"].as_str() {
                    Self::token(&st, token, "directory")?
                } else {
                    self.root.join("projects")
                };
                let repo =
                    Self::repo(&mut st)?.duplicate(parent.join(id()), s(&payload, "title"))?;
                st.repository = Some(repo);
                self.remember(&mut st)?;
                Ok(Self::repo(&mut st)?.snapshot.clone())
            }
            "project_close" => {
                st.repository = None;
                Ok(json!({"closed":true}))
            }
            "project_delete" => {
                let repo = Self::repo(&mut st)?;
                if repo.snapshot["title"] != payload["confirmation"] {
                    return Err(invalid("Nhập đúng tên dự án để xác nhận"));
                }
                if repo.snapshot["revision"] != expected()? {
                    return Err(Error::new("REVISION_CONFLICT", "Revision đã đổi"));
                }
                if jobs::list(&repo.dir.join("jobs"))?.iter().any(|j| {
                    [
                        "running",
                        "waiting_remote",
                        "queued",
                        "pause_requested",
                        "cancelling",
                    ]
                    .contains(&s(j, "state"))
                }) {
                    return Err(invalid("Tạm dừng/hủy tác vụ trước khi xóa"));
                }
                let pid = repo.snapshot["id"].clone();
                let dir = repo.dir.clone();
                st.repository = None;
                let dest = self.root.join("backups").join(format!("deleted-{}", id()));
                fs::rename(&dir, &dest)?;
                st.recent.retain(|r| r["id"] != pid);
                self.remember(&mut st)?;
                Ok(json!({"deleted":true,"backup":dest}))
            }
            "revision_list" => Self::repo(&mut st)?.revisions(),
            "revision_restore" => {
                let v =
                    Self::repo(&mut st)?.restore(n(&payload, "revision"), expected()?, request)?;
                Ok(v)
            }
            "asset_import" => {
                let paths = payload["tokens"]
                    .as_array()
                    .ok_or_else(|| invalid("Chọn media"))?
                    .iter()
                    .map(|t| Self::token(&st, t.as_str().unwrap_or(""), "file"))
                    .collect::<Result<Vec<_>>>()?;
                let repo = Self::repo(&mut st)?;
                if repo.snapshot["revision"] != expected()? {
                    return Err(Error::new("REVISION_CONFLICT", "Lưu dự án trước khi nhập"));
                }
                let mut next = repo.snapshot.clone();
                for file in paths {
                    let a = media::import(&repo.dir, &file, "imported")?;
                    next["assets"].as_array_mut().unwrap().push(a);
                }
                repo.commit(next, expected()?, request)
            }
            "asset_list" => Ok(Self::repo(&mut st)?.snapshot["assets"].clone()),
            "asset_stale" => {
                let repo = Self::repo(&mut st)?;
                let status=domain::array(&repo.snapshot,"assets").iter().map(|a|json!({"id":a["id"],"stale":crate::dependencies::stale(&repo.snapshot,&repo.dir,a).unwrap_or(true)})).collect::<Vec<_>>();
                Ok(json!(status))
            }
            "asset_relink" => {
                let source = Self::token(&st, s(&payload, "token"), "file")?;
                let repo = Self::repo(&mut st)?;
                if repo.snapshot["revision"] != expected()? {
                    return Err(Error::new(
                        "REVISION_CONFLICT",
                        "Lưu dự án trước khi liên kết lại",
                    ));
                }
                let a = domain::array(&repo.snapshot, "assets")
                    .iter()
                    .find(|a| a["id"] == payload["id"])
                    .ok_or_else(|| invalid("Asset không tồn tại"))?;
                crate::relink::restore(&repo.dir, a, &source)?;
                Ok(json!({"restored":true,"id":a["id"]}))
            }
            "asset_remove" => {
                let repo = Self::repo(&mut st)?;
                let mut next = repo.snapshot.clone();
                next["assets"]
                    .as_array_mut()
                    .unwrap()
                    .retain(|a| a["id"] != payload["id"]);
                repo.commit(next, expected()?, request)
            }
            "asset_preview_path" => {
                let repo = Self::repo(&mut st)?;
                let a = domain::array(&repo.snapshot, "assets")
                    .iter()
                    .find(|a| a["id"] == payload["id"])
                    .ok_or_else(|| invalid("Asset không tồn tại"))?;
                let thumb = repo
                    .dir
                    .join("cache/thumbnails")
                    .join(format!("{}.jpg", s(a, "id")));
                let path = if payload["thumbnail"] == true && thumb.exists() {
                    thumb
                } else {
                    storage::scoped(&repo.dir, s(a, "relativePath"))?
                };
                Ok(json!(path))
            }
            "render_preflight" => {
                let repo = Self::repo(&mut st)?;
                let mut manifest = media::preflight(&repo.snapshot, &repo.dir)?;
                let stale = crate::media::stale_selected(&repo.snapshot, &repo.dir)?;
                if !stale.is_empty() && payload["allowStale"] != true {
                    return Err(Error::new(
                        "STALE_ASSET",
                        format!(
                            "{} asset dùng input cũ. Tạo lại hoặc xác nhận dùng phiên bản cũ.",
                            stale.len()
                        ),
                    ));
                }
                manifest["staleOverrides"] = json!(stale);
                let token = id();
                let response = json!({"token":token,"plannedFrames":manifest["plannedFrames"],"estimatedBytes":manifest["estimatedBytes"],"revision":repo.snapshot["revision"]});
                st.preflights
                    .insert(token, (manifest, Instant::now() + Duration::from_secs(300)));
                Ok(response)
            }
            "render_start" => {
                let output = Self::token(&st, s(&payload, "destinationToken"), "save")?;
                if output.exists() {
                    return Err(invalid("Chọn tên file chưa tồn tại"));
                }
                let (manifest, expires) = st
                    .preflights
                    .get(s(&payload, "token"))
                    .cloned()
                    .ok_or_else(|| invalid("Chạy kiểm tra trước render"))?;
                let repo = Self::repo(&mut st)?;
                if expires < Instant::now()
                    || manifest["inputHash"] != domain::hash(&repo.snapshot)
                    || repo.snapshot["revision"] != expected()?
                {
                    return Err(Error::new(
                        "REVISION_CONFLICT",
                        "Preflight hết hạn hoặc dự án đã thay đổi",
                    ));
                }
                let jid = id();
                storage::atomic(
                    &repo.dir.join("manifests").join(format!("{jid}.json")),
                    &manifest,
                )?;
                let job = jobs::create(
                    &repo.dir.join("jobs"),
                    if payload["mode"] == "draft" {
                        "render_draft"
                    } else {
                        "render_final"
                    },
                    json!({"manifest":manifest,"directory":repo.dir,"output":output}),
                    request,
                )?;
                Ok(jobs::public(&job))
            }
            "merge_probe" => {
                let mut out = vec![];
                for token in payload["tokens"]
                    .as_array()
                    .ok_or_else(|| invalid("Chọn file"))?
                {
                    let file = Self::token(&st, token.as_str().unwrap_or(""), "file")?;
                    let meta = media::probe(&file)?;
                    out.push(json!({"token":token,"name":file.file_name().unwrap_or_default().to_string_lossy(),"durationMs":media::duration(&meta),"bytes":fs::metadata(&file)?.len(),"sha256":storage::sha_file(&file)?}));
                }
                Ok(json!(out))
            }
            "merge_start" => {
                let output = Self::token(&st, s(&payload, "destinationToken"), "save")?;
                if output.exists() {
                    return Err(invalid("Đích đã tồn tại"));
                }
                let inputs = payload["inputs"]
                    .as_array()
                    .ok_or_else(|| invalid("Chọn video"))?;
                if inputs.is_empty() {
                    return Err(invalid("Chưa chọn video"));
                }
                let dir = self.root.join("cache/merge").join(id());
                let mut repo = Repository::create(dir, "Ghép video")?;
                let mut p = repo.snapshot.clone();
                if payload["video"].is_object() {
                    p["video"] = payload["video"].clone();
                }
                let rate = domain::fps(&p);
                for i in inputs {
                    let src = Self::token(&st, s(i, "token"), "file")?;
                    if src == output {
                        return Err(invalid("Không ghi đè nguồn"));
                    }
                    if storage::sha_file(&src)? != s(i, "sha256") {
                        return Err(Error::new("ASSET_CHANGED", "Nguồn thay đổi; probe lại"));
                    }
                    let a = media::import(&repo.dir, &src, "imported")?;
                    if a["kind"] != "video" {
                        return Err(invalid("Merge cần video"));
                    }
                    let frames = if let Some(f) = i["durationFrames"].as_u64() {
                        f
                    } else {
                        (n(&a, "durationMs") as f64 * rate / 1000.0).round() as u64
                    };
                    p["timeline"]["items"].as_array_mut().unwrap().push(json!({"id":id(),"assetId":a["id"],"inFrame":n(i,"inFrame"),"durationFrames":frames,"transitionOut":{"kind":"cut","durationFrames":0},"sourceAudio":"keep","sourceAudioGainDb":0}));
                    p["assets"].as_array_mut().unwrap().push(a);
                }
                repo.commit(p, 0, request)?;
                let manifest = media::preflight(&repo.snapshot, &repo.dir)?;
                let job = jobs::create(
                    &self.root.join("database/merge-jobs"),
                    "merge_video",
                    json!({"manifest":manifest,"directory":repo.dir,"output":output}),
                    request,
                )?;
                Ok(jobs::public(&job))
            }
            "job_list" => {
                let _guard = self.job_mutex.lock().unwrap();
                let mut all = jobs::list(&self.root.join("database/merge-jobs"))?;
                if let Some(repo) = &st.repository {
                    all.extend(jobs::list(&repo.dir.join("jobs"))?);
                }
                Ok(json!(all.iter().map(jobs::public).collect::<Vec<_>>()))
            }
            "job_pause" | "job_resume" | "job_cancel" | "job_retry" => {
                let _guard = self.job_mutex.lock().unwrap();
                let jid = s(&payload, "id");
                let global = jobs::path(&self.root.join("database/merge-jobs"), jid)?;
                let path = if global.exists() {
                    global
                } else {
                    jobs::path(&Self::repo(&mut st)?.dir.join("jobs"), jid)?
                };
                jobs::control(
                    &path,
                    command.trim_start_matches("job_"),
                    n(&payload, "version"),
                )
                .map(|j| jobs::public(&j))
            }
            "settings_get" => Ok(st.settings.clone()),
            "settings_update" => {
                if let Some(theme) = payload["theme"].as_str() {
                    if !["dark", "light"].contains(&theme) {
                        return Err(invalid("Invalid theme"));
                    }
                    st.settings["theme"] = json!(theme);
                }
                if let Some(connections) = payload["connections"].as_array() {
                    if connections.len() > 20 {
                        return Err(invalid("Tối đa 20 connections"));
                    }
                    let mut safe = vec![];
                    for c in connections {
                        uuid::Uuid::parse_str(s(c, "id"))
                            .map_err(|_| invalid("Invalid connection ID"))?;
                        safe.push(json!({"id":c["id"],"label":s(c,"label"),"adapter":"openai","credentialRef":c["id"]}));
                    }
                    st.settings["connections"] = json!(safe);
                }
                storage::atomic(&self.root.join("config/settings.json"), &st.settings)?;
                Ok(st.settings.clone())
            }
            "provider_list" | "provider_capabilities" => Ok(providers::catalog()),
            "provider_test" => {
                let key = st.secrets.get(s(&payload, "connectionId"))?;
                drop(st);
                tokio::runtime::Runtime::new()
                    .map_err(Error::from)?
                    .block_on(providers::test(&key))
            }
            "secret_set" => {
                st.secrets.set(
                    s(&payload, "connectionId"),
                    s(&payload, "key").to_owned(),
                    payload["sessionOnly"] == true,
                )?;
                Ok(json!({"configured":true}))
            }
            "secret_delete" => {
                st.secrets.delete(s(&payload, "connectionId"))?;
                Ok(json!({"configured":false}))
            }
            "secret_status" => {
                Ok(json!({"configured":st.secrets.configured(s(&payload,"connectionId"))}))
            }
            "ai_edit_propose" | "story_generate" | "outline_generate" | "scenes_generate"
            | "plan_generate" | "media_generate" => {
                let kind = if command == "media_generate" {
                    s(&payload, "kind")
                } else {
                    "text"
                };
                let repo = Self::repo(&mut st)?;
                if repo.snapshot["revision"] != expected()? {
                    return Err(Error::new(
                        "REVISION_CONFLICT",
                        "Lưu dự án trước khi tạo AI",
                    ));
                }
                let p = repo.snapshot.clone();
                let dir = repo.dir.clone();
                let voice_config = crate::voice::resolve(&p, &payload["target"]);
                let binding = if kind == "voice" {
                    &voice_config["binding"]
                } else {
                    &p["providerBindings"][kind]
                };
                let connection = s(binding, "connectionId");
                let model = s(binding, "modelId");
                st.secrets.get(connection)?;
                let target = payload["target"].clone();
                let field = s(&target, "field");
                let structured = command == "plan_generate";
                let base = if structured {
                    json!({"story":p["story"],"characters":p["characters"]})
                } else {
                    target_value(&p, &target)?
                };
                if !structured && !allowed_target(&p, &target) {
                    return Err(invalid("Field đang khóa hoặc không cho phép AI chỉnh sửa"));
                }
                let prompt = if structured {
                    format!("Create chapters, scenes, shots and dialogue in Vietnamese. Use only characterNames and speakerName from provided characters; empty speakerName is narrator. Append new chapters only. Scene dialogues have approximate start times and need user review. Keep total duration near the target. Context: {}\nTarget duration ms: {}\nUser instruction: {}",base,p["video"]["targetDurationMs"],s(&payload,"instruction"))
                } else if kind == "text" {
                    format!("Story bible: {}\nTarget field: {field}\nCurrent content: {base}\nUser instruction: {}\nReturn only the new field text.",p["story"],s(&payload,"instruction"))
                } else if kind == "voice" {
                    s(&payload, "prompt").to_owned()
                } else {
                    format!(
                        "{}\nCharacter bible and visual context: {}",
                        s(&payload, "prompt"),
                        crate::dependencies::input(&p, &target, kind)?
                    )
                };
                let input = json!({"prompt":prompt,"seconds":n(&payload,"seconds"),"voice":voice_config["voice"],"speed":voice_config["speed"],"language":voice_config["language"],"emotion":voice_config["emotion"],"pronunciationNotes":voice_config["pronunciationNotes"],"portrait":p["video"]["aspectRatio"]=="9:16","structured":structured});
                providers::validate(kind, model, &input)?;
                let job = jobs::create(
                    &dir.join("jobs"),
                    &format!("{kind}_generation"),
                    json!({"kind":kind,"model":model,"connectionId":connection,"request":input,"projectId":p["id"],"directory":dir,"target":target,"baseValue":base,"baseRevision":p["revision"],"structured":structured,"inputHash":if structured{domain::hash(&base)}else{domain::hash(&crate::dependencies::input(&p,&target,kind)?)}}),
                    request,
                )?;
                Ok(jobs::public(&job))
            }
            "ai_edit_list" => {
                let repo = Self::repo(&mut st)?;
                let mut proposals = vec![];
                for e in fs::read_dir(repo.dir.join("proposals"))? {
                    let v = storage::read(&e?.path())?;
                    if v["status"] == "pending" {
                        proposals.push(v);
                    }
                }
                Ok(json!(proposals))
            }
            "ai_edit_apply" | "ai_edit_discard" => {
                let repo = Self::repo(&mut st)?;
                let pid = s(&payload, "id");
                uuid::Uuid::parse_str(pid).map_err(|_| invalid("Invalid proposal ID"))?;
                let file = repo.dir.join("proposals").join(format!("{pid}.json"));
                let mut proposal = storage::read(&file)?;
                if proposal["status"] != "pending" {
                    return Err(invalid("Proposal đã xử lý"));
                }
                if command == "ai_edit_discard" {
                    proposal["status"] = json!("discarded");
                    storage::atomic(&file, &proposal)?;
                    return Ok(json!({"discarded":true}));
                }
                if proposal["structured"] == true {
                    if json!({"story":repo.snapshot["story"],"characters":repo.snapshot["characters"]})
                        != proposal["baseValue"]
                    {
                        return Err(Error::new(
                            "REVISION_CONFLICT",
                            "Story/nhân vật đã đổi; tạo kế hoạch mới",
                        ));
                    }
                    let mut next = repo.snapshot.clone();
                    crate::planning::append(&mut next, &proposal["value"])?;
                    let saved = repo.commit(next, expected()?, request)?;
                    proposal["status"] = json!("applied");
                    storage::atomic(&file, &proposal)?;
                    return Ok(saved);
                }
                let target = &proposal["target"];
                if !allowed_target(&repo.snapshot, target)
                    || target_value(&repo.snapshot, target)? != proposal["baseValue"]
                {
                    return Err(Error::new(
                        "REVISION_CONFLICT",
                        "Nội dung đích đã đổi hoặc khóa; tạo proposal mới",
                    ));
                }
                let mut next = repo.snapshot.clone();
                *target_mut(&mut next, target)? = proposal["value"].clone();
                let saved = repo.commit(next, expected()?, request)?;
                proposal["status"] = json!("applied");
                storage::atomic(&file, &proposal)?;
                Ok(saved)
            }
            "storage_inspect" => {
                let repo = Self::repo(&mut st)?;
                let bytes = domain::array(&repo.snapshot, "assets")
                    .iter()
                    .map(|a| n(a, "bytes"))
                    .sum::<u64>();
                Ok(json!({"assetBytes":bytes,"availableBytes":fs2::available_space(&repo.dir)?}))
            }
            "storage_cleanup" => {
                let repo = Self::repo(&mut st)?;
                if jobs::list(&repo.dir.join("jobs"))?.iter().any(|j| {
                    [
                        "queued",
                        "running",
                        "waiting_remote",
                        "pause_requested",
                        "cancelling",
                    ]
                    .contains(&s(j, "state"))
                }) {
                    return Err(invalid("Dừng tác vụ trước cleanup"));
                }
                let cache = repo.dir.join("cache/normalized");
                if cache.exists() {
                    fs::remove_dir_all(&cache)?;
                }
                fs::create_dir_all(cache)?;
                Ok(json!({"cleaned":true}))
            }
            "diagnostics_export" => Ok(
                json!({"version":env!("CARGO_PKG_VERSION"),"platform":std::env::consts::OS,"ffmpeg":media::version("ffmpeg").ok(),"schemaVersion":1,"telemetry":false}),
            ),
            _ => Err(Error::new(
                "PROVIDER_UNSUPPORTED",
                format!("Command chưa hỗ trợ: {command}"),
            )),
        }
    }
    pub fn start_worker(self: &Arc<Self>) {
        let engine = Arc::clone(self);
        std::thread::spawn(move || {
            let runtime = tokio::runtime::Runtime::new().expect("job runtime");
            loop {
                if let Err(e) = runtime.block_on(engine.tick()) {
                    tracing::warn!(code=%e.code,"worker iteration failed");
                }
                std::thread::sleep(Duration::from_millis(500));
            }
        });
    }
    async fn tick(&self) -> Result<()> {
        let job_entry = {
            let st = self.state.lock().unwrap();
            let _guard = self.job_mutex.lock().unwrap();
            let mut dirs = vec![self.root.join("database/merge-jobs")];
            if let Some(repo) = &st.repository {
                dirs.push(repo.dir.join("jobs"));
            }
            let mut found = None;
            for dir in dirs {
                if let Some(mut j) = jobs::list(&dir)?
                    .into_iter()
                    .rev()
                    .find(|j| j["state"] == "queued")
                {
                    let path = jobs::path(&dir, s(&j, "id"))?;
                    j["attempt"] = json!(n(&j, "attempt") + 1);
                    let j = jobs::update(&path, j, "running")?;
                    found = Some((path, j));
                    break;
                }
            }
            found
        };
        let Some((path, job)) = job_entry else {
            return Ok(());
        };
        let payload = &job["payload"];
        let dir = PathBuf::from(s(payload, "directory"));
        let jid = s(&job, "id");
        let result: Result<Value> = async { if s(&job, "kind").starts_with("render")
            || job["kind"] == "merge_video"
        {
            media::render(
                &payload["manifest"],
                &dir,
                Path::new(s(payload, "output")),
                |done, total| self.checkpoint(&path, None, Some((done, total))),
            )
        } else {
            let key = {
                self.state
                    .lock()
                    .unwrap()
                    .secrets
                    .get(s(payload, "connectionId"))
            };
            match key {
                Err(e) => Err(e),
                Ok(key) => {
                    let output = dir.join("temp").join(format!(
                        "{jid}.{}",
                        match s(payload, "kind") {
                            "image" => "png",
                            "video" => "mp4",
                            _ => "mp3",
                        }
                    ));
                    fs::create_dir_all(output.parent().unwrap())?;
                    let provider_result = providers::generate(
                        s(payload, "kind"),
                        s(payload, "model"),
                        &key,
                        &payload["request"],
                        &output,
                        job["remoteJobId"].as_str(),
                        |remote| self.checkpoint(&path, remote, None),
                    )
                    .await;
                    match provider_result {
                        Err(e) => Err(e),
                        Ok(value) => {
                            // A completed, non-resumable response must be persisted even if
                            // pause was requested in flight; discarding it could pay twice.
                            {
                                let _guard = self.job_mutex.lock().unwrap();
                                if storage::read(&path)?["state"] == "cancelling" {
                                    return Err(Error::new("CANCELLED", "Đã hủy; remote có thể vẫn tính phí"));
                                }
                            }
                            if payload["kind"] == "text" {
                                let proposed=if payload["structured"]==true {let plan:Value=serde_json::from_str(s(&value,"text"))?;crate::planning::validate(&plan)?;plan}else{value["text"].clone()};
                                let proposal = json!({"id":jid,"projectId":payload["projectId"],"baseRevision":payload["baseRevision"],"target":payload["target"],"baseValue":payload["baseValue"],"value":proposed,"structured":payload["structured"],"status":"pending","createdAt":now()});
                                storage::atomic(
                                    &dir.join("proposals").join(format!("{jid}.json")),
                                    &proposal,
                                )?;
                                Ok(json!({"proposalId":jid}))
                            } else {
                                let mut asset = media::import(&dir, &output, "generated")?;
                                asset["provenance"] = json!({"jobId":jid,"connectionId":payload["connectionId"],"modelId":payload["model"],"inputHash":payload["inputHash"],"promptHash":domain::hash(&payload["request"])});
                                let mut st = self.state.lock().unwrap();
                                let mut opened;
                                let repo = if let Some(repo) =
                                    st.repository.as_mut().filter(|r| r.dir == dir)
                                {
                                    repo
                                } else {
                                    opened = Repository::open(dir.clone())?;
                                    &mut opened
                                };
                                if let Some(existing) = domain::array(&repo.snapshot, "assets")
                                    .iter()
                                    .find(|a| a["provenance"]["jobId"] == jid)
                                {
                                    Ok(json!({"assetId":existing["id"]}))
                                } else {
                                    let mut next = repo.snapshot.clone();
                                    next["assets"].as_array_mut().unwrap().push(asset.clone());
                                    repo.commit(next, n(&repo.snapshot, "revision"), &id())?;
                                    Ok(json!({"assetId":asset["id"],"selectionRequired":true}))
                                }
                            }
                        }
                    }
                }
            }
        } }.await;
        let _guard = self.job_mutex.lock().unwrap();
        let mut latest = storage::read(&path)?;
        match result {
            Ok(output) => {
                if latest["state"] == "cancelling" {
                    jobs::update(&path, latest, "cancelled")?;
                } else {
                    latest["output"] = output;
                    latest["progress"]["message"] = json!("Hoàn tất");
                    jobs::update(&path, latest, "succeeded")?;
                }
            }
            Err(e) => {
                let state = match e.code.as_str() {
                    "PAUSED" => "paused",
                    "CANCELLED" => "cancelled",
                    "SUBMISSION_UNKNOWN" | "SECRET_MISSING" | "SECRET_STORE_UNAVAILABLE" => {
                        "blocked"
                    }
                    _ => "failed",
                };
                latest["error"] = json!(e);
                jobs::update(&path, latest, state)?;
            }
        }
        Ok(())
    }
    fn checkpoint(
        &self,
        path: &Path,
        remote: Option<&str>,
        progress: Option<(usize, usize)>,
    ) -> Result<()> {
        let _guard = self.job_mutex.lock().unwrap();
        let mut job = storage::read(path)?;
        if let Some(remote) = remote {
            if job["remoteJobId"] != remote {
                job["remoteJobId"] = json!(remote);
                storage::atomic(path, &job)?;
            }
        }
        if job["state"] == "cancelling" {
            return Err(Error::new(
                "CANCELLED",
                "Đã hủy; tác vụ remote có thể vẫn tính phí",
            ));
        }
        if job["state"] == "pause_requested" {
            return Err(Error::new(
                "PAUSED",
                "Đã dừng tại checkpoint; remote có thể vẫn chạy",
            ));
        }
        if let Some(remote) = remote {
            job["remoteJobId"] = json!(remote);
            if job["state"] != "waiting_remote" {
                jobs::update(path, job, "waiting_remote")?;
            }
        } else if let Some((done, total)) = progress {
            if job["progress"]["completed"] != done || job["progress"]["total"] != total {
                job["progress"] = json!({"completed":done,"total":total,"message":if done==total{"Đang ghép và kiểm tra output"}else{"Đang chuẩn hóa đoạn"}});
                storage::atomic(path, &job)?;
            }
        }
        Ok(())
    }
}
pub fn target_value(p: &Value, target: &Value) -> Result<Value> {
    let mut copy = p.clone();
    Ok(target_mut(&mut copy, target)?.clone())
}
pub fn target_mut<'a>(p: &'a mut Value, target: &Value) -> Result<&'a mut Value> {
    let kind = s(target, "kind");
    let field = s(target, "field");
    let entity = match kind {
        "story" => &mut p["story"],
        "scene" => p["scenes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|v| v["id"] == target["id"])
            .ok_or_else(|| invalid("Scene missing"))?,
        "dialogue" => p["scenes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .flat_map(|sc| sc["dialogues"].as_array_mut().unwrap().iter_mut())
            .find(|d| d["id"] == target["id"])
            .ok_or_else(|| invalid("Dialogue missing"))?,
        "shot" => p["scenes"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .flat_map(|sc| sc["shots"].as_array_mut().unwrap().iter_mut())
            .find(|d| d["id"] == target["id"])
            .ok_or_else(|| invalid("Shot missing"))?,
        _ => return Err(invalid("Target không hỗ trợ")),
    };
    entity
        .get_mut(field)
        .ok_or_else(|| invalid("Field không tồn tại"))
}
pub fn allowed_target(p: &Value, target: &Value) -> bool {
    let field = s(target, "field");
    let allowed = match s(target, "kind") {
        "story" => {
            [
                "idea",
                "synopsis",
                "fullContent",
                "genre",
                "audience",
                "style",
                "constraints",
                "ending",
            ]
            .contains(&field)
                && !domain::array(&p["story"], "lockedFields")
                    .iter()
                    .any(|v| v == field)
        }
        "scene" => {
            [
                "title",
                "summary",
                "location",
                "timeOfDay",
                "mood",
                "continuityNotes",
            ]
            .contains(&field)
                && domain::array(p, "scenes")
                    .iter()
                    .find(|v| v["id"] == target["id"])
                    .is_some_and(|v| !domain::array(v, "lockedFields").iter().any(|f| f == field))
        }
        "dialogue" => {
            field == "text"
                && domain::array(p, "scenes")
                    .iter()
                    .filter(|sc| {
                        domain::array(sc, "dialogues")
                            .iter()
                            .any(|d| d["id"] == target["id"])
                    })
                    .all(|sc| {
                        !domain::array(sc, "lockedFields")
                            .iter()
                            .any(|f| f == "dialogues")
                    })
        }
        "shot" => ["description", "imagePrompt", "videoPrompt", "camera"].contains(&field),
        _ => false,
    };
    allowed && target_value(p, target).is_ok()
}
