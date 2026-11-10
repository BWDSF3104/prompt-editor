# ワイルドカード一覧の項目クリック＝editor へ挿入（2026-11-11）

**決定**: file list の項目クリックで、editor（現在アクティブな tab）のカーソル位置へ `__<name>__` を挿入する。SAKURA 系 UI のボタン挿入相当。ユーザー同意（2026-11-11 推奨に同意）。

**挙動対比**
- 現状: 項目クリック＝そのファイルを開いて tab に追加（content pane に内容表示）
- 変更後: 項目クリック＝現在アクティブな model へ `__name__` 挿入
- 開く操作はダブルクリックへ移動（内容確認・tab 追加の経路を残す。挿入だけで内容閲覧経路を失わないため）

**supersede**: `2026-11-10` の「file click → openFile（tab・content pane 表示）」UI 挙動を supersede（決定記録なしの挙動実装。tab 機能自体は維持）。

**範囲**: frontend 1 箇所（`li` の click/dbclick）。worker・正典 Python 変更なし。`wildcards.ts` の索引キャッシュをそのまま使う。挿入は model へ直接（monaco 型変換なし）。
