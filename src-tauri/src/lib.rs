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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_save_path,
            load_local_save,
            write_local_save,
            delete_local_save,
            load_meta_file,
            write_meta_file
        ])
        .run(tauri::generate_context!())
        .expect("启动峡谷经理人客户端失败");
}
