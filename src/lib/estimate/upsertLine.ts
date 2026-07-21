export function upsertLine<T extends { key: string; quantity: number }>(
  lines: T[],
  key: string,
  quantity: number,
): T[] {
  const existing = lines.find((l) => l.key === key);
  if (!existing) return [...lines, { key, quantity } as T];
  return lines.map((l) => (l.key === key ? { ...l, quantity } : l));
}
