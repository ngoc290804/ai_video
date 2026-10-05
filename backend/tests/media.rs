use serde_json::json;
use std::process::Command;
use studio_backend::{
    domain::{self, id},
    media,
    storage::Repository,
};
#[test]
fn real_ffmpeg_unicode_portrait_silent_mixed_sources_render_and_cache() {
    let tmp = tempfile::tempdir().unwrap();
    let src = tmp.path().join("Đầu vào ' đặc biệt.mp4");
    let silent = tmp.path().join("Nguồn dọc.mp4");
    assert!(Command::new(media::binary("ffmpeg"))
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:s=320x180:r=25:d=1",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest"
        ])
        .arg(&src)
        .status()
        .unwrap()
        .success());
    assert!(Command::new(media::binary("ffmpeg"))
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=180x320:r=24:d=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p"
        ])
        .arg(&silent)
        .status()
        .unwrap()
        .success());
    let mut repo = Repository::create(tmp.path().join("Dự án"), "Render test").unwrap();
    let a = media::import(&repo.dir, &src, "imported").unwrap();
    let b = media::import(&repo.dir, &silent, "imported").unwrap();
    let mut p = repo.snapshot.clone();
    p["video"]["width"] = json!(320);
    p["video"]["height"] = json!(180);
    p["video"]["durationPolicy"] = json!("strict");
    p["video"]["targetDurationMs"] = json!(2000);
    p["assets"] = json!([a, b]);
    p["timeline"]["items"]=json!([a,b].iter().map(|a|json!({"id":id(),"assetId":a["id"],"inFrame":0,"durationFrames":30,"transitionOut":{"kind":"cut","durationFrames":0},"sourceAudio":"keep","sourceAudioGainDb":0})).collect::<Vec<_>>());
    repo.commit(p, 0, &id()).unwrap();
    let m = media::preflight(&repo.snapshot, &repo.dir).unwrap();
    let out = tmp.path().join("Kết quả.mp4");
    media::render(&m, &repo.dir, &out, |_, _| Ok(())).unwrap();
    let probe = media::probe(&out).unwrap();
    assert!(media::duration(&probe).abs_diff(2000) <= 100);
    assert_eq!(probe["streams"][0]["width"], 320);
    assert_eq!(probe["streams"][0]["height"], 180);
    assert_eq!(probe["streams"][0]["avg_frame_rate"], "30/1");
    assert_eq!(domain::frames(&repo.snapshot), 60);
    let normalized = std::fs::read_dir(repo.dir.join("cache/normalized"))
        .unwrap()
        .filter_map(|e| {
            let p = e.ok()?.path();
            (p.extension()?.to_str()? == "mp4")
                .then_some((p.clone(), std::fs::metadata(p).ok()?.modified().ok()?))
        })
        .collect::<Vec<_>>();
    assert_eq!(normalized.len(), 2);
    let out2 = tmp.path().join("Kết quả 2.mp4");
    media::render(&m, &repo.dir, &out2, |_, _| Ok(())).unwrap();
    for (path, mtime) in normalized {
        assert_eq!(std::fs::metadata(path).unwrap().modified().unwrap(), mtime);
    }
    assert!(src.exists());
    assert!(silent.exists());
}
