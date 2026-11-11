# 2026-11-11 汎用エディタ慣例の実装（承認分）

- カーソル位置の復元: `localStorage open` に `cursors`（path → `{lineNumber, column}`）追加。`onDidChangeCursorPosition` で記録、`activate()` で適用。汎用エディタの標準挙動（開いていた位置へ戻る）。
- すべて保存: native menu（`src-tauri/src/lib.rs`・id `saveall`・Ctrl+Shift+S）＋ frontend handler。dirty の分だけ write。失敗分は status に出し、dirty を残す。
- タブ閉じる時の確認: dirty タブの × で plugin-dialog confirm。Cancel → 閉じない。dirty でないタブは確認なし（汎用慣例）。
- 挿入のカンマ区切り: Easy Prompt Selector 慣例。カーソル直前がカンマ・空白・先頭なら区切りを入れない。
- wildcards 一覧の絞り込み: `#filter`（名前の部分一致・case-insensitive）。worker 変更なし。`renderFiles()` に抽出。
- 保存失敗の警告: `worker.py` の `write` で `UnicodeEncodeError` を捕まえて「{encoding} で表現できない文字があります: {char}（N 文字目）」。ファイルは書かれない（テストで確認）。既存の status 表示を使用。
- `scripts/build_runtime.ps1` 修正: `._pth` が解凍時に hidden 属性になるため `Get-ChildItem -Force`（通常 list に出ず `$pth` が null 化していた）。
- Ctrl+Tab tab cycling: `Ctrl+Tab` forward, `Ctrl+Shift+Tab` reverse; capture keydown で open tab order を循環。単一 tab は無視、active なしは順=先頭・逆=末尾。WebView2 既定では `Ctrl+Tab` 無効のため JS keydown で受ける見込みだが実効は未検証。
