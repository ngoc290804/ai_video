use crate::error::{invalid, Result};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    sync::OnceLock,
};
pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
pub fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
pub fn hash(v: &Value) -> String {
    format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(v).unwrap_or_default())
    )
}
pub fn new_project(title: &str) -> Value {
    json!({"schemaVersion":1,"id":id(),"revision":0,"title":title,"createdAt":now(),"updatedAt":now(),"language":"vi","story":{"idea":"","synopsis":"","fullContent":"","genre":"","audience":"","style":"Điện ảnh","constraints":"","ending":"","lockedFields":[]},"video":{"targetDurationMs":60000,"durationPolicy":"target","width":1920,"height":1080,"aspectRatio":"16:9","fps":{"numerator":30,"denominator":1},"fit":"contain","backgroundColor":"#101114"},"providerBindings":{"text":null,"image":null,"video":null,"voice":null},"characters":[],"chapters":[],"scenes":[],"assets":[],"timeline":{"items":[],"audioTracks":[],"subtitles":[],"subtitleMode":"none"}})
}
pub fn array<'a>(v: &'a Value, k: &str) -> &'a Vec<Value> {
    v[k].as_array().expect("schema validated array")
}
pub fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or("")
}
pub fn n(v: &Value, k: &str) -> u64 {
    v[k].as_u64().unwrap_or(0)
}
pub fn fps(p: &Value) -> f64 {
    n(&p["video"]["fps"], "numerator") as f64 / n(&p["video"]["fps"], "denominator") as f64
}
pub fn frames(p: &Value) -> u64 {
    array(&p["timeline"], "items")
        .iter()
        .map(|v| n(v, "durationFrames") - n(&v["transitionOut"], "durationFrames"))
        .sum()
}
fn gcd(a: u64, b: u64) -> u64 {
    if b == 0 {
        a
    } else {
        gcd(b, a % b)
    }
}
pub fn validate(p: &Value) -> Result<()> {
    static VALIDATOR: OnceLock<jsonschema::Validator> = OnceLock::new();
    let validator = VALIDATOR.get_or_init(|| {
        jsonschema::validator_for(
            &serde_json::from_str::<Value>(include_str!("../../contracts/project.schema.json"))
                .expect("schema"),
        )
        .expect("schema compile")
    });
    if let Some(e) = validator.iter_errors(p).next() {
        return Err(invalid(format!("{}: {}", e.instance_path, e)));
    }
    if serde_json::to_vec(p)?.len() > 10 * 1024 * 1024 {
        return Err(invalid("Project vượt giới hạn 10 MiB"));
    }
    let mut ids = HashSet::new();
    fn unique(v: &Value, ids: &mut HashSet<String>) -> Result<()> {
        match v {
            Value::Object(o) => {
                if let Some(i) = o.get("id").and_then(Value::as_str) {
                    if uuid::Uuid::parse_str(i).is_err() || !ids.insert(i.to_owned()) {
                        return Err(invalid("ID không hợp lệ hoặc trùng"));
                    }
                }
                for x in o.values() {
                    unique(x, ids)?;
                }
            }
            Value::Array(a) => {
                for x in a {
                    unique(x, ids)?;
                }
            }
            _ => {}
        }
        Ok(())
    }
    unique(p, &mut ids)?;
    let chars: HashSet<_> = array(p, "characters").iter().map(|v| s(v, "id")).collect();
    let assets: HashMap<_, _> = array(p, "assets").iter().map(|v| (s(v, "id"), v)).collect();
    let scenes: HashSet<_> = array(p, "scenes").iter().map(|v| s(v, "id")).collect();
    let asset_ref = |value: &Value, kind: Option<&str>| -> Result<()> {
        if let Some(id) = value.as_str() {
            let a = assets
                .get(id)
                .ok_or_else(|| invalid(format!("Thiếu asset {id}")))?;
            if kind.is_some_and(|k| s(a, "kind") != k) {
                return Err(invalid("Sai loại asset"));
            }
        }
        Ok(())
    };
    let char_refs = |v: &Value| -> Result<()> {
        for i in v.as_array().into_iter().flatten() {
            if !chars.contains(i.as_str().unwrap_or("")) {
                return Err(invalid("Nhân vật không tồn tại"));
            }
        }
        Ok(())
    };
    let mut assigned = HashSet::new();
    for c in array(p, "chapters") {
        for i in array(c, "sceneIds") {
            let id = i.as_str().unwrap_or("");
            if !scenes.contains(id) || !assigned.insert(id) {
                return Err(invalid("Scene phải thuộc đúng một chapter"));
            }
        }
    }
    if assigned.len() != scenes.len() {
        return Err(invalid("Scene chưa được gán chapter"));
    }
    for c in array(p, "characters") {
        for r in array(c, "referenceAssetIds") {
            asset_ref(r, Some("image"))?;
        }
        if !c["primaryReferenceAssetId"].is_null()
            && !array(c, "referenceAssetIds").contains(&c["primaryReferenceAssetId"])
        {
            return Err(invalid("Ảnh chính phải thuộc danh sách tham chiếu"));
        }
    }
    let mut shots = HashMap::new();
    for scene in array(p, "scenes") {
        char_refs(&scene["characterIds"])?;
        for sh in array(scene, "shots") {
            shots.insert(s(sh, "id"), s(scene, "id"));
            char_refs(&sh["characterIds"])?;
            for r in array(sh, "referenceAssetIds") {
                asset_ref(r, Some("image"))?;
            }
            asset_ref(&sh["selectedImageAssetId"], Some("image"))?;
            asset_ref(&sh["selectedVideoAssetId"], Some("video"))?;
        }
        for d in array(scene, "dialogues") {
            if let Some(sp) = d["speakerId"].as_str() {
                if !chars.contains(sp) {
                    return Err(invalid("Speaker không tồn tại"));
                }
            }
            asset_ref(&d["audioAssetId"], Some("audio"))?;
        }
    }
    let rate = &p["video"]["fps"];
    if gcd(n(rate, "numerator"), n(rate, "denominator")) != 1 {
        return Err(invalid("FPS phải là phân số tối giản"));
    }
    let v = &p["video"];
    let w = n(v, "width") as f64;
    let h = n(v, "height") as f64;
    let ratio = match s(v, "aspectRatio") {
        "16:9" => Some(16.0 / 9.0),
        "9:16" => Some(9.0 / 16.0),
        "1:1" => Some(1.0),
        "4:3" => Some(4.0 / 3.0),
        _ => None,
    };
    if ratio.is_some_and(|r| (w - h * r).abs() > 2.0) {
        return Err(invalid("Kích thước không khớp tỷ lệ"));
    }
    let items = array(&p["timeline"], "items");
    for (idx, t) in items.iter().enumerate() {
        asset_ref(&t["assetId"], None)?;
        let a = assets[s(t, "assetId")];
        if !["image", "video"].contains(&s(a, "kind")) {
            return Err(invalid("Timeline cần ảnh hoặc video"));
        }
        if let Some(sc) = t["sceneId"].as_str() {
            if !scenes.contains(sc) {
                return Err(invalid("Scene timeline không tồn tại"));
            }
        }
        if let Some(sh) = t["shotId"].as_str() {
            let sc = shots.get(sh).ok_or_else(|| invalid("Shot không tồn tại"))?;
            if t["sceneId"].as_str().is_some_and(|x| x != *sc) {
                return Err(invalid("Shot không thuộc scene"));
            }
        }
        let tr = &t["transitionOut"];
        let overlap = n(tr, "durationFrames");
        if s(tr, "kind") == "cut" && overlap != 0 {
            return Err(invalid("Cut phải có 0 frame chuyển tiếp"));
        }
        if s(tr, "kind") == "crossfade"
            && (overlap == 0
                || idx + 1 == items.len()
                || overlap >= n(t, "durationFrames")
                || overlap >= n(&items[idx + 1], "durationFrames"))
        {
            return Err(invalid("Crossfade không hợp lệ"));
        }
        let before = if idx > 0 {
            n(&items[idx - 1]["transitionOut"], "durationFrames")
        } else {
            0
        };
        if before + overlap >= n(t, "durationFrames") {
            return Err(invalid("Chuyển tiếp chồng lấn quá clip"));
        }
        if s(a, "kind") == "video"
            && (n(t, "inFrame") + n(t, "durationFrames")) as f64
                > n(a, "durationMs") as f64 * fps(p) / 1000.0 + 1.0
        {
            return Err(invalid("Trim vượt thời lượng nguồn"));
        }
    }
    for t in array(&p["timeline"], "audioTracks") {
        asset_ref(&t["assetId"], Some("audio"))?;
        let a = assets[s(t, "assetId")];
        if t["loop"] != true
            && (n(t, "inFrame") + n(t, "durationFrames")) as f64
                > n(a, "durationMs") as f64 * fps(p) / 1000.0 + 1.0
        {
            return Err(invalid("Audio vượt nguồn; cần bật loop hoặc sửa duration"));
        }
    }
    for cue in array(&p["timeline"], "subtitles") {
        if n(cue, "startFrame") >= n(cue, "endFrame") {
            return Err(invalid("Phụ đề phải có end > start"));
        }
    }
    Ok(())
}
