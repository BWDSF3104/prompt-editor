# 2026-11-10: Prompt Editor はスタンドアロン単体アプリ（Tkinter）＋分離 Python 環境

## 決定

- 実装形態は **単体 Python アプリ（Tkinter・標準ライブラリ）**。VS Code 拡張案は supersede。
- Python 環境はアプリフォルダ内の `.venv` で分離（外部依存は `dynamicprompts>=0.31` の 1 本のみ）。
- ワイルドカードは**フォルダを指定**して、入力補完（索引 from `WildcardManager`）と内容確認（Treeview ＋ 内容 Listbox）を行う。常駐監視・サーバーは置かない。

## supersede する決定

- 前案「独立型 VS Code 拡張（TextMate grammar / SemanticTokens / LSP-provider）」（2026-11-10、`docs/ai/reference/2026-11-10-dynamic-prompts-editor-design-spec.md`）。

## 理由

- 単体で動くことが要求された。拡張案は VS Code の機構（grammar・semantic tokens・folding・completion provider）に依存し、単体では成立しない。
- 単体で同じ 5 機能を出す最小手段は Tkinter（追加依存ゼロ）。色分け=tag、fold=mark+hide、補完=Listbox popup、管理=Treeview、コピー=clipboard。
- 展開エンジンは `dynamicprompts` をそのまま使う。パーサの再実装はしない。

## 影響

- 新規プロジェクトフォルダ `S:\Documents\Prompt_Editor`（Kilo 管理プロジェクト）。
- 正典 `bin/` にはツールを追加しない（launcher `prompt-editor.cmd` はアプリフォルダ内）。
