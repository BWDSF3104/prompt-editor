# Prompt Editor 使い方

## 起動

- `prompt-editor.exe` をダブルクリック（完成品構成: exe ＋ `runtime/python`）。
- Python（`runtime/python`）がない環境では、索引・補完・展開・保存は停止します（編集・色分け・折りたたみは継続）。

## 設定（5 項目のみ）

| 項目 | 内容 |
|---|---|
| wildcardRoot | wildcards フォルダ（folder ボタンで選択） |
| seed | 展開の乱数 seed（固定すると同一結果） |
| count | 展開件数 |
| generator | random（既定）／combinatorial |
| pythonPath | 空なら自動探索（exe 祖先の `runtime/python` → `.venv`） |

## 操作

1. `folder` で wildcardRoot を選び `index` → file list に出る（name・件数）。
2. 項目をクリック → content pane に読込。status 欄に判定 encoding を表示（`utf-8-sig` → `cp932` の順）。
3. 編集後 `save` → **判定した encoding のまま保存**（変換なし・BOM 有無維持）。
4. `expand` → results 欄 → `copy`（クリップボード）。

## 記法（dynamicprompts 準拠・既定 `|`）

- `{a|b|c}` variant ／ `{0.5::a|b}` weight ／ `{2$$a|b}`・`{0-3$$a|b}` multi-select
- `__name__` wildcard（ nested 参照可・補完は case-insensitive、挿入は原文ケース）
- `#` コメント行 ／ `<lora:...>` はリテラル

折りたたみ: `#` 見出し行〜次見出し、行をまたぐ variant。単行 variant は fold 対象外（fold したい場合 variant を独立行に）。

## 制限（確定済み）

- ParserConfig で記号を変える設定は非対応。
- combinatorial は count 上限のみ（実データ規模では爆発するため使用前提外）。
- 診断は完全破損のみ Error（空 option・`{0::`・`$$`・エスケープ括弧は除外）。未定義 wildcard は warning。

## 環境

- Windows 10/11（WebView2 ランタイム依存）。
