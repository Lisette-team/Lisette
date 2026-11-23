// Rich editors run in a WebView whose keyboard React Native cannot dismiss, so a tap outside one
// would leave it focused. Each editor registers its box; Screen blurs those the tap missed.
type Measurable = { measureInWindow(done: (x: number, y: number, width: number, height: number) => void): void };
type Entry = { box(): Measurable | null; blur(): void };

const editors = new Set<Entry>();

export function registerEditor(entry: Entry): () => void {
  editors.add(entry);
  return () => { editors.delete(entry); };
}

export function blurEditorsOutside(pageX: number, pageY: number) {
  for (const entry of editors) {
    entry.box()?.measureInWindow((x, y, width, height) => {
      if (pageX < x || pageX > x + width || pageY < y || pageY > y + height) entry.blur();
    });
  }
}
