use serde_json::{json, Value};
use std::{
    process::Command,
    time::{Duration, Instant},
};
use studio_backend::{
    application::{Engine, Request},
    domain::{id, n, s},
    media, storage,
};
fn call(e: &Engine, command: &str, payload: Value, p: Option<&Value>) -> Value {
    let r = e.dispatch(
        command,
        Request {
            api_version: 1,
            request_id: id(),
            project_id: p.map(|p| s(p, "id").to_owned()),
            expected_revision: p.map(|p| n(p, "revision")),
            payload,
        },
    );
    assert_eq!(r["ok"], true, "{r}");
    r["data"].clone()
}
#[test]
fn native_backend_import_queue_render_end_to_end() {
    let dir = tempfile::tempdir().unwrap();
    let source = dir.path().join("nguồn.mp4");
    assert!(Command::new(media::binary("ffmpeg"))
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=160x90:r=24:d=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p"
        ])
        .arg(&source)
        .status()
        .unwrap()
        .success());
    let e = Engine::new(dir.path().join("data")).unwrap();
    let p = call(
        &e,
        "project_create",
        json!({"title":"Queue integration"}),
        None,
    );
    let token = e.grant(source, "file").unwrap();
    let mut p = call(
        &e,
        "asset_import",
        json!({"tokens":[token["token"]]}),
        Some(&p),
    );
    let aid = p["assets"][0]["id"].clone();
    let revision = p.clone();
    p["video"]["width"] = json!(160);
    p["video"]["height"] = json!(90);
    p["video"]["fps"] = json!({"numerator":24,"denominator":1});
    p["timeline"]["items"] = json!([{"id":id(),"assetId":aid,"inFrame":0,"durationFrames":24,"transitionOut":{"kind":"cut","durationFrames":0},"sourceAudio":"mute","sourceAudioGainDb":0}]);
    p = call(&e, "project_update", p, Some(&revision));
    let preflight = call(&e, "render_preflight", json!({}), Some(&p));
    let output = dir.path().join("thành phẩm.mp4");
    let dest = e.grant(output.clone(), "save").unwrap();
    let job = call(
        &e,
        "render_start",
        json!({"token":preflight["token"],"destinationToken":dest["token"],"mode":"final"}),
        Some(&p),
    );
    e.start_worker();
    let started = Instant::now();
    loop {
        let jobs = call(&e, "job_list", json!({}), None);
        let current = jobs
            .as_array()
            .unwrap()
            .iter()
            .find(|j| j["id"] == job["id"])
            .unwrap();
        if current["state"] == "succeeded" {
            break;
        }
        assert_ne!(current["state"], "failed", "{current}");
        assert!(started.elapsed() < Duration::from_secs(30), "{current}");
        std::thread::sleep(Duration::from_millis(100));
    }
    let out = media::probe(&output).unwrap();
    assert!(media::duration(&out).abs_diff(1000) <= 100);
    let folder = e
        .state
        .lock()
        .unwrap()
        .repository
        .as_ref()
        .unwrap()
        .dir
        .clone();
    domain_valid(&storage::read(&folder.join("project.json")).unwrap());
}
fn domain_valid(v: &Value) {
    studio_backend::domain::validate(v).unwrap();
}

#[test]
fn recovery_picker_lists_valid_history_and_restores_corrupt_project() {
    let temp = tempfile::tempdir().unwrap();
    let project_dir = temp.path().join("broken");
    let mut repo = storage::Repository::create(project_dir.clone(), "Phục hồi").unwrap();
    let mut next = repo.snapshot.clone();
    next["story"]["idea"] = json!("Bản mới");
    repo.update(next, 0, &id()).unwrap();
    drop(repo);
    std::fs::write(project_dir.join("project.json"), b"broken").unwrap();
    let engine = Engine::new(temp.path().join("data")).unwrap();
    let grant = engine.grant(project_dir.clone(), "directory").unwrap();
    let revisions = call(
        &engine,
        "project_recovery_list",
        json!({"token":grant["token"]}),
        None,
    );
    assert!(!revisions.as_array().unwrap().is_empty());
    let restored = call(
        &engine,
        "project_recover",
        json!({"token":grant["token"], "revision":0}),
        None,
    );
    assert!(n(&restored, "revision") > 1);
    assert_eq!(restored["story"]["idea"], "");
    studio_backend::domain::validate(&restored).unwrap();
}

#[test]
fn voice_enqueue_uses_speaker_connection_and_options_without_network() {
    let temp = tempfile::tempdir().unwrap();
    let e = Engine::new(temp.path().join("data")).unwrap();
    let mut p = call(&e, "project_create", json!({"title":"Voice queue"}), None);
    let connection = id();
    call(
        &e,
        "secret_set",
        json!({"connectionId":connection,"key":"offline-test-not-a-real-key","sessionOnly":true}),
        None,
    );
    let fixture: Value =
        serde_json::from_str(include_str!("../../examples/offline-demo/project.json")).unwrap();
    let mut c = fixture["characters"][0].clone();
    c["referenceAssetIds"] = json!([]);
    c.as_object_mut().unwrap().remove("primaryReferenceAssetId");
    c["voice"] = json!({"binding":{"connectionId":connection,"modelId":"gpt-4o-mini-tts"},"voiceId":"cedar","speed":1.1,"language":"vi"});
    let did = id();
    let sid = id();
    let mut scene = fixture["scenes"][0].clone();
    scene["id"] = json!(sid);
    scene["shots"] = json!([]);
    scene["characterIds"] = json!([]);
    scene["dialogues"] = json!([{"id":did,"kind":"dialogue","speakerId":c["id"],"text":"Xin chào","startFrame":0,"emotion":"calm"}]);
    p = call(
        &e,
        "project_update",
        json!({"characters":[c],"chapters":[{"id":id(),"title":"One","summary":"","sceneIds":[sid]}],"scenes":[scene]}),
        Some(&p),
    );
    assert!(p["providerBindings"]["voice"].is_null());
    let job = call(
        &e,
        "media_generate",
        json!({"kind":"voice","target":{"kind":"dialogue","id":did,"field":"text"},"prompt":"Xin chào"}),
        Some(&p),
    );
    let recent = call(&e, "project_list", json!({}), None);
    let saved = storage::read(
        &std::path::PathBuf::from(s(&recent[0], "path"))
            .join("jobs")
            .join(format!("{}.json", s(&job, "id"))),
    )
    .unwrap();
    assert_eq!(saved["payload"]["connectionId"], connection);
    assert_eq!(saved["payload"]["request"]["voice"], "cedar");
    assert_eq!(saved["payload"]["request"]["speed"], 1.1);
    assert_eq!(saved["state"], "queued");
    assert!(!serde_json::to_string(&saved)
        .unwrap()
        .contains("offline-test-not-a-real-key"));
}
