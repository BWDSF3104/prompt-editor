# Prompt Editor（スタンドアロン）設計書

日付: 2026-11-10（rev2） / 種別: 開発仕様書（Kilo Code に渡す）
rev1（Tkinter）は supersede。理由は `docs/ai/decisions/2026-11-10-embeddable-python-tauri-monaco.md`。

## 0. 判定

- **Tauri（Windows 標準 WebView2）＋ Monaco フロント ＋ Embeddable Python エンジンを JSON stdio で接続**。
- **Embeddable Python には tkinter が入っていない**（CPython で意図的に省略）。Tk 組み込みは DLL 写借（约15MB）が必要なので、小型化の目的と衝突する。よって GUI は WebView2/Monaco に移す。
- 依存は実行時 **4 本のみ**（dynamicprompts / pyparsing / jinja2 ＋ markupsafe）。**PyYAML は入れない**（既存 wildcards に yaml/json 実数 0 件を 2026-11-10 実測。YAML を使うときだけ `yaml` extra）。requests / transformers / torch / spacy / pytest / pip / setuptools は配布しない。
- Python プロセスは**外部サーバーにしない**。Engine 呼び出し時だけ起動（pooled 1 本）、アプリ終了時 kill。編集操作（色分け・括弧・折りたたみ・補完）はフロントだけで完結。
- 容量が問題にならないなら、ビルドツールチェーン不要の **Option B（フル Python インストール ＋ Tkinter）**でも可。この場合 R1〜R3 は自前実装になる（`python -c` 禁止条の例外なし、コード量増）。

## 1. トレサビリティ（Monaco が提供する分／自前実装分）

| # | 機能 | 出所 | 自前コード |
|---|------|------|-----------|
| R1 | 構文色分け | Monaco Monarch tokenizer（token 別色）＋ semantic tokens で depth 色 | tokenizer 定義 |
| R2a | 括弧対応色 | Monaco 既定の bracket pair colorization | 0 |
| R2b | ネスト折りたたみ | **自前 folding provider**（Monaco 既定に委譲しない） | provider 1 関数 |
| R2c | エラー警告 | Monaco markers（構造層のみ） | provider 1 関数 |
| R3 | ワイルドカード補完 | Monaco completion provider ＋ Python 索引 | provider ＋ bridge |
| R4 | ワイルドカード管理 | フォルダピッカー ＋ ファイル一覧 ＋ 内容表示 | view ＋ bridge `index`/`read` |
| R5 | 展開プレビュー | Python engine（`RandomPromptGenerator`）＋ results 欄 ＋ コピー | bridge ＋ view |
| R6 | **ファイルエンコーディング保持** | 読み取り時に判定（`utf-8-sig` → `cp932`）、**保存時は判定した encoding で書き、変換しない**。UI の status に判定値を表示 | view ＋ bridge `write` |

## 2. アーキテクチャ

```
app/
├── src/ (TypeScript)
│   ├── tokenizer.ts      Monarch 定義（variant/separator/weight/wildcard/comment）
│   ├── providers.ts      folding / completion / markers（構造解析のみ）
│   ├── wildcards.ts      索引キャッシュ（bridge index）
│   └── ui/               folder picker, file list, content pane, results pane, copy
├── src-tauri/            process spawn（engine プロセス管理）＋ ファイル読み
└── runtime/python/       Embeddable Python（ビルド時に組立・配布物）
```

原則（rev1 から不変）：

1. フロントは**構造解析のみ**。展開意味（重み・`{2$$}`・repetition・YAML/JSON wildcard・`::backup` 継承・fallback）は Python 側が正典。意味層の警告を自前実装しない → 誤検知源を減らす。
2. ワイルドカードの存在・内容・参照は常に `WildcardManager` の結果を正典とする。
3. フロント↔Python の境界は JSON stdio の 1 契約に固定する（後から TS 完全移植できるように）。

## 3. 記法（dynamicprompts 準拠・既定 `|`）

`{a|b|c}` variant / `{0.5::a|b}` weight / `{2$$a|b}`・`{0-3$$a|b}` multi-select / `__name__` wildcard / nested wildcard / `::backup` 継承（YAML・JSON）/ `#` コメント行。
`ParserConfig` で記号を変える設定は非対応（limit: 必要時 bridge へ `parser_config` 追加）。

### R2b folding provider（採用確定・Monaco 既定には委譲しない）

- provider が返す range: (1) `#` 見出し行〜次の見出し行（section fold）、(2) **行をまたぐ variant span**。
- 単行プロンプトの variant は fold 対象にならない（Monaco の fold は行単位）。fold を使いたい場合は variant を独立行に書く規約。
- Monaco 既定 folding（comment-based）は provider で上書き。テスト fixture: multi-line variant 1 件 ＋ `#` section 1 件。

## 4. Python 環境（分離・最小）

```
runtime/python/
├── python.exe / python3xx.dll / python3xx.zip / python3xx._pth
└── Lib/site-packages/
    ├── dynamicprompts/
    ├── pyparsing/
    ├── jinja2/
    └── markupsafe/
```

- 実装用 `.venv`（pip・pytest 込み）は**配布しない**。ビルド時に開発機で `pip install dynamicprompts` し、`site-packages` の 4 ディレクトリだけを runtime へコピー。
- **Embeddable には pip が入っていない**。runtime に pip・setuptools を入れない。
- 注意点（実測済みの落とし穴）: `python3xx._pth` は既定で site-packages を無効化し、cwd も含まない。`_pth` に `Lib\site-packages` と（必要なら）`import site` を追記しないと import が通らない。
- PyYAML は `yaml` extra（任意）。YAML wildcard を使わないなら入れたくない（extra 名: `yaml`）。requests=feelinglucky、transformers=magicprompt も extra → 入れない。
- Python 版本 pin: **3.10.8**（現機一致 → site-packages copy が同一バージョンで完結、ABI ずれなし・追加インストール 0 本）。`_pth` と frozen stdlib の制約で runtime とビルド機は一致必須。サポート継続が必須なら 3.12 ＋ 3.12 venv に振り替える（3.10 は 2026-10 EOL）。

## 5. ブリッジ契約（JSON stdio）

`runtime/python/worker.py`（唯一の入口。インラインコード実行禁止条遵守：ファイルとして置き `python <file>` で呼ぶ）。

```json
{ "command": "index",  "root": "S:/wildcards" }
{ "command": "refs",   "root": "S:/wildcards", "file": "colors.txt" }
{ "command": "read",   "root": "S:/wildcards", "file": "colors.txt" }
{ "command": "write",  "path": "...", "encoding": "cp932", "text": "..." }
{ "command": "expand", "root": "S:/wildcards", "prompt": "...", "seed": 999,
  "count": 8, "generator": "random", "seeds": null }
```

index 出力: `{ "collections": [{ "name": "colors", "path": "colors.txt", "count": 12, "kind": "txt|yaml|json" }] }`

- stdin/stdout UTF-8（読みは `encoding="utf-8"`, BOM 対応で `utf-8-sig`）。stderr は警告用。
- pin: `dynamicprompts>=0.31`（wildcard weights・structured files・fallback search・variable paths が揃う最小版。現行は 0.34.x）。
- プロセス管理: 初回 engine 呼び出しで spawn、`index`/`expand` を reuse、アプリ終了で kill。常駐・外部サーバー・ソケット不要。
- Python が無い環境では R3〜R5 と R6（保存）は停止（frontend 側は解析・fold・色分けを継続）。UTF-8 フォールバック保存は R6 違反になるので使わない。
- 保存・判定は worker 側で完結させる（cp932 の符号化は TS 側で追加依存 iconv-lite を要するため、正典は Python 側）。

## 6. 設定（5 項目のみ）

`wildcardRoot`, `seed`, `count`, `generator`（random|combinatorial）, `pythonPath`。設定 UI・テーマ色・キャッシュ永続化・sampler 選択・Jinja generator・pipeline 編集は非スコープ。

## 6b. プロジェクト・検証（確定）

- 場所: `S:\Documents\Prompt_Editor`（Kilo 管理プロジェクト — AGENTS.md / .kilo / docs\ai）。git は local ＋ **public GitHub repo**（`BWDSF3104/prompt-editor`）。
- 公開リポジトリに**実データを入れない**: 実 prompt・wildcard ファイルは `.gitignore`（`fixtures/` は合成データのみ）。決定: `docs/ai/decisions/2026-11-10-prompt-editor-public-repo-and-fixture-policy.md`。
- 検証コマンド（プロジェクト AGENTS.md に記載）: pytest 1 本のみ（`.venv` 内）。正典 `bin/` にはツールを追加しない。

## 7. テスト

- `tests/test_worker.py`（pytest、開発機 `.venv` で実行）: seed 決定性（同一 seed→同一結果）、`index` の name 解決、`refs` の参照エッジ、循環参照検知、`_pth` 経由の import 可否。
- `tokenizer.ts` は純関数 → fixture `tests/fixtures/nested.prompt` と期待 span を assert。
- 手動スモーク 5 件: `__unknown__` marker / `{a|b` 括弧 marker / 補完 popup 選択 / 内容 pane 表示 / seed 固定で同一展開＋コピー。

## 8. 実装順

1. M1 worker（index/read/expand）＋ pytest
2. M2 Monaco 骨格 ＋ tokenizer ＋ folding ＋ markers（Python 不要で動く）
3. M3 completion ＋ 索引キャッシュ
4. M4 folder picker・file list・content pane・results/copy
5. M5 runtime 組立（Embeddable ＋ `_pth`）＋ `.venv`/ビルド分離

## 9. リスク

- WebView2 ランタイム依存（Windows 10/11 には既に入っているが、古い環境ではランタイム配布が必要）。Electron ほど同梱物を増やさないが、完全にゼロではない。
- Rust ツールチェーン（Tauri）がビルド機に必要。ビルド不要の Tkinter 案（Option B）より工程が多い。
- フロント tokenizer と Python パーサの解釈差 → marker は構造層に限定して抑制。
- Embeddable の frozen stdlib（`python3xx.zip`）は一部の stdlib が削られている場合がある。`pathlib`/`json` で済まない機能（`tkinter`, `pydoc`）は使わない。
- combinatorial 展開の爆発（`{a|b}`×10 = 1024）→ `count` 上限＋警告。
- 実測容量は rev1 の目標（Python 約 12MB＋4 パッケージ）をビルド後に確定する。

## 10. 実データ前提（`@Prompts_Test\tmp\All_for_ltx_nopov.txt` を 2026-11-10 実測）

計測値: 411,529 bytes / 1802 行 / **max brace depth 7** / `$$` multi-select 1702 件 / `<lora:…>` 474 件（うち `lbw=` 339）/ 空 option 1392 件 / `{0::` 26 件 / エスケープ括弧 15 件 / distinct wildcard 30 個 / multi-line variant span **1 件**。

これにより確定する実装規則:

1. **エンコーディング保持（R6・必須挙動）**: 判定は `utf-8-sig` → `cp932` の順（このファイルは cp932 で、utf-8 では読めない）。**読み取りで判定した encoding を保存時にそのまま使う（変換しない）**。BOM の有無も維持する。判定値は status 欄に表示し、ユーザーが確認できる。テスト: cp932 fixture を read → save → bytes 一致で assert。
2. **depth 色は 8 段まで**（LSP 標準 modifier depth1..8）。実測 max depth 7 なので、5 段クランプ案は不足。
3. **診断は「完全破損のみ Error」**。実データで誤検知になるパターンを明示的に除外: 空 option（`{|`, `||`, `|}`）、`{0::`（無効化の意図）、`$$` 回数レンジ、`<lora:name:1:1:lbw=...>`（tokenizer ではリテラル。`:` を weight と解釈しない）、エスケープ括弧 `\(`。
4. **folding の実効は section fold**（`#Ass to Ass End` / `#fighting_Start` 型）。実測で multi-line variant span は 1 件だけ。単行 variant（depth 7）は fold できないため、**enclosing variant span のハイライト**（カーソル位置）が実効的な代替 — 実装は markers と同じ provider で賄える。
5. **generator の既定は random**。この規模（1800 行 top-level variant・`$$` 1702）で combinatorial は爆発する。combinatorial は count cap ＋ warning のまま（実データでは使わない前提）。
6. **補完は case-insensitive match、挿入は原文ケース保持**（`__pokemonMD__`, `__furryAllnoobai_FemaleOnly__` が入り混じる）。`refs` は wildcard ファイル本文も走査（wildcard 内で `__other__` 参照が多用されている）。
7. 1802 行を keystroke ごとに full re-tokenize しない。**debounce 250ms の 1-pass 走査**で十分（411KB は軽量）。AST を作らない。

維持提案（設計には入れない・ユーザーデータ変更): `{2$$squint|…}` 同一ブロックが数十回重複 → `__facialExpressions__` 型 wildcard に寄せると補完・色分け・検索が効く。データ側の変更なのでアプリのスコープ外。
