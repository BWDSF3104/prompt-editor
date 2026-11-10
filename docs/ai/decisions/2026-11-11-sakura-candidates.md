# SAKURA 参考の 4 件（2026-11-11・実装指示で実施）

**適用範囲**: frontend（`src/main.ts`・`index.html`・`src/styles.css`）＋ worker 1 コマンド。正典 Python の既存 5 コマンドは変更なし。

1. **プリセット（名前付き保存/読込）** — 保存先を localStorage（`presets`・JSON・max 20・同名上書き）に決定。worker へコマンドを増やさない（保存先のファイル形式を decide しないための選択）。読込＝項目クリックで editor へ挿入。管理 UI（削除・編集）は作らない。
2. **LoRA 一覧挿入** — worker に `list_loras`（接尾辞 `.safetensors`・`.pt`）を追加。LoRA フォルダは設定 6 項目目として追加（パスが分からないと一覧を作れないため）。挿入は `<lora:名前>`（重みは既存構文でユーザーが入力）。
3. **展開履歴** — メモリ配列 max 10・ファイル保存なし。項目クリックで editor へ挿入。保持期間を超える履歴は要求されていない。
4. **dark theme** — editor 限定（UI chrome は light のまま）。OS 設定（`prefers-color-scheme`）で選択。濃背景で 4.5:1 を満たす値へ調整（実測 `docs/ai/tmp/contrast.py`：light 5.69/7.45/4.92/4.81/4.82/4.82、dark 5.63/4.95/8.41/5.97/6.92/6.36）。

**supersede**: 2026-11-11 決定 `2026-11-11-wildcard-click-insert.md` の挿入メカニズムを共有ヘルパー `insert()` へ寄与（挙動は同じ）。単独リスト項目クリック＝挿入・ダブルクリック＝開くは維持。
