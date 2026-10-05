use crate::domain::{array, s};
use serde_json::{json, Value};
/// Dialogue override > speaker mapping > project defaults. Resolve on the backend
/// so queued requests and dependency hashes use the same persisted configuration.
pub fn resolve(p: &Value, target: &Value) -> Value {
    let dialogue = array(p, "scenes")
        .iter()
        .flat_map(|sc| array(sc, "dialogues"))
        .find(|d| d["id"] == target["id"]);
    let character = dialogue.and_then(|d| {
        array(p, "characters")
            .iter()
            .find(|c| c["id"] == d["speakerId"])
    });
    let mapping = character.map(|c| &c["voice"]);
    let override_voice = dialogue
        .map(|d| &d["voiceOverride"])
        .filter(|v| v.is_object());
    let config = override_voice.or(mapping.filter(|v| v.is_object()));
    json!({
        "binding": config.map(|v| &v["binding"]).unwrap_or(&p["providerBindings"]["voice"]),
        "voice": config.map(|v| s(v, "voiceId")).unwrap_or("coral"),
        "speed": mapping.and_then(|v| v["speed"].as_f64()).unwrap_or(1.0),
        "language": mapping.map(|v| s(v, "language")).filter(|v| !v.is_empty()).unwrap_or(s(p,"language")),
        "emotion": dialogue.map(|v| s(v,"emotion")).unwrap_or(""),
        "pronunciationNotes": dialogue.map(|v| s(v,"pronunciationNotes")).unwrap_or("")
    })
}
