# 2026-11-11 monaco core のみ import・開いていたファイルの復元

## monaco import（消費メモリ）

- `import * as monaco from "monaco-editor"`（full）は languages 定義 81 件＋contributions 59 件を起動時登録。本 app は custom language（semantic tokens）だけ使うため、full の言語登録は不要。
- 決定: `monaco-editor/editor`（core api）＋実際に使う contribution 入口のみ import。
  - folding / semanticTokens（document・viewport）/ suggest / find（Ctrl+F は editor の標準期待なので残す）
  - marker 描画・glyph margin・automaticLayout は core にある（contrib 不要）
  - 失う: hover・code action・snippet・word highlight・bracket matching・context menu・linked editing 等（contrib 59 件のうち未登録分）。必要になったら contrib 入口を 1 行追加。
- worker: custom language には language service worker 不要（provider は純関数）。full import でも dynamicprompt の worker は生成されない。

## 開いていたファイルの復元

- 決定: localStorage `open` に `{active, paths}`（path のみ）。起動時に `openFile()` で disk から再読（R6 判定は read 結果を使用）。
- 保存タイミング: `activate()` と tab close。unload ハンドラ不要（変更直後保存）。
- 未保存変更は復元しない（disk 再現）。内容保全が必要なら localStorage へ本文保存へ上げる（サイズ増）。
- 復元は `recent` にも反映される（openFile 経由）。復元専用の recent 回避は追加しない。
- storage は既存の localStorage 正典を使用（worker・Rust 変更なし）。
