// 構造層のみ（意味層警告は Python 正典に委譲。誤検知除外: 空 option・{0::・$$・lora・エスケープ括弧）
import { tokenize } from "./tokenizer.ts";
import type { Token } from "./tokenizer.ts";

export interface FoldRange {
  startLine: number;
  endLine: number;
}

export interface MarkerDef {
  line: number;
  col: number;
  length: number;
  message: string;
  severity: "error" | "warning";
}

export function foldingRanges(text: string): FoldRange[] {
  const tokens = tokenize(text);
  const folds: FoldRange[] = [];
  const heads = [...new Set(tokens.filter(t => t.type === "comment").map(t => t.line))].sort((a, b) => a - b);
  const lines = text.split("\n");
  let lastLine = lines.length - 1;
  while (lastLine > 0 && lines[lastLine] === "") lastLine--; // 末尾空行は section fold に含めない
  for (let i = 0; i < heads.length; i++) {
    const end = i + 1 < heads.length ? heads[i + 1] - 1 : lastLine;
    if (end > heads[i]) folds.push({ startLine: heads[i], endLine: end });
  }
  const stack: number[] = [];
  for (const t of tokens) {
    if (t.type !== "variant") continue;
    if (t.open) stack.push(t.line);
    else if (stack.length) {
      const start = stack[stack.length - 1];
      if (start < t.line) folds.push({ startLine: start, endLine: t.line }); // 単行 variant は fold 対象外
      stack.pop();
    }
  }
  return folds;
}

export function markers(text: string, known?: Set<string>): MarkerDef[] {
  const res: MarkerDef[] = [];
  const stack: Token[] = [];
  for (const t of tokenize(text)) {
    if (t.type === "variant") {
      if (t.open) stack.push(t);
      else if (stack.length) stack.pop();
      else res.push({ line: t.line, col: t.col, length: t.length, message: "対応する `{` がない `}`", severity: "error" });
    } else if (t.type === "wildcard" && known && !known.has(t.name!)) {
      res.push({ line: t.line, col: t.col, length: t.length, message: `未定義 wildcard __${t.name}__`, severity: "warning" });
    }
  }
  for (const t of stack) res.push({ line: t.line, col: t.col, length: t.length, message: "閉じられていない variant", severity: "error" });
  return res;
}
