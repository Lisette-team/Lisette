import { coverColumns } from "@/features/sharing/formatting";
import { pdfTextReconstruction } from "@/features/manuscripts/pdf-text";
const reconstructPdfText = new Function(`${pdfTextReconstruction}; return reconstructPdfText;`)();
import { render, screen } from "@testing-library/react-native";
import { parseExcerpt } from "@/features/sharing/excerpt-text";

test("cover columns adapt to available width", () => {
 expect(coverColumns(320)).toBe(3);
 expect(coverColumns(700)).toBe(6);
});

test("reconstructs indented verse, paragraph gaps and italic runs", () => {
 expect(reconstructPdfText([
  { str: "First verse", transform: [10, 0, 0, 10, 10, 100], height: 10, fontName: "regular" },
  { str: "Second ", transform: [10, 0, 0, 10, 30, 88], height: 10, fontName: "regular" },
  { str: "verse", transform: [10, 0, 0, 10, 65, 88], height: 10, fontName: "Italic" },
  { str: "New paragraph", transform: [10, 0, 0, 10, 10, 65], height: 10, fontName: "regular" },
 ])).toBe("First verse\n  Second *verse*\n\nNew paragraph");
});

test("parses bold and italic runs while preserving whitespace", () => {
 expect(parseExcerpt("  One *two*\n\n**three**")).toEqual([{ text: "  One " }, { text: "two", italic: true }, { text: "\n\n" }, { text: "three", bold: true }]);
});

