# 2026-11-11 未保存変更の (*) 表示・未保存終了時の警告

- tab label は `文件名 (*)`（SAKURA 系）。`files` に `dirty` を追加。
  - `editor.onDidChangeModelContent` で即時 true（marker の debounce 250ms とは別）。
  - `save` 成功（write に error なし）で false。開いた時点・復元時は false。
- 終了警告は `getCurrentWindow().onCloseRequested()`。
  - 未保存あり → plugin-dialog `confirm()`。Cancel → `event.preventDefault()`（窓維持）。Ok → handler が何もせず return → api が `window.destroy()`。
  - 確認済みフラグ `confirmed` で 2 回目以降は dialog を出さずに通過（destroy）。
  - `beforeunload` は使わない（WebView2 で確認 dialog が出ないため）。
- capability: plugin-dialog の `confirm()` は JS 側で `plugin:dialog|message` command を使う（戻り値 'Ok'/'Cancel' を okLabel `'Ok'` と比較）→ `dialog:allow-message` が実効。`dialog:allow-confirm` も併記。window destroy は `core:window:allow-destroy`（`core:default` には含まれない）。
- save 失敗時は dirty を解除しない。
