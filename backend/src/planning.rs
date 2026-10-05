use crate::{
    domain::{self, id, n, s},
    error::{invalid, Error, Result},
};
use serde_json::{json, Value};
pub fn schema() -> Value {
    serde_json::from_str(include_str!("../../contracts/plan.schema.json")).expect("plan schema")
}
pub fn validate(plan: &Value) -> Result<()> {
    let validator = jsonschema::validator_for(&schema()).expect("schema");
    if let Err(e) = validator.validate(plan) {
        return Err(Error::new("PROVIDER_OUTPUT_INVALID", e.to_string()));
    }
    if domain::array(plan, "chapters").is_empty() || domain::array(plan, "chapters").len() > 20 {
        return Err(invalid("Mỗi đề xuất cần 1–20 chương"));
    }
    let mut count = 0;
    for chapter in domain::array(plan, "chapters") {
        for scene in domain::array(chapter, "scenes") {
            count += 1;
            if count > 200 {
                return Err(invalid("Mỗi đề xuất tối đa 200 cảnh"));
            }
            if domain::array(scene, "shots").is_empty() || domain::array(scene, "shots").len() > 50
            {
                return Err(invalid("Cảnh cần 1–50 shots"));
            }
            for shot in domain::array(scene, "shots") {
                if !(1..=60).contains(&n(shot, "durationSeconds")) {
                    return Err(invalid("Shot phải từ 1 đến 60 giây"));
                }
            }
        }
    }
    Ok(())
}
pub fn append(p: &mut Value, plan: &Value) -> Result<()> {
    validate(plan)?;
    let rate = domain::fps(p);
    for c in domain::array(plan, "chapters") {
        let mut scene_ids = vec![];
        for sc in domain::array(c, "scenes") {
            let sid = id();
            scene_ids.push(sid.clone());
            let mut char_ids = vec![];
            for name in domain::array(sc, "characterNames") {
                let ch = domain::array(p, "characters")
                    .iter()
                    .find(|c| c["name"] == *name)
                    .ok_or_else(|| invalid(format!("Nhân vật chưa tồn tại: {name}")))?;
                char_ids.push(ch["id"].clone());
            }
            let mut shots = vec![];
            let mut duration = 0;
            for sh in domain::array(sc, "shots") {
                let seconds = n(sh, "durationSeconds");
                duration += seconds * 1000;
                shots.push(json!({"id":id(),"description":sh["description"],"characterIds":char_ids,"imagePrompt":sh["imagePrompt"],"videoPrompt":sh["videoPrompt"],"camera":sh["camera"],"durationFrames":(seconds as f64*rate).round() as u64,"referenceAssetIds":[]}));
            }
            let mut dialogues = vec![];
            for d in domain::array(sc, "dialogues") {
                let mut dialogue = json!({"id":id(),"kind":"narration","text":d["text"],"emotion":d["emotion"],"startFrame":0});
                if !s(d, "speakerName").is_empty() {
                    let character = domain::array(p, "characters")
                        .iter()
                        .find(|c| c["name"] == d["speakerName"])
                        .ok_or_else(|| invalid("Speaker không tồn tại"))?;
                    dialogue["kind"] = json!("dialogue");
                    dialogue["speakerId"] = character["id"].clone();
                }
                dialogues.push(dialogue);
            }
            p["scenes"].as_array_mut().unwrap().push(json!({"id":sid,"title":sc["title"],"summary":sc["summary"],"location":sc["location"],"timeOfDay":sc["timeOfDay"],"mood":sc["mood"],"characterIds":char_ids,"continuityNotes":"","targetDurationMs":duration,"shots":shots,"dialogues":dialogues,"lockedFields":[],"reviewStatus":"draft"}));
        }
        p["chapters"].as_array_mut().unwrap().push(
            json!({"id":id(),"title":c["title"],"summary":c["summary"],"sceneIds":scene_ids}),
        );
    }
    domain::validate(p)
}
