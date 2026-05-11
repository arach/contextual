// Cheap, deterministic token math for the prototype. Not a real tokenizer —
// just enough fidelity that sliders, composer, and gauges feel coherent.

export function tokFor(text: string): number {
  return Math.max(1, Math.ceil((text || "").length / 4));
}

export function fmtTokens(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function sumTokens(items: Array<{ tokens?: number } | undefined | null>): number {
  return items.reduce<number>((acc, it) => acc + (it?.tokens ?? 0), 0);
}
