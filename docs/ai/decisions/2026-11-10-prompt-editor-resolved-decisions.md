# 2026-11-10: Prompt Editor — 未決 4 項目の確定

設計書: `docs/ai/reference/2026-11-10-dynamic-prompts-editor-design-spec.md`（rev3）

## 確定内容

1. **Python 版本 pin = 3.10.8**（現機一致）。site-packages copy が同一バージョンで完結し、MarkupSafe の C 拡張 ABI ずれが発生しない。追加インストール 0 本。
   - 副次: 3.10 は 2026-10 で EOL。サポート継続が必須なら 3.12 ＋ 3.12 venv に振り替える（その場合はビルド機と runtime の版本を揃える）。
2. **PyYAML は入れない**。実測（2026-11-10）: `D:\AppInstalls\stable-diffusion-webui\@wildcards` の yaml/yml/json = 0 件、txt のみ。JSON wildcard は stdlib `json` で動く。YAML を使うときだけ `yaml` extra。
3. **ネスト折りたたみは実装する（folding provider）**。`#` 見出し section fold ＋ 行をまたぐ variant span。単行 variant は fold 対象外（Monaco の fold は行単位）→ 規約として「fold を使いたい variant は独立行に書く」。
   - supersede: 「Monaco 既定 folding に委譲」案（2026-11-10 未決項目推奨）。ユーザー指定により自前 provider を採用。
4. **プロジェクト = `S:\Documents\Prompt_Editor`（新規・Kilo 管理プロジェクト）、git は local のみ**。既存 private `sd-wildcards`（wildcards 実体）と分離。検証コマンドは pytest 1 本（`.venv` 内）。

## 影響

- 実装順 M2（tokenizer ＋ folding provider ＋ markers）は Python 不要で動くまま。
- 残る前提: Tauri を使うなら rustup ＋ MSVC toolchain（未インストール）。Rust を入れたくない場合は Option B（フル Python ＋ Tkinter）へ戻る。
