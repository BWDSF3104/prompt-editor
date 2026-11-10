# Prompt Editor 実装前準備（スキャフォールド・fixture・開発環境）

**Status**: 完了
**Date**: 2026-11-10
**Next Action**: Tauri scaffold（npm create tauri-app）＋ worker.py 実装（M1）→ pytest

## 意図 / 背景

設計（正典は `S:\Documents\Kilo_Commons\Common_Operations\docs\ai\reference\2026-11-10-dynamic-prompts-editor-design-spec.md`）を Tauri + Monaco ＋ Embeddable Python（1位）で確定した。実装開始前の準備として、スキャフォールド・fixture・分離 Python 環境・remote を整える。

## 調査結果 / 変更内容

- `S:\Documents\Prompt_Editor` を `docs_template` から作成。AGENTS.md に検証コマンドと R6（エンコーディング保持）を記載。
- `.gitignore`: `.venv/`、`runtime/`、実 prompt・wildcard データ（`data/`）を除外。fixture は残す。
- `.gitattributes`: `tests/fixtures/** -text`（cp932 fixture のバイト列を保持）。
- fixture（合成データのみ・実データなし）: `tests/fixtures/nested.prompt`（multi-line variant・`#` section・`$$`・weight・空 option・lora token）、`tests/fixtures/wildcards/` 4 本（nested 参照・循環参照）、`tests/fixtures/cp932.prompt`（33 bytes・cp932）。
- public GitHub repo `BWDSF3104/prompt-editor` を作成し push（https://github.com/BWDSF3104/prompt-editor）。

## 調査結果 / 変更内容（2026-11-10 M1 実装）

- `worker.py`（JSON stdio・唯一の入口）をリポジトリ直下に実装。正典源は commit 必須のため gitignore 済みの `runtime/python/` には置けない → ビルド時（M5）に runtime へコピー。design §5 の 5 コマンド（index/refs/read/write/expand）を最小実装（§7 テストが refs 循環検知・cp932 round-trip を要求するため write/refs も M1 で含めた）。
  - 0.34.1 の `WildcardManager` は `load()` 非搭載 → `get_collection_names()`/`get_values()`/`read_text()` を使用。
  - `seeds`（複数 seed）未対応（shortcut: 必要時まで seed のみ）。count 上限警告は UI 側（M4）。
- `tests/test_worker.py`（§7 の 5 項目中 4 項目対応。`_pth` 経由 import 検証は runtime 組立後=M5 まで保留）。
- Tauri scaffold（vanilla-ts・npm）を一時フォルダで生成 → プロジェクト直下へ移動（既存 README.md との競合回避・root の .gitignore 正典維持）。`src/main.ts`/`index.html`/`src-tauri/`（Cargo.toml・tauri.conf.json・main.rs・icons）導入。

## Verification

- `.venv`（Python 3.10.8）＋ pip 結果: dynamicprompts 0.34.1 / pyparsing 3.3.3 / Jinja2 3.1.6 / MarkupSafe 3.0.4。PyYAML 未インストール（決定どおり）。
- **pytest: 5 passed（2026-11-10）**: seed 決定性 / index name 解決 / refs 参照エッジ / 循環参照検知 / cp932 read→write→bytes 一致。`.venv` に pytest 導入済み（当初未インストール）。実装中の修正: `handle()` の `req["root"]` が write 契約（root なし）で KeyError → `req.get` 化、循環 DFS の `if not seen` → `if n not in seen`。
- JSON stdio 実プロセス疎通: `docs/ai/tmp/stdio_probe.jsonl`（index＋expand）→ JSON 2 行正しく返答。
- scaffold: `npm install` 成功、`npm run build`（tsc＋vite）成功（7 modules・60ms）。cargo 側（Tauri 依存のフルビルド）は未実行（M2 で確認）。
- cp932 fixture 生成: 33 bytes（`docs/ai/tmp/make_cp932_fixture.py`）。
- push 成功: `* [new branch] HEAD -> main`、tracking 設定済み。
- 未実行: pytest（コード未実装）。
- Rust toolchain（導入済み）: rustup 1.29.3 ＋ `stable-x86_64-pc-windows-msvc`（cargo 1.99.1）。
- **Visual Studio は既存**（vswhere: `C:\Program Files\Microsoft Visual Studio\18\Community`、VS2019 Community の MSVC 14.29.30133、`Windows Kits\10`）→ 二重インストールなし。
- 疎通確認: `$env:TEMP\kilo\linkcheck` で `cargo build` 成功（link.exe と SDK が使えることを確認）。

## 完了時 Memory Bank 操作

- [ ] `current-task.tsv` の参照行を削除
- [ ] 解決した `known-issues/` ファイルを `known-issues/archive/` へ `mv`（該当する場合）
- [ ] `backlog.md` の完了項目を削除（該当する場合）
