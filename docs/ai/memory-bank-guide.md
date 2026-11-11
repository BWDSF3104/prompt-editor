# AI Memory Bank ガイド

docs/ai/ は git 追跡対象。変更履歴は git commit に委ね、docs/ai/ は「なぜ変えたか」の文脈を記録する。docs/ のエントリ・参照・AGENTS.md コメントに変更履歴や経過記録（「〜から〜へ変更」「回収」「一時 FAIL→修正」等）は書かない。現在状態の事実と根拠のみを書く。

更新タイミングは git commit 前。Memory Bank の変更はコード変更と同じ commit に含める。プロジェクト知識・状態・判断が変化した場合のみ更新する（コード変更 ≒ Memory Bank 更新ではない）。

## ファイル一覧

| ファイル・ディレクトリ | 役割 | 更新タイミング | 必須 |
|----------|------|---------------|------|
| `current-task.tsv` | アクティブタスクへの参照（TSV 3 列: task_file / status / next_action） | `task_manager add` で参照行追加・`task_manager update` で status / next_action 更新・`task_manager end` で削除。リモートタスクの受領登録（`task_manager receive`）も参照行を追加。edit ツールで直接編集しない | ✅ |
| `tasks/*.md` | タスクの個別ファイル（1タスク1ファイル方式、アクティブ・完了問わず）。意図・背景・Backlog 参照を含む | **タスク開始時に**（調査開始段階で）`task_manager add` で `docs/ai/tasks/YYYY-MM-DD-short-name.md` 作成。リモートタスクは `task_manager receive` で同じ `docs/ai/tasks/` に受領登録。**設計・方針を選定・確定したタイミングで**「調査結果 / 変更内容」セクションを更新。Status・Next Action の更新は `task_manager update`。完了時は `task_manager end` で Status 更新 | ✅ |
| `decisions/` | 設計判断ログ（1エントリ1ファイル方式） | 構造・データフロー・新しい統合の設計判断時に `decisions/YYYY-MM-DD-short-name.md` を作成 | ✅ |
| `known-issues/` | 既知問題（1エントリ1ファイル方式）。トップ=未解決、`archive/`=解決済 | 新規問題発見時に `known-issues/KI-YYYYMMDD-NN-short-name.md` を作成。解決時に `known-issues/archive/` へ `mv` | ✅ |
| `reference/` | 常設参照（今後使うメモ。1エントリ1ファイル） | 今後も参照する恒久的な事実（パス・運用・外部制限等）をここに作成。アーカイブしない（tasks/ の履歴とは区別し、tasks/ からは参照元タスクとしてリンクのみ） | ✅ |
| `backlog.md` | バックログ | 未実装項目の追加・完了時の削除 | ✅ |
| `architecture.md` | アーキテクチャ図 | decisions に記録した変更がシステム構成に反映されたときのみ更新 | ✅ |
| `tmp/` | スクラッチ置き場（使い捨てスクリプト・一時成果物） | 使用時に作成。タスク開始時のバッチクリーンアップで 7 日以上更新のないエントリを削除 | — |

## タスク管理の呼び出し（正典）

呼び出しは PATH 登録済みの `task_manager` で行う。正典は `Kilo_Commons\Common_Operations\bin\` に1本のみで、プロジェクトごとにコピーは持たない。

```text
task_manager add --slug <short-name> --title "<タスク名>"
task_manager update --task <YYYY-MM-DD-short-name> --status 進行中 --next-action "<次の作業>"
task_manager end --task <YYYY-MM-DD-short-name>
task_manager receive --file "<リモートタスクファイルのパス>"
詳細な選択肢は各サブコマンドの --help で確認する（例：task_manager receive --help）。対象プロジェクトは実行したフォルダから解決され、明示する場合は --root を使う。
```

- `add`: タスクファイルスケルトン作成と `current-task.tsv` 参照行追加
- `update`: タスクファイルの Status / Next Action 行と tsv 列の更新（`current-task.tsv` は edit ツールで直接編集しない）
- `end`: Status を完了へ更新し、tsv 参照行を削除
- `receive`: リモートタスクファイルを `docs/ai/tasks/` へ受領登録（登録成功後にのみソースファイルをゴミ箱へ送る）

## 1エントリ1ファイル方式

`decisions/`、`known-issues/`、`reference/` は各エントリを個別ファイルとして保持する。単一ファイルの集約形（`current-task.md`・`decisions.md`・`known-issues.md`・`plans.md`・`ideas.md`・`issue-inventory.md`・各 `-archive.md`）は使わない。

### ファイル名規則

| ディレクトリ | 命名規則 | 例 |
|-------------|---------|-----|
| `decisions/` | `YYYY-MM-DD-short-name.md` | `2026-11-10-prompt-editor-resolved-decisions.md` |
| `known-issues/` | `KI-YYYYMMDD-NN-short-name.md` | `KI-20261111-01-derived-project-memory-bank-guide-old-generation.md` |
| `reference/` | `YYYY-MM-DD-short-name.md` | `2026-11-10-dynamic-prompts-editor-design-spec.md` |

### ファイル内容形式

各ファイルは簡潔な Markdown で、日本語で記述する（コード・パス・技術表記は原文）。必須フィールドは `## ` タイトル行のみ。

**decisions/**: Date / Decision / Reason / Rejected Alternatives（任意）/ Impact（任意）

**known-issues/**: Date / 症状 / 原因 / 影響 / 修正方針

**tasks/**: Status / Date ＋ 意図・背景・調査結果 / 変更内容・Verification・完了時 Memory Bank 操作チェックリスト

## アーカイブルール

ステータスは**フォルダの場所**で判定する（folder = status）。

- `known-issues/`: 解決時にファイルを `known-issues/archive/` へ `mv`（1回のみ・ワークフロー手順）
- `decisions/`: 作成後は不変。修正が必要な場合は新ファイルとして追加し旧ファイルの冒頭に `**Superseded by**: <新ファイル名>` を追加
- バッチクリーンアップ（新規タスク開始時に実行）: `archive_memory_bank.py`（dry-run 既定・`--apply` で反映）。`tasks/` は tsv 未参照 AND mtime 14 日以上で `tasks/archive/` へ `mv`、`tmp/` は 7 日以上更新なしを削除
- アーカイブ操作は `kilo-safe-remove` / `kilo-safe-rmdir` 経由（**Windows ゴミ箱へ**・復元可能）。ファイル内容の編集・書き換えは行わない（`current-task.tsv` の行削除のみ例外）

## 中断からの復帰

1. `docs/ai/current-task.tsv` を読む
2. `git status` / `git diff` を確認する
3. 最後に記録されたテストの状態を検証する
4. `current-task.tsv` の `next_action` から作業を続ける
5. 明確に指示されない限り、既存の変更を破棄しない
