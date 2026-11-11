use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, Submenu};

struct Engine {
    key: String,
    child: Child,
    reader: BufReader<std::process::ChildStdout>,
}

static ENGINE: Mutex<Option<Engine>> = Mutex::new(None);
static RECENT: Mutex<Vec<String>> = Mutex::new(Vec::new()); // 最近使ったファイル（max 10）

// submenu id = path → frontend dispatch が path とみなして開く
fn build_menu<M: tauri::Manager<tauri::Wry>>(app: &M) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let open = MenuItem::with_id(app, "open", "ファイルを開く…", true, Some("Ctrl+O"))?;
    let save = MenuItem::with_id(app, "save", "保存", true, Some("Ctrl+S"))?; // 挙動は R6（判定 encoding まま）
    let saveall = MenuItem::with_id(app, "saveall", "すべて保存", true, Some("Ctrl+Shift+S"))?;
    let index = MenuItem::with_id(app, "index", "索引を作る", true, Some("Ctrl+Shift+I"))?;
    let mut recents: Vec<tauri::menu::MenuItem<tauri::Wry>> = Vec::new();
    for p in RECENT.lock().unwrap().iter() {
        let label = Path::new(p).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or(p.clone());
        recents.push(MenuItem::with_id(app, p.as_str(), &label, true, None::<&str>)?);
    }
    if recents.is_empty() {
        recents.push(MenuItem::with_id(app, "recent_none", "（なし）", false, None::<&str>)?);
    }
    let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = recents.iter().map(|h| h as &dyn tauri::menu::IsMenuItem<tauri::Wry>).collect();
    let recent_menu = Submenu::with_items(app, "最近使ったファイル", true, &refs)?;
    let file = Submenu::with_items(app, "ファイル", true, &[&open, &save, &saveall, &index, &recent_menu])?;
    let settings_item = MenuItem::with_id(app, "settings", "設定を開く", true, Some("Ctrl+,"))?;
    let settings = Submenu::with_items(app, "設定", true, &[&settings_item])?;
    let run_item = MenuItem::with_id(app, "run", "展開", true, Some("F5"))?;
    let copy_item = MenuItem::with_id(app, "copy", "結果をコピー", true, Some("Ctrl+Shift+C"))?;
    let tools = Submenu::with_items(app, "ツール", true, &[&run_item, &copy_item])?;
    Menu::with_items(app, &[&file, &settings, &tools])
}

#[tauri::command]
fn push_recent(app: tauri::AppHandle, path: String) -> Result<(), String> {
    {
        let mut r = RECENT.lock().map_err(|e| e.to_string())?;
        r.retain(|p| *p != path);
        r.insert(0, path);
        r.truncate(10);
    }
    let _ = app.set_menu(build_menu(&app).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

// 明示設定があればそのまま、なければ exe からの祖先探索（dev: .venv、配布: runtime/python）
fn resolve(explicit: &str, exe_dir: &Path, candidates: &[&str]) -> PathBuf {
    if !explicit.is_empty() {
        let p = PathBuf::from(explicit);
        if p.exists() {
            return p;
        }
    }
    let mut dir = Some(exe_dir);
    while let Some(d) = dir {
        for c in candidates {
            let p = d.join(c);
            if p.exists() {
                return p;
            }
        }
        dir = d.parent();
    }
    PathBuf::from(explicit)
}

#[tauri::command]
fn engine(request: String, python: String, worker: String) -> Result<String, String> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|e| e.parent().map(Path::to_path_buf))
        .ok_or("no exe dir")?;
    let py = resolve(&python, &exe_dir, &["python.exe", "runtime/python/python.exe", ".venv/Scripts/python.exe"]);
    let wk = resolve(&worker, &exe_dir, &["worker.py", "runtime/python/worker.py"]);
    let key = format!("{}|{}", py.display(), wk.display());
    let mut guard = ENGINE.lock().map_err(|e| e.to_string())?;
    if guard.as_ref().map(|e| e.key != key).unwrap_or(true) {
        if let Some(mut old) = guard.take() {
            let _ = old.child.kill();
        }
        // 初回 engine 呼び出しで spawn・reuse・アプリ終了で kill（常駐サーバー・ソケット不要）
        let mut cmd = Command::new(&py);
        cmd.arg(&wk).stdin(Stdio::piped()).stdout(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: Python の console 窓を見せない
        }
        let mut child = cmd.spawn().map_err(|e| format!("engine spawn failed: {e}"))?;
        let reader = BufReader::new(child.stdout.take().ok_or("no stdout")?);
        *guard = Some(Engine { key, child, reader });
    }
    let e = guard.as_mut().ok_or("no engine")?;
    let stdin = e.child.stdin.as_mut().ok_or("no stdin")?;
    stdin
        .write_all(request.as_bytes())
        .and_then(|_| stdin.write_all(b"\n"))
        .and_then(|_| stdin.flush())
        .map_err(|e| e.to_string())?;
    let mut line = String::new();
    e.reader.read_line(&mut line).map_err(|e| e.to_string())?;
    if line.is_empty() {
        return Err("engine terminated".to_string());
    }
    Ok(line.trim_end().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![engine, push_recent])
        .setup(|app| {
            app.set_menu(build_menu(&*app)?)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().as_ref().to_string());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
