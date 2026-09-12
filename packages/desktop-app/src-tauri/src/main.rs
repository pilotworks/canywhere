#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|_app| {
            // Spawn Canywhere daemon in a background tokio thread
            let port = std::env::var("PORT")
                .unwrap_or_else(|_| "7890".to_string())
                .parse::<u16>()
                .unwrap_or(7890);

            tauri::async_runtime::spawn(async move {
                if let Err(e) = canywhere_server::start_daemon(port).await {
                    eprintln!("[CanywhereDaemon] Daemon exited with error: {}", e);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
