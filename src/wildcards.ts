// 索引キャッシュ（bridge index）。正典は WildcardManager 側の結果（worker index 経由）。
export interface Collection {
  name: string;
  path: string;
  count: number;
  kind: string;
}

export const cache: { collections: Collection[] } = { collections: [] };

// 補完は case-insensitive match、挿入は原文ケース保持（name は原文のまま）
export function matchNames(prefix: string): Collection[] {
  const p = prefix.replace(/^_+/, "").toLowerCase();
  return cache.collections.filter(c => c.name.toLowerCase().includes(p));
}
