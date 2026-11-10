# R1 実装: Monarch ではなく純 tokenizer ＋ semantic tokens provider（2026-11-10）

設計書 §1 R1 は「Monarch tokenizer ＋ semantic tokens で depth 色」の 2 系統。depth 色には parser が必要で、§7 は tokenizer.ts の純関数テスト（fixture と期待 span）を要求する。純 `tokenize()` 1 本から semantic tokens provider で R1 全体（token 色＋depth modifier）を賄う単一実装 adopted。Monarch 定義は作らない。

- 副作用: R1 の色分けが semantic tokens 経由になる（Monarch の token 色テーマ設定は不要。テーマ色は §6 非スコープ）。
- 構造解析（folding/markers/completion）は同一 tokenize() 出力を共有 → 解釈差の二重実装回避。
