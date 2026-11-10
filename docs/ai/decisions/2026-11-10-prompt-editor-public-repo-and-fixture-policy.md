# 2026-11-10: Prompt Editor は public GitHub repo ＋ 実データを commit しない

## 決定

- git は local ＋ **public GitHub repo**（`BWDSF3104/prompt-editor`）。
- **実データは commit しない**: 実 prompt ファイル・wildcard ファイルは `.gitignore` 対象。テスト fixture は内容を持たない合成データ（括弧・section・nested 参照の構造だけ）。

## 理由

- public repo は誰でも閲覧できる。対象 prompt（例: `@Prompts_Test\tmp\All_for_ltx_nopov.txt`）は個人作業の内容であり、wildcard 名（30 個）は運用資産で private repo `sd-wildcards` と分離済み。
- fixture に実ファイルを置くと、コードリポジトリに内容物が載る。構造テストは合成 fixture で足りる。
- 保存・encoding 判定（R6）に実ファイル不要 — cp932 fixture は日本語 1 行だけの合成ファイルで検証できる。

## 影響

- `.gitignore` に prompt / wildcards データと `.venv`、`runtime/` を記載。
- README に「実データは同梱しない」を 1 行書く。
- 秘密情報（token 等）は書かない（global 正典の Remote Tasks 条と同じ規則）。
