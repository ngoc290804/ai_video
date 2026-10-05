use serde_json::json;
use std::{process::Command, time::Instant};
use studio_backend::{
    domain::{self, id},
    media,
    storage::{self, Repository},
};
#[test]
#[ignore = "30-minute benchmark; opt-in and never calls AI"]
fn thirty_minutes_two_hundred_clips() {
    let tmp = tempfile::tempdir().unwrap();
    let image = tmp.path().join("frame.png");
    assert!(Command::new(media::binary("ffmpeg"))
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=s=160x90",
            "-frames:v",
            "1"
        ])
        .arg(&image)
        .status()
        .unwrap()
        .success());
    let mut repo = Repository::create(tmp.path().join("project"), "200 scenes").unwrap();
    let a = media::import(&repo.dir, &image, "imported").unwrap();
    let mut p = repo.snapshot.clone();
    p["video"]["width"] = json!(160);
    p["video"]["height"] = json!(90);
    p["video"]["fps"] = json!({"numerator":24,"denominator":1});
    p["video"]["targetDurationMs"] = json!(1800000);
    p["video"]["durationPolicy"] = json!("strict");
    p["assets"] = json!([a]);
    let mut scene_ids = vec![];
    for i in 0..200 {
        let sid = id();
        scene_ids.push(sid.clone());
        p["scenes"].as_array_mut().unwrap().push(json!({"id":sid,"title":format!("Cảnh {i}"),"summary":"Benchmark fixture","location":"","timeOfDay":"","mood":"","characterIds":[],"continuityNotes":"","targetDurationMs":9000,"shots":[],"dialogues":[],"lockedFields":[],"reviewStatus":"draft"}));
        p["timeline"]["items"].as_array_mut().unwrap().push(json!({"id":id(),"sceneId":sid,"assetId":a["id"],"inFrame":0,"durationFrames":216,"transitionOut":{"kind":"cut","durationFrames":0},"sourceAudio":"mute","sourceAudioGainDb":0}));
    }
    p["chapters"] = json!([{"id":id(),"title":"Benchmark","summary":"","sceneIds":scene_ids}]);
    let save = Instant::now();
    repo.commit(p, 0, &id()).unwrap();
    let save_ms = save.elapsed().as_millis();
    let dir = repo.dir.clone();
    drop(repo);
    let start = Instant::now();
    let repo = Repository::open(dir).unwrap();
    let open_ms = start.elapsed().as_millis();
    let start = Instant::now();
    let manifest = media::preflight(&repo.snapshot, &repo.dir).unwrap();
    let out = tmp.path().join("30-min.mp4");
    let result = media::render(&manifest, &repo.dir, &out, |_, _| Ok(())).unwrap();
    let wall = start.elapsed().as_secs_f64();
    assert!(result["durationMs"].as_u64().unwrap().abs_diff(1800000) <= 100);
    assert_eq!(domain::frames(&repo.snapshot), 43200);
    let report = json!({"platform":std::env::consts::OS,"frames":43200,"clips":200,"durationMs":result["durationMs"],"wallSeconds":wall,"openMs":open_ms,"saveMs":save_ms,"profile":"160x90 24fps synthetic still; not a 1080p performance claim","outputBytes":std::fs::metadata(out).unwrap().len()});
    println!("{report}");
    storage::atomic(
        std::path::Path::new("../docs/benchmark-200-clips.json"),
        &report,
    )
    .unwrap();
}
#[test]
#[ignore = "20+10 minute real A/V merge acceptance fixture"]
fn merge_twenty_plus_ten_minutes_with_av_markers() {
    let tmp = tempfile::tempdir().unwrap();
    let mut repo = Repository::create(tmp.path().join("merge"), "20 + 10 phút").unwrap();
    let mut p = repo.snapshot.clone();
    p["video"]["width"] = json!(160);
    p["video"]["height"] = json!(90);
    p["video"]["fps"] = json!({"numerator":24,"denominator":1});
    p["video"]["targetDurationMs"] = json!(1800000);
    p["video"]["durationPolicy"] = json!("strict");
    for (index, seconds, color, hz) in [(0, 1200, "red", 440), (1, 600, "blue", 880)] {
        let source = tmp.path().join(format!("Nguồn {index}.mp4"));
        assert!(Command::new(media::binary("ffmpeg"))
            .args([
                "-v",
                "error",
                "-y",
                "-f",
                "lavfi",
                "-i",
                &format!("color=c={color}:s=160x90:r=5:d={seconds}"),
                "-f",
                "lavfi",
                "-i",
                &format!("sine=frequency={hz}:sample_rate=48000:duration={seconds}"),
                "-c:v",
                "libx264",
                "-preset",
                "ultrafast",
                "-c:a",
                "aac",
                "-shortest"
            ])
            .arg(&source)
            .status()
            .unwrap()
            .success());
        let a = media::import(&repo.dir, &source, "imported").unwrap();
        p["timeline"]["items"].as_array_mut().unwrap().push(json!({"id":id(),"assetId":a["id"],"inFrame":0,"durationFrames":seconds*24,"transitionOut":{"kind":"cut","durationFrames":0},"sourceAudio":"keep","sourceAudioGainDb":0}));
        p["assets"].as_array_mut().unwrap().push(a);
    }
    repo.commit(p, 0, &id()).unwrap();
    let m = media::preflight(&repo.snapshot, &repo.dir).unwrap();
    let out = tmp.path().join("30 phút có âm thanh.mp4");
    let start = Instant::now();
    let result = media::render(&m, &repo.dir, &out, |_, _| Ok(())).unwrap();
    assert!(result["durationMs"].as_u64().unwrap().abs_diff(1800000) <= 100);
    for (t, expected) in [
        (0.5, 440.0),
        (1199.9, 440.0),
        (1200.1, 880.0),
        (1799.5, 880.0),
    ] {
        let rgb = Command::new(media::binary("ffmpeg"))
            .args(["-v", "error", "-ss", &t.to_string(), "-i"])
            .arg(&out)
            .args([
                "-frames:v",
                "1",
                "-vf",
                "scale=1:1",
                "-f",
                "rawvideo",
                "-pix_fmt",
                "rgb24",
                "-",
            ])
            .output()
            .unwrap();
        assert!(rgb.status.success());
        assert!(rgb.stdout.len() >= 3);
        if expected == 440.0 {
            assert!(rgb.stdout[0] > 180 && rgb.stdout[2] < 70);
        } else {
            assert!(rgb.stdout[2] > 180 && rgb.stdout[0] < 70);
        }
        let pcm = Command::new(media::binary("ffmpeg"))
            .args(["-v", "error", "-ss", &t.to_string(), "-i"])
            .arg(&out)
            .args([
                "-t", "0.08", "-map", "0:a:0", "-ac", "1", "-ar", "8000", "-f", "f32le", "-",
            ])
            .output()
            .unwrap();
        assert!(pcm.status.success());
        let samples = pcm
            .stdout
            .chunks_exact(4)
            .map(|b| f32::from_le_bytes(b.try_into().unwrap()) as f64)
            .collect::<Vec<_>>();
        let power = |hz: f64| {
            let (re, im) = samples
                .iter()
                .enumerate()
                .fold((0.0, 0.0), |(re, im), (i, x)| {
                    let a = 2.0 * std::f64::consts::PI * hz * i as f64 / 8000.0;
                    (re + x * a.cos(), im + x * a.sin())
                });
            re * re + im * im
        };
        assert!(
            power(expected) > 10.0 * power(if expected == 440.0 { 880.0 } else { 440.0 }),
            "Audio marker mismatch at {t}"
        );
    }
    let report = json!({"sourceDurationsSeconds":[1200,600],"actualDurationMs":result["durationMs"],"wallSeconds":start.elapsed().as_secs_f64(),"profile":"160x90 24fps output; 5fps red/440Hz and blue/880Hz sources","avMarkerSamplesSeconds":[0.5,1199.9,1200.1,1799.5],"avMarkerChecks":"passed: color and frequency before/after boundary at ±100ms and first/last samples"});
    println!("{report}");
    storage::atomic(
        std::path::Path::new("../docs/benchmark-merge-30min.json"),
        &report,
    )
    .unwrap();
}
