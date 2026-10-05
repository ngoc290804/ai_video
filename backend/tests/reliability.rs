use serde_json::json;
use studio_backend::{
    dependencies,
    domain::{self, id},
    media, planning,
    storage::Repository,
};
#[test]
fn plan_is_validated_and_does_not_modify_existing_entities() {
    let mut p = domain::new_project("Plan");
    let original = p["story"].clone();
    let plan = json!({"chapters":[{"title":"Mở đầu","summary":"Chuyến đi","scenes":[{"title":"Nhà ga","summary":"Bắt đầu","location":"Hà Nội","timeOfDay":"Sáng","mood":"Háo hức","characterNames":[],"shots":[{"description":"Nhà ga","imagePrompt":"Station","videoPrompt":"Pan left","camera":"Wide","durationSeconds":4}],"dialogues":[{"speakerName":"","text":"Một ngày mới","emotion":"Calm"}]}]}]});
    planning::append(&mut p, &plan).unwrap();
    assert_eq!(p["story"], original);
    assert_eq!(p["scenes"][0]["shots"][0]["durationFrames"], 120);
    domain::validate(&p).unwrap();
    let old_id = p["scenes"][0]["id"].clone();
    planning::append(&mut p, &plan).unwrap();
    assert_eq!(p["scenes"][0]["id"], old_id);
    assert_ne!(p["scenes"][1]["id"], old_id);
    let mut invalid = plan;
    invalid["chapters"][0]["scenes"][0]["shots"][0]["durationSeconds"] = json!(0);
    assert!(planning::validate(&invalid).is_err());
}
#[test]
fn stale_hash_changes_only_for_relevant_fields() {
    let mut p = domain::new_project("Stale");
    let target = json!({"kind":"story","field":"synopsis"});
    let before = domain::hash(&dependencies::input(&p, &target, "voice").unwrap());
    p["title"] = json!("Rename");
    p["story"]["genre"] = json!("Animation");
    assert_eq!(
        before,
        domain::hash(&dependencies::input(&p, &target, "voice").unwrap())
    );
    p["story"]["synopsis"] = json!("New words");
    assert_ne!(
        before,
        domain::hash(&dependencies::input(&p, &target, "voice").unwrap())
    );
}
#[test]
fn background_filter_injection_rejected() {
    let mut p = domain::new_project("Injection");
    p["video"]["backgroundColor"] = json!("black,scale=800:600");
    assert!(domain::validate(&p).is_err());
}
#[test]
fn fractional_fps_crossfade_subtitles_and_pause_resume() {
    use std::process::Command;
    let tmp = tempfile::tempdir().unwrap();
    let image = tmp.path().join("still.png");
    assert!(Command::new(media::binary("ffmpeg"))
        .args([
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=green:s=160x160",
            "-frames:v",
            "1"
        ])
        .arg(&image)
        .status()
        .unwrap()
        .success());
    let mut repo = Repository::create(tmp.path().join("p"), "Crossfade").unwrap();
    let a = media::import(&repo.dir, &image, "imported").unwrap();
    let mut p = repo.snapshot.clone();
    p["video"]["width"] = json!(160);
    p["video"]["height"] = json!(160);
    p["video"]["aspectRatio"] = json!("1:1");
    p["video"]["fps"] = json!({"numerator":30000,"denominator":1001});
    p["assets"] = json!([a]);
    p["timeline"]["items"]=json!((0..2).map(|i|json!({"id":id(),"assetId":a["id"],"inFrame":0,"durationFrames":30,"transitionOut":{"kind":if i==0{"crossfade"}else{"cut"},"durationFrames":if i==0{6}else{0}},"sourceAudio":"mute","sourceAudioGainDb":0})).collect::<Vec<_>>());
    p["timeline"]["subtitles"] =
        json!([{"id":id(),"startFrame":0,"endFrame":25,"text":"Tiếng Việt: Chuyến tàu mùa hè"}]);
    p["timeline"]["subtitleMode"] = json!("burn_in");
    repo.commit(p, 0, &id()).unwrap();
    let m = media::preflight(&repo.snapshot, &repo.dir).unwrap();
    let out = tmp.path().join("out.mp4");
    let paused = media::render(&m, &repo.dir, &out, |done, _| {
        if done >= 1 {
            Err(studio_backend::error::Error::new("PAUSED", "test"))
        } else {
            Ok(())
        }
    });
    assert_eq!(paused.unwrap_err().code, "PAUSED");
    assert!(!out.exists());
    media::render(&m, &repo.dir, &out, |_, _| Ok(())).unwrap();
    let probe = media::probe(&out).unwrap();
    assert_eq!(probe["streams"][0]["avg_frame_rate"], "30000/1001");
    assert!(media::duration(&probe).abs_diff(1802) <= 100);
}

#[test]
fn speaker_voice_resolution_staleness_and_speech_payload() {
    use studio_backend::{providers, voice};
    let mut p: serde_json::Value =
        serde_json::from_str(include_str!("../../examples/offline-demo/project.json")).unwrap();
    let speaker = p["characters"][0]["id"].clone();
    let binding = json!({"connectionId":id(),"modelId":"gpt-4o-mini-tts"});
    p["providerBindings"]["voice"] = binding.clone();
    p["characters"][0]["voice"] =
        json!({"binding":binding,"voiceId":"cedar","speed":1.2,"language":"vi"});
    let did = id();
    p["scenes"][0]["characterIds"] = json!([]);
    p["scenes"][0]["dialogues"] = json!([{"id":did,"speakerId":speaker,"kind":"dialogue","text":"Xin chào","startFrame":0,"emotion":"warm","pronunciationNotes":"Hà Nội"}]);
    let target = json!({"kind":"dialogue","id":did,"field":"text"});
    domain::validate(&p).unwrap();
    let before = domain::hash(&dependencies::input(&p, &target, "voice").unwrap());
    assert_eq!(voice::resolve(&p, &target)["voice"], "cedar");
    p["characters"][0]["appearance"] = json!("New outfit");
    assert_eq!(
        before,
        domain::hash(&dependencies::input(&p, &target, "voice").unwrap())
    );
    p["characters"][0]["voice"]["speed"] = json!(1.3);
    assert_ne!(
        before,
        domain::hash(&dependencies::input(&p, &target, "voice").unwrap())
    );
    p["scenes"][0]["dialogues"][0]["voiceOverride"] = json!({"binding":binding,"voiceId":"marin"});
    let mut request = voice::resolve(&p, &target);
    request["prompt"] = json!("Xin chào");
    let body = providers::speech_body("gpt-4o-mini-tts", &request).unwrap();
    assert_eq!(body["voice"], "marin");
    assert_eq!(body["speed"], 1.3);
    assert!(body["instructions"].as_str().unwrap().contains("Hà Nội"));
    request["speed"] = json!(8);
    assert!(providers::validate("voice", "gpt-4o-mini-tts", &request).is_err());
    p["characters"][0]["voice"]["speed"] = json!(0);
    assert!(domain::validate(&p).is_err());
}
