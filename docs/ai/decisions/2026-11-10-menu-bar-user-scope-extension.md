# メニューバー追加（2026-11-10・ユーザー要求で §6 スコープ supersede）

§6 は設定 UI 非スコープ（5 項目のみ）・folder picker R4 のみ。ユーザーがメニューバーに設定・ファイル操作系を入れるよう明示要求 → supersede。

- 実装は WebView2 内メニューバー（`File` / `設定` ドロップダウン）。Tauri 原生メニューは採用しない: ネイティブメニュー項目は入力（seed・count 等）を持てず、イベント→frontend 転送の配線が増える（単一実装に不利）。
- ファイル操作追加: `ファイルを開く…`（dialog file picker。worker read は root 空 ＋ 絶対 path で可。worker 変更なし）。保存は判定 encoding まま（currentPath 絶対化）。
