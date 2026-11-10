# Prompt Editor

Dynamic Prompts 記法のプロンプトエディタ（Tauri + Monaco ＋ Embeddable Python engine、JSON stdio）。

## 共通規約

言語・実装開始ゲート・ターミナルセキュリティ・コマンド実行ルール・正典ツール（`bin/`）・コード検証の共通条・Memory Bank 運用・commit message 規約は global 正典 `AGENTS.md`（`C:\Users\fujim\.config\kilo\AGENTS.md`）を参照。このファイルにはプロジェクト固有項目のみ記載する（共通項目をここに書かない）。

## コード検証（本プロジェクト）

- **Python（worker・engine）変更後**: `.venv\Scripts\python -m pytest tests/ -v` で全テスト通過を確認。
- **TypeScript（frontend）変更後**: `npm run build`（typecheck は `npm run typecheck`）。
- テストはローカルファイルのみ使用（外部 API 呼出しなし）。

## Development

- Dev server: `npm run tauri dev`
- Build: `npm run tauri build`
- 実行時 Python は `runtime/python/`（Embeddable 3.10.8）。開発機と runtime の Python メジャーバージョンを一致させる。

## Code Standards

- Python source: UTF-8
- TypeScript source: UTF-8
- **ファイルエンコーディング保持（R6）**: 読み取り判定は `utf-8-sig` → `cp932` の順。保存時は判定した encoding を使う（変換しない）。BOM の有無も維持。
- 実 prompt・wildcard データは commit しない（`.gitignore`）。テスト fixture は合成データのみ。

## Documentation

- dynamicprompts: https://github.com/adieyal/dynamicprompts （`docs/SYNTAX.md`）
- Tauri v2: https://v2.tauri.app/
- Monaco: https://microsoft.github.io/monaco-editor/

## AI Memory Bank

Memory Bank のファイル構成、更新タイミング、アーカイブルール、Recovery After Interruption は `docs/ai/memory-bank-guide.md` を参照。設計仕様は `docs/ai/reference/2026-11-10-dynamic-prompts-editor-design-spec.md`（正典は Common_Operations 側）。

## Workflows

Git Workflow、Commit Checklist は `docs/ai/workflows.md` を参照。remote は public GitHub repo `BWDSF3104/prompt-editor`。

## Project Structure

```
Prompt_Editor/
├── src/                # TypeScript frontend（Monaco providers）
├── src-tauri/          # process spawn（engine プロセス管理）
├── tests/              # pytest ＋ 合成 fixture
├── runtime/python/     # ビルド時組立（gitignore）
├── .venv/              # 開発環境（gitignore）
└── docs/ai/            # AI Memory Bank
```
