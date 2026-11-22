import { isPageRangeBody, joinExcerpt, pageRangeBody, plainText, splitExcerpt, toHtml } from "@/features/sharing/rich-text";
import { parseExcerpt } from "@/features/sharing/excerpt-text";
import { normalizeText, quotedText } from "../supabase/functions/_shared/provenance";

describe("rich text", () => {
  test("PDF selections with markers become HTML paragraphs with line breaks", () => {
    expect(toHtml("  Un *vers*\n**altul** <3\n\nDoi")).toBe("<p>&nbsp;&nbsp;Un <em>vers</em><br>"
      + "<strong>altul</strong> &lt;3</p><p>Doi</p>");
  });

  test("HTML passes through unchanged", () => {
    expect(toHtml("<p>gata <u>formatat</u></p>")).toBe("<p>gata <u>formatat</u></p>");
  });

  test("visible text ignores tags and entities", () => {
    expect(plainText("<p>a &amp; <strong>b</strong></p><p></p>")).toBe("a & b");
    expect(plainText("<p><br></p>")).toBe("");
  });

  test("underline and strikethrough markers still parse", () => {
    expect(parseExcerpt("a __b__ ~~c~~")).toEqual([{ text: "a " }, { text: "b", underline: true }, { text: " " }, { text: "c", strike: true }]);
  });

  test("the provenance check ignores every marker", () => {
    expect(normalizeText("__Unu__ ~~doi~~ **trei** *patru*")).toBe("unu doi trei patru");
  });
});

describe("PDF excerpts", () => {
  test("provenance compares only the quoted text when there is a quote", () => {
    expect(quotedText("<p>comentariul meu</p><blockquote><p>din carte</p></blockquote>")).toBe("<p>din carte</p>");
    expect(quotedText("<p>fără citat</p>")).toBe("<p>fără citat</p>");
  });
});

describe("comment and excerpt", () => {
  test("a body splits into the author's comment and the quoted excerpt, and joins back", () => {
    const body = joinExcerpt("<p>Gândul meu</p>", "<p>Rând din carte</p>");
    expect(body).toBe("<p>Gândul meu</p><blockquote><p>Rând din carte</p></blockquote>");
    expect(splitExcerpt(body)).toEqual({ comment: "<p>Gândul meu</p>", excerpt: "<p>Rând din carte</p>" });
  });

  test("empty parts are left out", () => {
    expect(joinExcerpt("<p></p>", "<p>Doar fragment</p>")).toBe("<blockquote><p>Doar fragment</p></blockquote>");
    expect(joinExcerpt("<p>Doar text</p>", "")).toBe("<p>Doar text</p>");
    expect(splitExcerpt("<p>Fără citat</p>")).toEqual({ comment: "<p>Fără citat</p>", excerpt: "" });
  });
});

describe("page shares", () => {
  test("the stored page label is recognised so the feed can hide it, the author's words are not", () => {
    expect(isPageRangeBody(pageRangeBody(3, 7))).toBe(true);
    expect(isPageRangeBody("<p>p. 12</p>")).toBe(true);
    expect(isPageRangeBody("<p>Am scris despre p. 3–7</p>")).toBe(false);
  });
});
