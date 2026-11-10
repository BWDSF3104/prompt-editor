# 2026-11-10: Prompt Editor の実行環境は Embeddable Python ＋ 最小依存、UI は WebView2（Tauri + Monaco）

## 決定

- Python 環境は **Embeddable Package**（約 12MB）で配布し、runtime に入るパッケージは **dynamicprompts / pyparsing / jinja2 / markupsafe の 4 本のみ**。
- pip・setuptools・pytest・PyYAML・requests・transformers・torch・spacy は runtime に入れない（PyYAML は `yaml` extra を使うときだけ）。開発用 `.venv` は配布しない。
- Python との境界は **JSON stdio の worker.py 1 本**。プロセスは engine 呼び出し時だけ spawn（pooled 1 本）、アプリ終了で kill。外部サーバー・ソケットは置かない。
- UI は **Tauri（Windows 標準 WebView2）＋ Monaco**。

## supersede する決定

- `docs/ai/decisions/2026-11-10-standalone-tkinter-prompt-editor.md`（Tkinter 案）。
  理由: Embeddable Package には tkinter が**入っていない**（CPython で意図的に省略、PyPI にも無い）。Tk を組み込むには tcl/tk DLL 写借（約 15MB）が必要で、小型化の目的と衝突する。よって GUI は WebView2/Monaco に移す。Monaco は bracket pair colorization・folding・completion・markers を標準で持つため、Tk で自前実装していた R1/R2/R3 のコードはむしろ減る。

## 追加の落とし穴（実装時確認）

- `python3xx._pth` は既定で site-packages を無効化し cwd も含まない → `Lib\site-packages`（必要なら `import site`）を追記しないと import が通らない。
- Embeddable の frozen stdlib（`python3xx.zip`）は一部の stdlib を含まない。使用は `pathlib`・`json`・dynamicprompts が必要とするものだけに限定。
- runtime とビルド機の Python メジャーバージョンを一致させる。

## 代替案（容量が問題にならない場合）

フル Python インストール ＋ Tkinter。ビルドツールチェーン（Rust・npm）不要で工程は少ないが、R1〜R3 が自前実装になり、Python 環境の容量削減目的は達成しない。

## 確定（2026-11-10 ユーザー決定）

- 優先度「機能 ＞ 容量」で **1位 = Tauri + Monaco + Embeddable Python 3.10.8（依存 4 本）** に決定。
- CodeMirror 6 は容量優先の候補として保留（選択時はこの決定の Monaco 部分を更新）。
- 前提: ビルド機に rustup ＋ MSVC toolchain（未インストール）。アプリ容量ではなくビルド機の費用。

