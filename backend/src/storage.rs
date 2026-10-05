use crate::{
    domain::{self, id, now},
    error::{invalid, Error, Result},
};
use fs2::FileExt;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};
pub fn atomic(path: &Path, value: &Value) -> Result<()> {
    atomic_bytes(path, &serde_json::to_vec_pretty(value)?)
}
pub fn atomic_bytes(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or_else(|| invalid("Missing parent"))?;
    fs::create_dir_all(parent)?;
    let mut file = tempfile::NamedTempFile::new_in(parent)?;
    file.write_all(bytes)?;
    file.as_file().sync_all()?;
    file.persist(path).map_err(|e| Error::from(e.error))?;
    #[cfg(unix)]
    File::open(parent)?.sync_all()?;
    Ok(())
}
pub fn read(path: &Path) -> Result<Value> {
    if fs::metadata(path)?.len() > 12 * 1024 * 1024 {
        return Err(invalid("JSON vượt giới hạn"));
    }
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}
pub fn sha_file(path: &Path) -> Result<String> {
    let mut f = File::open(path)?;
    let mut buf = [0; 65536];
    let mut h = Sha256::new();
    loop {
        let len = f.read(&mut buf)?;
        if len == 0 {
            break;
        }
        h.update(&buf[..len]);
    }
    Ok(format!("{:x}", h.finalize()))
}
pub fn scoped(root: &Path, relative: &str) -> Result<PathBuf> {
    let p = Path::new(relative);
    if p.is_absolute()
        || p.components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err(invalid("Đường dẫn không hợp lệ"));
    }
    let canonical = root.join(p).canonicalize()?;
    if !canonical.starts_with(root.canonicalize()?) {
        return Err(invalid("Đường dẫn ra ngoài project"));
    }
    Ok(canonical)
}
pub struct Repository {
    pub dir: PathBuf,
    pub snapshot: Value,
    _lock: File,
}
impl Repository {
    pub fn create(dir: PathBuf, title: &str) -> Result<Self> {
        if title.trim().is_empty() {
            return Err(invalid("Tên dự án không được rỗng"));
        }
        fs::create_dir_all(&dir)?;
        let lock = Self::lock(&dir)?;
        if dir.join("project.json").exists() {
            return Err(invalid("Project đã tồn tại"));
        }
        let snapshot = domain::new_project(title);
        domain::validate(&snapshot)?;
        for sub in [
            "revisions",
            "jobs",
            "proposals",
            "assets/images",
            "assets/videos",
            "assets/audio",
            "assets/characters",
            "assets/subtitles",
            "assets/music",
            "renders/draft",
            "renders/final",
            "manifests",
            "cache/normalized",
            "cache/thumbnails",
            "temp",
        ] {
            fs::create_dir_all(dir.join(sub))?;
        }
        atomic(&dir.join("project.json"), &snapshot)?;
        Ok(Self {
            dir: dir.canonicalize()?,
            snapshot,
            _lock: lock,
        })
    }
    fn lock(dir: &Path) -> Result<File> {
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(dir.join(".lock"))?;
        file.try_lock_exclusive()
            .map_err(|_| Error::new("PROJECT_LOCKED", "Dự án đang mở ở tiến trình khác"))?;
        file.set_len(0)?;
        write!(file, "pid={} session={}", std::process::id(), id())?;
        Ok(file)
    }
    pub fn open(dir: PathBuf) -> Result<Self> {
        let dir = dir.canonicalize()?;
        let lock = Self::lock(&dir)?;
        let snapshot = read(&dir.join("project.json"))
            .and_then(|v| {
                domain::validate(&v)?;
                Ok(v)
            })
            .map_err(|_| {
                Error::new(
                    "PROJECT_CORRUPT",
                    "Snapshot không hợp lệ. File gốc được giữ nguyên; chọn khôi phục từ lịch sử.",
                )
            })?;
        Ok(Self {
            dir,
            snapshot,
            _lock: lock,
        })
    }
    pub fn commit(&mut self, mut next: Value, expected: u64, request: &str) -> Result<Value> {
        uuid::Uuid::parse_str(request).map_err(|_| invalid("requestId phải là UUID"))?;
        let dedup = self
            .dir
            .join("revisions")
            .join(format!("request-{request}.json"));
        let current = self.snapshot["revision"].as_u64().unwrap_or(0);
        if dedup.exists() {
            let receipt = read(&dedup)?;
            if receipt["revision"].as_u64().is_some_and(|r| r <= current) {
                return Ok(receipt);
            }
            // A receipt ahead of the snapshot was never committed. Reapply only
            // against its original expected revision.
        }
        if current != expected {
            return Err(Error::new(
                "REVISION_CONFLICT",
                "Dự án đã thay đổi. Tải lại trước khi áp dụng.",
            ));
        }
        next["id"] = self.snapshot["id"].clone();
        next["createdAt"] = self.snapshot["createdAt"].clone();
        next["revision"] = json!(current + 1);
        next["updatedAt"] = json!(now());
        domain::validate(&next)?;
        atomic(
            &self
                .dir
                .join("revisions")
                .join(format!("{current:012}.json")),
            &self.snapshot,
        )?;
        // Receipt stores the intended snapshot before commit. Reconcile by revision on startup;
        // retries only return a receipt whose revision is already committed.
        atomic(&dedup, &next)?;
        atomic(&self.dir.join("project.json"), &next)?;
        self.snapshot = next.clone();
        Ok(next)
    }
    pub fn update(&mut self, edited: Value, expected: u64, request: &str) -> Result<Value> {
        let mut next = self.snapshot.clone();
        for k in [
            "title",
            "language",
            "story",
            "video",
            "providerBindings",
            "characters",
            "chapters",
            "scenes",
            "timeline",
        ] {
            if let Some(v) = edited.get(k) {
                next[k] = v.clone();
            }
        }
        self.commit(next, expected, request)
    }
    pub fn revisions(&self) -> Result<Value> {
        let mut entries = vec![];
        for e in fs::read_dir(self.dir.join("revisions"))? {
            let p = e?.path();
            if p.file_name()
                .and_then(|x| x.to_str())
                .is_some_and(|x| x.starts_with("request-"))
            {
                continue;
            }
            if let Ok(v) = read(&p) {
                entries.push(
                    json!({"revision":v["revision"],"title":v["title"],"updatedAt":v["updatedAt"]}),
                );
            }
        }
        entries.sort_by_key(|v| std::cmp::Reverse(v["revision"].as_u64()));
        Ok(json!(entries))
    }
    pub fn restore(&mut self, revision: u64, expected: u64, request: &str) -> Result<Value> {
        let v = read(
            &self
                .dir
                .join("revisions")
                .join(format!("{revision:012}.json")),
        )?;
        self.commit(v, expected, request)
    }
    pub fn recover(dir: &Path, revision: u64) -> Result<()> {
        let _lock = Self::lock(dir)?;
        let mut backup = read(&dir.join("revisions").join(format!("{revision:012}.json")))?;
        domain::validate(&backup)?;
        let mut highest = revision;
        for entry in fs::read_dir(dir.join("revisions"))? {
            if let Ok(record) = read(&entry?.path()) {
                if domain::validate(&record).is_ok() {
                    highest = highest.max(record["revision"].as_u64().unwrap_or(0));
                }
            }
        }
        if let Ok(current) = read(&dir.join("project.json")) {
            highest = highest.max(current["revision"].as_u64().unwrap_or(0));
        }
        backup["revision"] = json!(highest + 1);
        backup["updatedAt"] = json!(now());
        let source = dir.join("project.json");
        if source.exists() {
            fs::copy(&source, dir.join(format!("project.corrupt-{}.json", id())))?;
        }
        atomic(&source, &backup)
    }
    pub fn duplicate(&self, destination: PathBuf, title: &str) -> Result<Self> {
        let mut repo = Self::create(destination, title)?;
        let mut next = self.snapshot.clone();
        fn collect(v: &Value, map: &mut std::collections::HashMap<String, String>) {
            match v {
                Value::Object(o) => {
                    if let Some(i) = o.get("id").and_then(Value::as_str) {
                        map.insert(i.into(), id());
                    }
                    for x in o.values() {
                        collect(x, map);
                    }
                }
                Value::Array(a) => {
                    for x in a {
                        collect(x, map);
                    }
                }
                _ => {}
            }
        }
        fn remap(v: &mut Value, map: &std::collections::HashMap<String, String>) {
            match v {
                Value::String(s) => {
                    if let Some(n) = map.get(s) {
                        *s = n.clone()
                    }
                }
                Value::Object(o) => {
                    for x in o.values_mut() {
                        remap(x, map)
                    }
                }
                Value::Array(a) => {
                    for x in a {
                        remap(x, map)
                    }
                }
                _ => {}
            }
        }
        let mut map = std::collections::HashMap::new();
        collect(&next, &mut map);
        remap(&mut next, &map);
        for a in domain::array(&next, "assets") {
            let relative = domain::s(a, "relativePath");
            let src = scoped(&self.dir, relative)?;
            let dest = repo.dir.join(relative);
            fs::create_dir_all(dest.parent().unwrap())?;
            fs::copy(src, dest)?;
        }
        next["title"] = json!(title);
        next["providerBindings"] = json!({"text":null,"image":null,"video":null,"voice":null});
        for c in next["characters"].as_array_mut().unwrap() {
            c.as_object_mut().unwrap().remove("voice");
        }
        repo.commit(next, 0, &id())?;
        Ok(repo)
    }
}
