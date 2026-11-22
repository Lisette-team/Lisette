type Run = { text: string; italic?: boolean; bold?: boolean; underline?: boolean; strike?: boolean };
const MARKERS = { "**": "bold", "*": "italic", "__": "underline", "~~": "strike" } as const;
// Markers toggle a style on and off; a marker without a partner later in the text stays literal.
export function parseExcerpt(value: string): Run[] {
 const tokens = value.split(/(\*\*|\*|__|~~)/).filter(Boolean);
 const remaining = new Map<string, number>();
 for (const token of tokens) if (token in MARKERS) remaining.set(token, (remaining.get(token) ?? 0) + 1);
 const style: Omit<Run, "text"> = {};
 const result: Run[] = [];
 for (const token of tokens) {
  const key = MARKERS[token as keyof typeof MARKERS];
  const count = remaining.get(token) ?? 0;
  if (key) remaining.set(token, count - 1);
  if (key && (style[key] || count > 1)) { if (style[key]) delete style[key]; else style[key] = true; continue; }
  const last = result[result.length - 1];
  const same = last && (["bold", "italic", "underline", "strike"] as const).every((k) => last[k] === style[k]);
  if (same) last.text += token; else result.push({ text: token, ...style });
 }
 return result;
}
