import assert from "node:assert";
import { readFileSync } from "node:fs";
import { tokenize } from "../src/tokenizer.ts";
import type { Token } from "../src/tokenizer.ts";
import { foldingRanges, markers, packedData } from "../src/providers.ts";
import { cache, matchNames } from "../src/wildcards.ts";

const text = readFileSync(new URL("./fixtures/nested.prompt", import.meta.url), "utf8");
const tokens = tokenize(text);
const has = (type: string, pred?: (t: Token) => boolean) => tokens.some(t => t.type === type && (!pred || pred(t)));

// 期待 span（fixture nested.prompt・§7）
assert.equal(tokens.filter(t => t.type === "comment").length, 2); // # section A / # section B
// line5 はインデント 2 ＋ `{` → wildcard col3・depth2（top-level variant 内）
assert.deepEqual(tokens.find(t => t.type === "wildcard"), { type: "wildcard", depth: 2, line: 5, col: 3, length: 10, name: "colors" });
assert.equal(tokens.filter(t => t.type === "weight").length, 3); // 2$$ / 0.5:: / 0::
assert.equal(tokens.find(t => t.type === "weight")?.depth, 3); // line 2 の `2$$`
assert.ok(has("lora"));
assert.ok(tokens.some(t => t.type === "text" && t.length === 2)); // `\(` はリテラル（variant として解釈しない）

// folding: section fold ＋ 行をまたぐ variant span。単行 variant は fold 対象外
const folds = foldingRanges(text);
assert.ok(folds.some(f => f.startLine === 0 && f.endLine === 6)); // 開き `{` (line0) → 閉じ `}` (line6)
assert.ok(folds.some(f => f.startLine === 1 && f.endLine === 3)); // # section A 〜 next heading -1
assert.ok(folds.some(f => f.startLine === 4 && f.endLine === 6)); // # section B 〜 EOF
assert.ok(folds.every(f => f.startLine < f.endLine));

// markers: 完全破損のみ Error。空 option・{0::・$$・lora・エスケープ括弧は除外
assert.deepEqual(markers(text), []);
assert.equal(markers("{a|b").length, 1);

// LSP packed encoding（monaco は delta 解读。absolute だと多 token でずれる）
// `{`(d1) `|`(d1) `}`(d0) `__colors__`(d0) — text 通過。delta char は前 token start 基準
assert.deepEqual(packedData("{red|blue} __colors__"), [0, 0, 1, 0, 1, 0, 4, 1, 1, 1, 0, 5, 1, 0, 0, 0, 2, 10, 3, 0]);

// completion: case-insensitive match・挿入は原文ケース保持
cache.collections = [{ name: "colors", path: "colors.txt", count: 3, kind: "txt" }];
assert.deepEqual(matchNames("__COL").map(c => c.name), ["colors"]);

console.log("test_tokenizer: OK");
