use serde_json::json;
use studio_backend::{
    application::{Engine, Request},
    domain::{self, id},
    jobs,
    storage::{self, Repository},
};
#[test]
fn project_roundtrip_revision_conflict_restore_and_lock() {
    let dir = tempfile::tempdir().unwrap();
    let mut repo = Repository::create(dir.path().join("Dự án có dấu"), "Phim mùa hè").unwrap();
    let mut p = repo.snapshot.clone();
    p["story"]["idea"] = json!("Một hành trình đến Đà Lạt");
    let rid = id();
    let saved = repo.update(p.clone(), 0, &rid).unwrap();
    assert_eq!(saved["revision"], 1);
    assert_eq!(repo.update(p.clone(), 0, &rid).unwrap(), saved);
    assert_eq!(
        repo.update(p, 0, &id()).unwrap_err().code,
        "REVISION_CONFLICT"
    );
    assert_eq!(
        Repository::open(repo.dir.clone()).err().unwrap().code,
        "PROJECT_LOCKED"
    );
    let restored = repo.restore(0, 1, &id()).unwrap();
    assert_eq!(restored["revision"], 2);
    assert_eq!(restored["story"]["idea"], "");
    let path = repo.dir.clone();
    drop(repo);
    assert_eq!(Repository::open(path).unwrap().snapshot, restored);
}
#[test]
fn schema_and_references_reject_invalid_snapshots() {
    let mut p = domain::new_project("Test");
    domain::validate(&p).unwrap();
    p["video"]["width"] = json!(1919);
    assert!(domain::validate(&p).is_err());
    p["video"]["width"] = json!(1920);
    p["video"]["fps"] = json!({"numerator":60,"denominator":2});
    assert!(domain::validate(&p).is_err());
    p["video"]["fps"] = json!({"numerator":30000,"denominator":1001});
    domain::validate(&p).unwrap();
    p["unknown"] = json!(true);
    assert!(domain::validate(&p).is_err());
}
#[test]
fn immutable_identity_and_duplicate_remapping() {
    let dir = tempfile::tempdir().unwrap();
    let mut r = Repository::create(dir.path().join("a"), "A").unwrap();
    let original = r.snapshot["id"].clone();
    let mut p = r.snapshot.clone();
    p["id"] = json!(id());
    p["assets"] = json!([{ "malicious":"path" }]);
    let saved = r.update(p, 0, &id()).unwrap();
    assert_eq!(saved["id"], original);
    assert_eq!(saved["assets"], json!([]));
    let dup = r.duplicate(dir.path().join("b"), "B").unwrap();
    assert_ne!(dup.snapshot["id"], original);
}
#[test]
fn path_escape_is_blocked() {
    let root = tempfile::tempdir().unwrap();
    assert!(storage::scoped(root.path(), "../secret").is_err());
    assert!(storage::scoped(root.path(), "/etc/passwd").is_err());
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink("/etc/passwd", root.path().join("escape")).unwrap();
        assert!(storage::scoped(root.path(), "escape").is_err());
    }
}
#[test]
fn corruption_preserved_and_explicit_recovery() {
    let root = tempfile::tempdir().unwrap();
    let mut r = Repository::create(root.path().join("p"), "A").unwrap();
    r.update(r.snapshot.clone(), 0, &id()).unwrap();
    let path = r.dir.clone();
    drop(r);
    std::fs::write(path.join("project.json"), b"{broken").unwrap();
    assert_eq!(
        Repository::open(path.clone()).err().unwrap().code,
        "PROJECT_CORRUPT"
    );
    Repository::recover(&path, 0).unwrap();
    Repository::open(path.clone()).unwrap();
    assert!(std::fs::read_dir(path).unwrap().any(|p| p
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with("project.corrupt-")));
}
#[test]
fn crashed_remote_submission_is_never_automatically_retried() {
    let dir = tempfile::tempdir().unwrap();
    let j = jobs::create(dir.path(), "image_generation", json!({}), &id()).unwrap();
    let path = jobs::path(dir.path(), j["id"].as_str().unwrap()).unwrap();
    jobs::update(&path, j, "running").unwrap();
    jobs::recover(dir.path()).unwrap();
    let j = storage::read(&path).unwrap();
    assert_eq!(j["state"], "blocked");
    assert_eq!(j["error"]["code"], "SUBMISSION_UNKNOWN");
    assert!(jobs::control(&path, "retry", j["version"].as_u64().unwrap()).is_err());
}
#[test]
fn command_guards_and_session_secret_never_enter_project() {
    let tmp = tempfile::tempdir().unwrap();
    let e = Engine::new(tmp.path().join("data")).unwrap();
    let call = |cmd: &str, payload| {
        e.dispatch(
            cmd,
            Request {
                api_version: 1,
                request_id: id(),
                project_id: None,
                expected_revision: None,
                payload,
            },
        )
    };
    let p = call("project_create", json!({"title":"Offline"}));
    assert_eq!(p["ok"], true);
    let c = id();
    let result = call(
        "secret_set",
        json!({"connectionId":c,"key":"SENTINEL-NEVER-PERSIST","sessionOnly":true}),
    );
    assert_eq!(result["ok"], true);
    let project = call("project_get", json!({}));
    assert!(!project.to_string().contains("SENTINEL"));
    let update = call("project_update", json!({"title":"Changed"}));
    assert_eq!(update["ok"], false);
    assert_eq!(update["error"]["code"], "VALIDATION_FAILED");
}
#[test]
fn targeted_edit_protects_ids_and_locked_fields() {
    use studio_backend::application::{allowed_target, target_mut};
    let mut p = domain::new_project("Test");
    let target = json!({"kind":"story","field":"synopsis"});
    assert!(allowed_target(&p, &target));
    *target_mut(&mut p, &target).unwrap() = json!("Mới");
    assert_eq!(p["story"]["idea"], "");
    p["story"]["lockedFields"] = json!(["synopsis"]);
    assert!(!allowed_target(&p, &target));
    assert!(!allowed_target(&p, &json!({"kind":"story","field":"id"})));
}
#[test]
fn recovery_does_not_rewind_counter_and_receipt_before_commit_is_safe() {
    let root = tempfile::tempdir().unwrap();
    let mut r = Repository::create(root.path().join("p"), "R").unwrap();
    for _ in 0..3 {
        r.update(
            r.snapshot.clone(),
            r.snapshot["revision"].as_u64().unwrap(),
            &id(),
        )
        .unwrap();
    }
    let path = r.dir.clone();
    drop(r);
    std::fs::write(path.join("project.json"), "broken").unwrap();
    Repository::recover(&path, 0).unwrap();
    let r = Repository::open(path).unwrap();
    assert!(r.snapshot["revision"].as_u64().unwrap() > 3);
}

#[test]
fn relink_restores_only_exact_bytes_without_changing_identity_or_following_symlinks() {
    use studio_backend::relink;
    let tmp = tempfile::tempdir().unwrap();
    let project = tmp.path().join("project");
    std::fs::create_dir(&project).unwrap();
    let original = tmp.path().join("nguồn có dấu.bin");
    std::fs::write(&original, b"original").unwrap();
    let asset = json!({"id":id(),"bytes":8,"sha256":storage::sha_file(&original).unwrap(),"relativePath":"assets/videos/clip.bin"});
    let wrong = tmp.path().join("wrong.bin");
    std::fs::write(&wrong, b"modified").unwrap();
    assert_eq!(
        relink::restore(&project, &asset, &wrong).unwrap_err().code,
        "ASSET_CHANGED"
    );
    assert!(!project.join("assets/videos/clip.bin").exists());
    relink::restore(&project, &asset, &original).unwrap();
    relink::restore(&project, &asset, &original).unwrap();
    assert_eq!(
        std::fs::read(project.join("assets/videos/clip.bin")).unwrap(),
        b"original"
    );
    let mut escaped = asset.clone();
    escaped["relativePath"] = json!("../outside.bin");
    assert!(relink::restore(&project, &escaped, &original).is_err());
    std::fs::remove_file(project.join("assets/videos/clip.bin")).unwrap();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&wrong, project.join("assets/videos/clip.bin")).unwrap();
        assert!(relink::restore(&project, &asset, &original).is_err());
        assert_eq!(std::fs::read(&wrong).unwrap(), b"modified");
    }
}
