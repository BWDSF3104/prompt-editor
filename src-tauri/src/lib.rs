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
        .invoke_handler(tauri::generate_handler![engine])
        .setup(|app| {
            // accelerator = 一般ショートカット（menu click と同一 handler が走る）
            let open = MenuItem::with_id(app, "open", "ファイルを開く…", true, Some("Ctrl+O"))?;
            let save = MenuItem::with_id(app, "save", "保存", true, Some("Ctrl+S"))?; // 挙動は R6（判定 encoding まま）
            let index = MenuItem::with_id(app, "index", "索引を作る", true, Some("Ctrl+Shift+I"))?;
            let file = Submenu::with_items(app, "ファイル", true, &[&open, &save, &index])?;
            let settings_item = MenuItem::with_id(app, "settings", "設定を開く", true, Some("Ctrl+,"))?;
            let settings = Submenu::with_items(app, "設定", true, &[&settings_item])?;
            let run_item = MenuItem::with_id(app, "run", "展開", true, Some("F5"))?;
            let copy_item = MenuItem::with_id(app, "copy", "結果をコピー", true, Some("Ctrl+Shift+C"))?;
            let tools = Submenu::with_items(app, "ツール", true, &[&run_item, &copy_item])?;
            app.set_menu(Menu::with_items(app, &[&file, &settings, &tools])?)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().as_ref().to_string());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
