import { BOOK_TEXT_JS } from "@/features/manuscripts/book-text";

type Item = { str: string; x: number; y: number; h: number; w?: number };
type Source = { page: number; width?: number; items: Item[] };
type Block = { text: string; page: number; indent: number; heading: boolean; center: boolean; gap: boolean };
const buildParagraphs = new Function(`${BOOK_TEXT_JS}; return buildParagraphs;`)() as (pages: Source[]) => Block[];

// A page 400 wide with text from x 20 to 380, lines 14 apart going down. A line runs to the right
// margin unless `short`; `indent` moves its start right (in points); `skip` leaves blank lines above.
type Line = string | { text: string; indent?: number; short?: boolean; h?: number; skip?: number; center?: boolean };
const page = (number: number, lines: Line[]) => {
  let y = 700;
  return {
    page: number,
    width: 400,
    items: lines.map((line, index) => {
      const value = typeof line === "string" ? { text: line } : line;
      if (index) y -= 14 * (1 + (value.skip ?? 0));
      const x = value.center ? 150 : 20 + (value.indent ?? 0);
      const end = value.center ? 250 : value.short ? x + 120 : 380;
      return { str: value.text, x, y, h: value.h ?? 10, w: end - x };
    }),
  };
};
const texts = (blocks: Block[]) => blocks.map((block) => block.text);

describe("Text mode keeps the page's shape", () => {
  test("lines that reach the margin flow together; a split word is rejoined", () => {
    const result = buildParagraphs([page(1, [{ text: "Era o dimineață lungă și pre-", indent: 20 }, "lungită, iar orașul", { text: "dormea.", short: true }])]);
    expect(texts(result)).toEqual(["Era o dimineață lungă și prelungită, iar orașul dormea."]);
    expect(result[0].indent).toBe(2);
  });

  test("a line that stops short keeps its line break", () => {
    const result = buildParagraphs([page(1, [{ text: "Primul vers,", short: true }, { text: "al doilea vers,", short: true }, { text: "al treilea.", short: true }])]);
    expect(texts(result)).toEqual(["Primul vers,", "al doilea vers,", "al treilea."]);
    expect(result.every((block) => block.indent === 0)).toBe(true);
  });

  test("each indent is kept at its own depth", () => {
    const result = buildParagraphs([page(1, [{ text: "Fără retragere.", short: true }, { text: "Retras puțin.", indent: 20, short: true }, { text: "Retras mult.", indent: 60, short: true }])]);
    expect(result.map((block) => block.indent)).toEqual([0, 2, 6]);
  });

  test("a blank line between blocks is kept", () => {
    const result = buildParagraphs([page(1, [{ text: "Sfârșit de scenă.", short: true }, { text: "Scena următoare.", short: true, skip: 1 }])]);
    expect(result.map((block) => block.gap)).toEqual([false, true]);
  });

  test("centred lines and headings stay apart and centred", () => {
    const result = buildParagraphs([page(3, [{ text: "Capitolul doi", h: 16, center: true }, { text: "* * *", center: true }, "Totul a început aici,", { text: "și a continuat.", short: true }])]);
    expect(result.map((block) => [block.text, block.heading, block.center])).toEqual([
      ["Capitolul doi", true, true],
      ["* * *", false, true],
      ["Totul a început aici, și a continuat.", false, false],
    ]);
    expect(result[2].page).toBe(3);
  });

  test("ragged-right text still flows: a line ends early only because the next word did not fit", () => {
    const line = (text: string, y: number, end: number) => ({ str: text, x: 20, y, h: 10, w: end - 20 });
    const items = [
      line("closed and hold the and was grey bookshop past its waited the", 700, 350),
      line("seemed past the river its city bridge to the while.", 686, 300),
      line("Short.", 672, 60),
      line("Next line.", 658, 90),
    ];
    expect(texts(buildParagraphs([{ page: 1, width: 400, items }]))).toEqual([
      "closed and hold the and was grey bookshop past its waited the seemed past the river its city bridge to the while.",
      "Short.",
      "Next line.",
    ]);
  });

  test("a heading placed off-centre is not indented", () => {
    const result = buildParagraphs([page(1, [{ text: "Capitolul 1", h: 16, indent: 100, short: true }, "Un rând de text.", "Încă un rând.", { text: "Gata.", short: true }])]);
    expect(result[0]).toMatchObject({ heading: true, indent: 0 });
  });

  test("a Romanian hyphenated word keeps its hyphen across the line break", () => {
    const result = buildParagraphs([page(1, ["A intrat într-", { text: "un oraș mic.", short: true }])]);
    expect(result[0].text).toBe("A intrat într-un oraș mic.");
  });

  test("page numbers are dropped and text that reaches the margin carries over to the next page", () => {
    const result = buildParagraphs([page(1, ["Ea a deschis ușa și", { text: "12", center: true }]), page(2, [{ text: "a ieșit în ploaie.", short: true }, { text: "- 13 -", center: true }])]);
    expect(texts(result)).toEqual(["Ea a deschis ușa și a ieșit în ploaie."]);
  });

  test("a page that starts indented starts a new block", () => {
    const result = buildParagraphs([page(1, ["Un rând plin până la margine"]), page(2, [{ text: "Alt paragraf.", indent: 20, short: true }])]);
    expect(texts(result)).toEqual(["Un rând plin până la margine", "Alt paragraf."]);
  });

  test("a wide gap inside a line stays as a tab, a narrow one as a space", () => {
    const items = [
      { str: "Nume:", x: 20, y: 700, h: 10, w: 30 },
      { str: "Ana", x: 90, y: 700, h: 10, w: 20 },
      { str: "Pop", x: 113, y: 700, h: 10, w: 20 },
    ];
    expect(buildParagraphs([{ page: 1, items }])[0].text).toBe("Nume:    Ana Pop");
  });
});
