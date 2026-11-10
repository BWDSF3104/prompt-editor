import * as monaco from "monaco-editor";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { TOKEN_TYPES } from "./tokenizer.ts"; // 決定: R1 は semantic tokens（Monarch 非採用）
import { foldingRanges, markers, packedData } from "./providers.ts";
import { cache, matchNames } from "./wildcards.ts";
import { callEngine } from "./bridge.ts";

// 0.57 public d.ts に semanticTokenColors なし → rules（custom token name は tokenTypeMap 経由でマッチ）
monaco.editor.defineTheme("dp", { base: "vs", inherit: true, rules: [
  { token: "variant", foreground: "0A66C2" },
  { token: "separator", foreground: "A12626" },
  { token: "weight", foreground: "2F7F4F" },
  { token: "wildcard", foreground: "7C4DFF" },
  { token: "comment", foreground: "6A737D" },
  { token: "lora", foreground: "B3582F" },
], colors: {} });
monaco.editor.setTheme("dp");

monaco.languages.register({ id: "dynamicprompt" });
monaco.languages.registerDocumentSemanticTokensProvider("dynamicprompt", {
  getLegend: () => ({ tokenTypes: [...TOKEN_TYPES], tokenModifiers: Array.from({ length: 8 }, (_, i) => `depth${i + 1}`) }),
  provideDocumentSemanticTokens(model) {
    return { data: new Uint32Array(packedData(model.getValue())) };
  },
  releaseDocumentSemanticTokens() {},
});
monaco.languages.registerFoldingRangeProvider("dynamicprompt", {
  provideFoldingRanges(model) {
    // FoldingRange は 1-based line（純関数 foldingRanges は 0-based）
    return foldingRanges(model.getValue()).map(f => ({ start: f.startLine + 1, end: f.endLine + 1 }));
  },
});
monaco.languages.registerCompletionItemProvider("dynamicprompt", {
  triggerCharacters: ["_"],
  provideCompletionItems(model, position) {
    if (cache.collections.length === 0) return { suggestions: [] }; // Python なしでは補完停止
    const word = model.getWordUntilPosition(position);
    const range = { startLineNumber: position.lineNumber, startColumn: word.startColumn, endLineNumber: position.lineNumber, endColumn: word.endColumn };
    return {
      suggestions: matchNames(word.word).map(c => ({
        label: `__${c.name}__`,
        insertText: `__${c.name}__`,
        kind: monaco.languages.CompletionItemKind.File,
        range,
      })),
    };
  },
});

const editor = monaco.editor.create(document.getElementById("editor")!, {
  value: "",
  language: "dynamicprompt",
  automaticLayout: true, // window size 追従
  'semanticHighlighting.enabled': true, // shortcut: theme 既定 false（StandaloneTheme.semanticHighlighting）、editor option で上書き
});

// keystroke ごとに full re-tokenize しない（debounce 250ms・1-pass）
let timer: number | undefined;
editor.onDidChangeModelContent(() => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const model = editor.getModel();
    if (!model) return;
    const known = new Set(cache.collections.map(c => c.name));
    monaco.editor.setModelMarkers(model, "dynamicprompt", markers(model.getValue(), known).map(m => ({
      severity: m.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      startLineNumber: m.line + 1,
      startColumn: m.col + 1,
      endLineNumber: m.line + 1,
      endColumn: m.col + 1 + m.length,
      message: m.message,
    })));
  }, 250);
});

const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
// 設定は localStorage に保存（WebView2 で起動またぎ永続）
for (const k of ["root", "seed", "count", "generator", "python"]) {
  const saved = localStorage.getItem("settings:" + k);
  if (saved) $(k).value = saved;
  $(k).addEventListener("change", () => localStorage.setItem("settings:" + k, $(k).value));
}
const settings = {
  root: () => $("root").value,
  seed: () => Number($("seed").value),
  count: () => Number($("count").value),
  generator: () => $("generator").value,
  python: () => $("python").value,
};
const status = document.getElementById("status")!;
const filelist = document.getElementById("filelist")!;
const results = document.getElementById("results")!;
let currentPath = "";
let currentEncoding = "";

async function call(req: object) {
  const resp = await callEngine(req, settings.python());
  if (resp.error) status.textContent = String(resp.error);
  return resp;
}

async function refresh() {
  const resp = await call({ command: "index", root: settings.root() });
  if (resp.error) return;
  cache.collections = resp.collections as { name: string; path: string; count: number; kind: string }[];
  filelist.innerHTML = "";
  for (const c of cache.collections) {
    const li = document.createElement("li");
    li.textContent = `${c.name} (${c.count})`;
    li.onclick = () => { // SAKURA 系: 項目クリック＝カーソル位置へ挿入（開く is double-click）
      const m = editor.getModel();
      const sel = editor.getSelection();
      if (m && sel) m.applyEdits([{ range: sel, text: `__${c.name}__`, forceMoveMarkers: true }]);
    };
    li.ondblclick = () => openFile(settings.root() ? settings.root() + "/" + c.path : c.path);
    filelist.appendChild(li);
  }
}

const files = new Map<string, { model: monaco.editor.ITextModel; encoding: string }>();
const tabs = document.getElementById("tabs")!;

function renderTabs() {
  tabs.innerHTML = "";
  for (const p of files.keys()) {
    const wrap = document.createElement("div");
    wrap.className = "tab";
    wrap.dataset.active = String(p === currentPath);
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(p === currentPath));
    b.textContent = p.split(/[\\/]/).pop() || p;
    b.onclick = () => activate(p);
    const x = document.createElement("button");
    x.type = "button";
    x.textContent = "×";
    x.setAttribute("aria-label", "閉じる");
    x.onclick = () => {
      const f = files.get(p)!;
      f.model.dispose();
      files.delete(p);
      if (p === currentPath) {
        const first = files.keys().next().value;
        if (first) { activate(first); return; }
        currentPath = "";
        status.textContent = "";
      }
      renderTabs();
    };
    wrap.append(b, x);
    tabs.appendChild(wrap);
  }
}

function activate(path: string) {
  const f = files.get(path)!;
  currentPath = path;
  currentEncoding = f.encoding;
  editor.setModel(f.model);
  status.textContent = `encoding: ${f.encoding}`; // R6: 判定値を status に表示
  renderTabs();
}

function rememberRecent(p: string) {
  const recent = JSON.parse(localStorage.getItem("recent") || "[]");
  recent.splice(recent.indexOf(p), recent.indexOf(p) >= 0 ? 1 : 0); // shortcut: indexOf -1 の splice(−1,0) は no-op
  recent.unshift(p);
  recent.length = Math.min(recent.length, 10);
  localStorage.setItem("recent", JSON.stringify(recent));
  invoke("push_recent", { path: p }).catch(() => {}); // native menu rebuild
}

async function openFile(full: string) {
  if (files.has(full)) return activate(full);
  const resp = await call({ command: "read", root: "", file: full });
  if (resp.error) return;
  const model = monaco.editor.createModel(String(resp.text), "dynamicprompt");
  files.set(full, { model, encoding: String(resp.encoding) });
  rememberRecent(full);
  activate(full);
}

const handlers: Record<string, () => void> = {
  open: async () => {
    const f = await open({ multiple: false });
    if (f) openFile(f as string);
  },
  save: async () => {
    if (!currentPath) return;
    await call({ command: "write", path: currentPath, encoding: currentEncoding, text: editor.getValue() });
  },
  index: () => refresh(),
  settings: () => {
    (document.getElementById("settingspanel") as HTMLDialogElement).showModal();
  },
  pick: async () => {
    const d = await open({ directory: true });
    if (d) {
      $("root").value = d as string;
      $("root").dispatchEvent(new Event("change")); // localStorage 保存
      refresh();
    }
  },
  run: async () => {
    const resp = await call({ command: "expand", root: settings.root(), prompt: editor.getValue(), seed: settings.seed(), count: settings.count(), generator: settings.generator() });
    if (resp.error) return;
    results.textContent = (resp.results as string[]).join("\n");
  },
  copy: async () => {
    try {
      await navigator.clipboard.writeText(results.textContent);
      status.textContent = "copied";
    } catch (e) {
      status.textContent = String(e);
    }
  },
};

$("pick").onclick = () => handlers.pick();
document.getElementById("close-settings")!.onclick = () => (document.getElementById("settingspanel") as HTMLDialogElement).close();
// 起動: 保存済み recent を native menu に再投入（Rust menu rebuild）＋ root 保存済みなら自動索引
JSON.parse(localStorage.getItem("recent") || "[]").forEach((p: string) => invoke("push_recent", { path: p }).catch(() => {}));
if (settings.root()) refresh();
// native menu event → handler。未知 id は最近使ったファイルの path（submenu id = path）とみなして開く
const dispatch = (id: string) => handlers[id] ? handlers[id]() : openFile(id);
listen("menu", (e) => dispatch(String(e.payload))).catch(() => {});
(window as unknown as Record<string, unknown>).handleMenu = dispatch;
