import * as monaco from "monaco-editor";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { TOKEN_TYPES, tokenize } from "./tokenizer.ts"; // 決定: R1 は semantic tokens（Monarch 非採用）
import { foldingRanges, markers } from "./providers.ts";
import { cache, matchNames } from "./wildcards.ts";
import { callEngine } from "./bridge.ts";

monaco.languages.register({ id: "dynamicprompt" });
monaco.languages.registerDocumentSemanticTokensProvider("dynamicprompt", {
  getLegend: () => ({ tokenTypes: [...TOKEN_TYPES], tokenModifiers: Array.from({ length: 8 }, (_, i) => `depth${i + 1}`) }),
  provideDocumentSemanticTokens(model) {
    const data: number[] = []; // LSP packed encoding（line/char は 0-based）
    for (const t of tokenize(model.getValue())) {
      if (t.type === "text") continue; // 本文は既定色
      data.push(t.line, t.col, t.length, TOKEN_TYPES.indexOf(t.type), t.depth ? 1 << (t.depth - 1) : 0);
    }
    return { data: new Uint32Array(data) };
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
    li.onclick = () => openFile(settings.root() ? settings.root() + "/" + c.path : c.path);
    filelist.appendChild(li);
  }
}

async function openFile(full: string) {
  invoke("push_recent", { path: full }).catch(() => {}); // browser 確認（mock なし）では catch
  const resp = await call({ command: "read", root: "", file: full });
  if (resp.error) return;
  currentPath = full;
  currentEncoding = String(resp.encoding);
  status.textContent = `encoding: ${currentEncoding}`; // R6: 判定値を status に表示
  editor.setValue(String(resp.text));
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
    document.getElementById("settingspanel")!.hidden = false;
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
// native menu event → handler。未知 id は最近使ったファイルの path（submenu id = path）とみなして開く
const dispatch = (id: string) => handlers[id] ? handlers[id]() : openFile(id);
listen("menu", (e) => dispatch(String(e.payload))).catch(() => {});
(window as unknown as Record<string, unknown>).handleMenu = dispatch;
