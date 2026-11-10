# メニューバー追加（2026-11-10・ユーザー要求で §6 スコープ supersede）

§6 は設定 UI 非スコープ（5 項目のみ）・folder picker R4 のみ。ユーザーがメニューバーに設定・ファイル操作系を入れるよう明示要求 → supersede。

- 実装は WebView2 内メニューバー（`File` / `設定` ドロップダウン）。Tauri 原生メニューは採用しない: ネイティブメニュー項目は入力（seed・count 等）を持てず、イベント→frontend 転送の配線が増える（単一実装に不利）。

## supersede（2026-11-10 同日・ユーザー指摘「Windows 一般のモノとは程遠い」）

WebView2 内 dropdown は **Tauri 原生メニューバー**（`on_menu_event`→`listen("menu")` 配線）へ変更。入力項目は除き、設定は panel（既定非表示・設定メニューで開く）維持。Python 子プロセスは `CREATE_NO_WINDOW`（0x0800_0000）で console 窓非表示。h1（プログラム名）・DOM アクションボタン行削除。エディタ `automaticLayout` ＋ flex で window size 追従。
- ファイル操作追加: `ファイルを開く…`（dialog file picker。worker read は root 空 ＋ 絶対 path で可。worker 変更なし）。保存は判定 encoding まま（currentPath 絶対化）。
