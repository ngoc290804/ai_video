use crate::error::{invalid, Result};
use serde_json::{json, Value};
use std::sync::OnceLock;
pub fn validate(command: &str, payload: &Value) -> Result<()> {
    static V: OnceLock<jsonschema::Validator> = OnceLock::new();
    let v = V.get_or_init(|| {
        jsonschema::validator_for(
            &serde_json::from_str::<Value>(include_str!("../../contracts/commands.schema.json"))
                .expect("command schema"),
        )
        .expect("command schema compile")
    });
    if serde_json::to_vec(payload)?.len() > 12 * 1024 * 1024 {
        return Err(invalid("IPC payload quá lớn"));
    }
    if !v.is_valid(&json!({"command":command,"payload":payload})) {
        return Err(invalid(format!("Payload không hợp lệ cho {command}")));
    }
    Ok(())
}
