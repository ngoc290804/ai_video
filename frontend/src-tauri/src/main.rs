#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::sync::Arc;
use studio_backend::{
    application::{Engine, Request},
    domain::id,
};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
async fn studio_command(
    app: tauri::AppHandle,
    engine: tauri::State<'_, Arc<Engine>>,
    command: String,
    request: Request,
) -> Result<serde_json::Value, String> {
    let state = engine.inner().clone();
    let cmd = command.clone();
    let result = tauri::async_runtime::spawn_blocking(move || state.dispatch(&cmd, request))
        .await
        .map_err(|e| e.to_string())?;
    if command == "asset_preview_path" && result["ok"] == true {
        if let Some(path) = result["data"].as_str() {
            app.asset_protocol_scope()
                .allow_file(path)
                .map_err(|e| e.to_string())?;
        }
    }
    if result["ok"] == true {
        let _ = app.emit(
            "studio.changed",
            serde_json::json!({"eventId":id(),"command":command}),
        );
    }
    Ok(result)
}
#[tauri::command]
async fn select_path(
    app: tauri::AppHandle,
    engine: tauri::State<'_, Arc<Engine>>,
    kind: String,
) -> Result<serde_json::Value, String> {
    let state = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let paths = match kind.as_str() {
            "directory" => app
                .dialog()
                .file()
                .set_title("Chọn thư mục dự án")
                .blocking_pick_folder()
                .map(|p| vec![p]),
            "file" => app
                .dialog()
                .file()
                .set_title("Chọn ảnh, video hoặc âm thanh")
                .blocking_pick_files(),
            "save" => app
                .dialog()
                .file()
                .set_title("Xuất video MP4")
                .set_file_name("phim.mp4")
                .add_filter("Video", &["mp4"])
                .blocking_save_file()
                .map(|p| vec![p]),
            _ => return Err("Invalid selection kind".to_owned()),
        };
        let mut tokens = vec![];
        for path in paths.unwrap_or_default() {
            let path = path.into_path().map_err(|e| e.to_string())?;
            tokens.push(state.grant(path, &kind).map_err(|e| e.to_string())?);
        }
        Ok(serde_json::json!(tokens))
    })
    .await
    .map_err(|e| e.to_string())?
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let root = match std::env::var_os("AI_VIDEO_STUDIO_DATA_ROOT") {
                Some(value) => {
                    let path = std::path::PathBuf::from(value);
                    if !path.is_absolute() {
                        return Err("AI_VIDEO_STUDIO_DATA_ROOT must be absolute".into());
                    }
                    path
                }
                None => app.path().home_dir()?.join("AI-Video-Studio"),
            };
            let engine = Engine::new(root)?;
            engine.start_worker();
            app.manage(engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![studio_command, select_path])
        .run(tauri::generate_context!())
        .expect("AI Video Studio launch failed");
}
