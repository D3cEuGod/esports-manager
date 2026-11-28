use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn app_data_file(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建数据目录: {e}"))?;
    Ok(dir.join(file_name))
}

fn sanitize_meta_name(name: &str) -> Result<String, String> {
    if name.is_empty() || name.len() > 64 {
        return Err("无效的配置名".into());
    }
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("配置名包含非法字符".into());
    }
    Ok(format!("{name}.json"))
}

fn atomic_write(path: &PathBuf, content: &str) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content.as_bytes()).map_err(|e| format!("写入临时文件失败: {e}"))?;
    if path.exists() {
        let _ = fs::remove_file(path);
    }
    fs::rename(&tmp, path).map_err(|e| format!("替换存档文件失败: {e}"))?;
    Ok(())
}

#[tauri::command]
fn get_save_path(app: AppHandle) -> Result<String, String> {
    let path = app_data_file(&app, "save.json")?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_local_save(app: AppHandle) -> Result<Option<String>, String> {
    let path = app_data_file(&app, "save.json")?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("读取本地存档失败: {e}"))?;
    Ok(Some(data))
}

#[tauri::command]
fn write_local_save(app: AppHandle, content: String) -> Result<(), String> {
    let path = app_data_file(&app, "save.json")?;
    atomic_write(&path, &content)
}

#[tauri::command]
fn delete_local_save(app: AppHandle) -> Result<(), String> {
    let path = app_data_file(&app, "save.json")?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("删除存档失败: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
fn load_meta_file(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let fname = sanitize_meta_name(&name)?;
    let path = app_data_file(&app, &fname)?;
    if !path.exists() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {e}"))?;
    Ok(Some(data))
}

#[tauri::command]
fn write_meta_file(app: AppHandle, name: String, content: String) -> Result<(), String> {
    let fname = sanitize_meta_name(&name)?;
    let path = app_data_file(&app, &fname)?;
    if content.is_empty() {
        if path.exists() {
            let _ = fs::remove_file(&path);
        }
        return Ok(());
    }
    atomic_write(&path, &content)
}

/// 安装形态：Windows 下 NSIS 安装版会在 exe 同目录放 uninstall.exe，绿色便携版没有。
/// 便携版不能走应用内更新（安装器会装到别处），前端据此改为直接下载。
#[tauri::command]
fn install_kind() -> String {
    if cfg!(any(target_os = "android", target_os = "ios")) {
        return "mobile".into();
    }
    if cfg!(target_os = "windows") {
        let installed = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("uninstall.exe").exists()))
            .unwrap_or(false);
        return if installed { "installed".into() } else { "portable".into() };
    }
    if cfg!(target_os = "macos") {
        return "installed".into();
    }
    "portable".into()
}

#[cfg(desktop)]
mod self_update {
    use serde::Serialize;
    use tauri::{AppHandle, Emitter};
    use tauri_plugin_updater::UpdaterExt;

    #[derive(Serialize)]
    pub struct UpdateInfo {
        version: String,
        notes: String,
    }

    #[derive(Serialize, Clone)]
    struct Progress {
        downloaded: u64,
        total: Option<u64>,
    }

    #[tauri::command]
    pub async fn check_app_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
        let updater = app.updater().map_err(|e| e.to_string())?;
        let update = updater.check().await.map_err(|e| e.to_string())?;
        Ok(update.map(|u| UpdateInfo {
            version: u.version.clone(),
            notes: u.body.clone().unwrap_or_default(),
        }))
    }

    /// 下载、校验签名并安装，完成后重启到新版本。
    #[tauri::command]
    pub async fn install_app_update(app: AppHandle) -> Result<bool, String> {
        let updater = app.updater().map_err(|e| e.to_string())?;
        let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
            return Ok(false);
        };
        let mut downloaded: u64 = 0;
        let emitter = app.clone();
        update
            .download_and_install(
                move |chunk, total| {
                    downloaded += chunk as u64;
                    let _ = emitter.emit("app-update-progress", Progress { downloaded, total });
                },
                || {},
            )
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
}

#[cfg(desktop)]
use self_update::{check_app_update, install_app_update};

#[cfg(mobile)]
#[tauri::command]
fn check_app_update() -> Result<Option<()>, String> {
    Ok(None)
}

#[cfg(mobile)]
#[tauri::command]
fn install_app_update() -> Result<bool, String> {
    Err("移动端不支持应用内更新".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    builder
        .invoke_handler(tauri::generate_handler![
            get_save_path,
            load_local_save,
            write_local_save,
            delete_local_save,
            load_meta_file,
            write_meta_file,
            install_kind,
            check_app_update,
            install_app_update
        ])
        .run(tauri::generate_context!())
        .expect("启动峡谷经理人客户端失败");
}
