// R1 純関数（決定: docs/ai/decisions/2026-11-10-pure-tokenizer-semantic-tokens.md）。AST は作らない。
export const TOKEN_TYPES = ["variant", "separator", "weight", "wildcard", "comment", "lora", "text"] as const;
export type TokenType = (typeof TOKEN_TYPES)[number];

export interface Token {
  type: TokenType;
  depth: number; // 0..8（LSP depth1..8 クランプ）
  line: number; // 0-based
  col: number; // 0-based
  length: number;
  open?: boolean; // variant 開き括弧
  name?: string; // wildcard 名
}

const WEIGHT = /^\d+(?:[.-]\d+)?(?:\$\$|::)/;
const WILDCARD = /^__([A-Za-z0-9_]+)__/;
const LORA = /^<lora:[^>]*>/;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 0;
  let col = 0;
  let depth = 0;
  const push = (type: TokenType, length: number, extra?: Partial<Token>) => {
    out.push({ type, depth, line, col, length, ...extra });
    col += length;
    i += length;
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\n") {
      line++;
      col = 0;
      i++;
    } else if (ch === "#") {
      let j = i;
      while (j < text.length && text[j] !== "\n") j++;
      push("comment", j - i);
    } else if (ch === "\\" && i + 1 < text.length) {
      push("text", 2); // エスケープ括弧 `\(` はリテラル
    } else {
      const rest = text.slice(i);
      const lora = LORA.exec(rest);
      const wcard = lora ? null : WILDCARD.exec(rest);
      const weight = wcard || lora ? null : WEIGHT.exec(rest);
      if (lora) push("lora", lora[0].length);
      else if (wcard) push("wildcard", wcard[0].length, { name: wcard[1] });
      else if (weight) push("weight", weight[0].length);
      else if (ch === "{") {
        depth = Math.min(depth + 1, 8);
        push("variant", 1, { open: true });
      } else if (ch === "}") {
        depth = Math.max(depth - 1, 0);
        push("variant", 1, { open: false });
      } else if (ch === "|") {
        push("separator", 1);
      } else {
        push("text", 1);
      }
    }
  }
  return out;
}
