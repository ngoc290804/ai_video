use crate::{
    domain::{id, n, now, s},
    error::{invalid, Error, Result},
    storage,
};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
pub fn create(dir: &Path, kind: &str, payload: Value, request_id: &str) -> Result<Value> {
    uuid::Uuid::parse_str(request_id).map_err(|_| invalid("Invalid request ID"))?;
    std::fs::create_dir_all(dir)?;
    for job in list(dir)? {
        if job["requestId"] == request_id {
            return Ok(job);
        }
    }
    let job = json!({"schemaVersion":1,"id":id(),"requestId":request_id,"kind":kind,"state":"queued","version":0,"createdAt":now(),"updatedAt":now(),"attempt":0,"maxAttempts":5,"progress":{"completed":0,"total":0,"message":"Đang chờ"},"payload":payload,"remoteJobId":null,"output":null,"error":null});
    storage::atomic(&path(dir, s(&job, "id"))?, &job)?;
    Ok(job)
}
pub fn path(dir: &Path, id: &str) -> Result<PathBuf> {
    uuid::Uuid::parse_str(id).map_err(|_| invalid("Invalid job ID"))?;
    Ok(dir.join(format!("{id}.json")))
}
pub fn list(dir: &Path) -> Result<Vec<Value>> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut jobs = vec![];
    for e in std::fs::read_dir(dir)?.take(10000) {
        let p = e?.path();
        if p.extension().is_some_and(|x| x == "json") {
            let v = storage::read(&p)?;
            jobs.push(v);
        }
    }
    jobs.sort_by_key(|v| std::cmp::Reverse(s(v, "createdAt").to_string()));
    Ok(jobs)
}
pub fn public(job: &Value) -> Value {
    let mut j = job.clone();
    j.as_object_mut().unwrap().remove("payload");
    j
}
pub fn update(path: &Path, mut job: Value, state: &str) -> Result<Value> {
    job["state"] = json!(state);
    job["version"] = json!(n(&job, "version") + 1);
    job["updatedAt"] = json!(now());
    storage::atomic(path, &job)?;
    Ok(job)
}
pub fn control(path: &Path, action: &str, version: u64) -> Result<Value> {
    let job = storage::read(path)?;
    if n(&job, "version") != version {
        return Err(Error::new(
            "REVISION_CONFLICT",
            "Trạng thái job đã đổi; tải lại",
        ));
    }
    let state = s(&job, "state");
    let next = match (action, state) {
        ("pause", "queued") => "paused",
        ("pause", "running" | "waiting_remote") => "pause_requested",
        ("resume", "paused") => "queued",
        ("cancel", "queued" | "paused" | "blocked" | "failed") => "cancelled",
        ("cancel", "running" | "waiting_remote" | "pause_requested") => "cancelling",
        ("retry", "failed" | "blocked") => {
            if job["error"]["code"] == "SUBMISSION_UNKNOWN" {
                return Err(Error::new(
                    "SUBMISSION_UNKNOWN",
                    "Không thể tự gửi lại. Kiểm tra provider trước khi chủ động tạo tác vụ mới.",
                ));
            }
            "queued"
        }
        _ => return Err(invalid("Chuyển trạng thái job không hợp lệ")),
    };
    update(path, job, next)
}
pub fn recover(dir: &Path) -> Result<()> {
    for mut j in list(dir)? {
        if ["running", "waiting_remote", "pause_requested", "cancelling"].contains(&s(&j, "state"))
        {
            let path = path(dir, s(&j, "id"))?;
            let remote = j["remoteJobId"].is_string();
            let local = s(&j, "kind").starts_with("render") || s(&j, "kind") == "merge_video";
            let state = if s(&j, "state") == "cancelling" {
                "cancelled"
            } else if local || remote {
                "paused"
            } else {
                j["error"] = json!(Error::new(
                    "SUBMISSION_UNKNOWN",
                    "Ứng dụng ngắt giữa tác vụ AI; kiểm tra provider trước khi tạo mới"
                ));
                "blocked"
            };
            update(&path, j, state)?;
        }
    }
    Ok(())
}
