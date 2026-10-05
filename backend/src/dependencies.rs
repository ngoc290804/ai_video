use crate::{
    application::target_value,
    domain::{self, s},
    error::{invalid, Result},
    storage,
};
use serde_json::{json, Value};
use std::{collections::HashSet, path::Path};
pub fn input(p: &Value, target: &Value, kind: &str) -> Result<Value> {
    let value = target_value(p, target)?;
    if kind == "voice" {
        return Ok(json!({"target": value, "voiceConfig": crate::voice::resolve(p, target)}));
    }
    let scene = domain::array(p, "scenes").iter().find(|sc| {
        sc["id"] == target["id"]
            || domain::array(sc, "shots")
                .iter()
                .any(|sh| sh["id"] == target["id"])
            || domain::array(sc, "dialogues")
                .iter()
                .any(|d| d["id"] == target["id"])
    });
    let chars = scene
        .map(|sc| {
            domain::array(sc, "characterIds")
                .iter()
                .filter_map(Value::as_str)
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();
    let bible=domain::array(p,"characters").iter().filter(|c|chars.contains(s(c,"id"))).map(|c|if kind=="voice"{json!({"id":c["id"],"voice":c["voice"]})}else{json!({"id":c["id"],"appearance":c["appearance"],"clothing":c["clothing"],"mannerisms":c["mannerisms"],"continuityNotes":c["continuityNotes"],"referenceAssetIds":c["referenceAssetIds"]})}).collect::<Vec<_>>();
    let shot = scene.and_then(|sc| {
        domain::array(sc, "shots")
            .iter()
            .find(|sh| sh["id"] == target["id"])
    });
    Ok(
        json!({"target":value,"binding":p["providerBindings"][kind],"characters":bible,"style":if kind=="voice"{Value::Null}else{p["story"]["style"].clone()},"shot":shot.map(|sh|json!({"camera":sh["camera"],"durationFrames":if kind=="video"{sh["durationFrames"].clone()}else{Value::Null},"referenceAssetIds":sh["referenceAssetIds"],"image":if kind=="video"{sh["selectedImageAssetId"].clone()}else{Value::Null}}))}),
    )
}
pub fn stale(p: &Value, dir: &Path, a: &Value) -> Result<bool> {
    if a["origin"] != "generated" {
        return Ok(false);
    }
    let jid = s(&a["provenance"], "jobId");
    uuid::Uuid::parse_str(jid).map_err(|_| invalid("Missing provenance job"))?;
    let job = storage::read(&dir.join("jobs").join(format!("{jid}.json")))?;
    let payload = &job["payload"];
    Ok(input(p, &payload["target"], s(payload, "kind"))
        .map(|v| domain::hash(&v) != s(&a["provenance"], "inputHash"))
        .unwrap_or(true))
}
