// Pure parts of the library: ISBN checks, the scanner gate and the Open Library client. The client is
// tested with recorded responses (tests/fixtures) and fake fetches; no test calls the live API.
import { createScanGate } from "@/features/library/scan-gate";
import { classifyBarcode, isValidIsbn10, isValidIsbn13, toIsbn13 } from "@/features/library/isbn";
import { colors } from "@/ui/theme";
import { toggleColors } from "@/ui/toggle";

import { isIsbn13, lookupOpenLibrary, parseSearch } from "../supabase/functions/_shared/open-library";
import found from "./fixtures/open-library-search-found.json";
import unknown from "./fixtures/open-library-search-unknown.json";

describe("ISBN checksums", () => {
  test.each(["9780140328721", "9780306406157", "9786069999127"])("%s is a valid ISBN-13", (isbn) => {
    expect(isValidIsbn13(isbn)).toBe(true);
  });

  test.each([
    ["9780140328722", "wrong check digit"],
    ["9770140328721", "not in the 978/979 book range"],
    ["978014032872", "too short"],
    ["97801403287211", "too long"],
    ["978014032872a", "not digits"],
    ["４９７８０１４０３２８７２１".slice(0, 13), "non-ASCII digits"],
  ])("%s is refused (%s)", (isbn) => {
    expect(isValidIsbn13(isbn)).toBe(false);
  });

  test("ISBN-10 uses a mod-11 check digit, with X for ten", () => {
    expect(isValidIsbn10("0140328726")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("080442957x")).toBe(true);
    expect(isValidIsbn10("0140328727")).toBe(false);
    expect(isValidIsbn10("X140328726")).toBe(false);
  });

  test("toIsbn13 accepts hyphens and spaces and converts ISBN-10", () => {
    expect(toIsbn13("978-0-14-032872-1")).toBe("9780140328721");
    expect(toIsbn13(" 978 0306 40615 7 ")).toBe("9780306406157");
    expect(toIsbn13("0-14-032872-6")).toBe("9780140328721");
    expect(toIsbn13("0-8044-2957-X")).toBe("9780804429573");
  });

  test("toIsbn13 gives null for anything that is not a valid ISBN", () => {
    expect(toIsbn13("")).toBeNull();
    expect(toIsbn13("978-0-14-032872-2")).toBeNull();
    expect(toIsbn13("0140328727")).toBeNull();
    expect(toIsbn13("4006381333931")).toBeNull();
  });
});

describe("barcode classification", () => {
  test("a book code with a valid check digit is an ISBN", () => {
    expect(classifyBarcode("9780140328721")).toEqual({ kind: "isbn", isbn: "9780140328721" });
    expect(classifyBarcode("9786069999127")).toEqual({ kind: "isbn", isbn: "9786069999127" });
  });

  test("an ISMN (9790, printed music) is not a book's ISBN", () => {
    expect(classifyBarcode("9790060115615")).toEqual({ kind: "not_isbn" });
    expect(isValidIsbn13("9790060115615")).toBe(false);
    expect(toIsbn13("979-0-060-11561-5")).toBeNull();
  });

  test("a 978/979 code with a wrong check digit could not be read", () => {
    expect(classifyBarcode("9780140328722")).toEqual({ kind: "unreadable" });
  });

  test.each([
    ["4006381333931", "EAN-13 outside the book range"],
    ["0036000291452", "UPC-A read as EAN-13"],
    ["96385074", "EAN-8"],
    ["036000291452", "UPC-A"],
    ["04252614", "UPC-E"],
    ["425261", "UPC-E without system digit"],
  ])("%s is a product code, not an ISBN (%s)", (code) => {
    expect(classifyBarcode(code)).toEqual({ kind: "not_isbn" });
  });

  test("anything else could not be read", () => {
    expect(classifyBarcode("")).toEqual({ kind: "unreadable" });
    expect(classifyBarcode("ABC123")).toEqual({ kind: "unreadable" });
    expect(classifyBarcode("12345")).toEqual({ kind: "unreadable" });
  });
});

describe("switch colours", () => {
  test("the off state has a visible track and thumb on light sheets, on every platform", () => {
    expect(toggleColors.trackColor.false).toBe(colors.line);
    expect(toggleColors.ios_backgroundColor).toBe(colors.line);
    expect(toggleColors.trackColor.true).toBe(colors.burgundy);
    expect(toggleColors.thumbColor).toBe(colors.paper);
  });
});

describe("scanner gate", () => {
  test("only the first of repeated scanner callbacks is handled", () => {
    const gate = createScanGate();
    expect(gate.accept("9780140328721")).toBe(true);
    expect(gate.accept("9780140328721")).toBe(false);
    expect(gate.accept("9780306406157")).toBe(false);
  });

  test("after a reset the next scan is handled again", () => {
    const gate = createScanGate();
    gate.accept("9780140328721");
    gate.reset();
    expect(gate.accept("9780140328721")).toBe(true);
  });
});

describe("Open Library client", () => {
  test("the Edge Function accepts the same ISBN-13 as the app", () => {
    for (const isbn of ["9780140328721", "9780140328722", "9770140328721", "978-0140328721", "9790060115615"]) {
      expect(isIsbn13(isbn)).toBe(isValidIsbn13(isbn));
    }
  });

  const okResponse = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  test("reads title, authors, publisher and edition ID from a recorded answer", () => {
    expect(parseSearch(found)).toEqual({
      title: "Fantastic Mr. Fox",
      authorNames: ["Roald Dahl"],
      publisherName: "Puffin",
      externalId: "OL7353617M",
    });
  });

  test("an empty answer is not a book", () => {
    expect(parseSearch(unknown)).toBeNull();
    expect(parseSearch({ docs: [{ key: "/works/OL1W" }] })).toBeNull();
    expect(parseSearch("nonsense")).toBeNull();
  });

  test("asks the search API by ISBN with a generic User-Agent", async () => {
    const fetch = jest.fn(() => okResponse(found));
    const result = await lookupOpenLibrary("9780140328721", { baseUrl: "https://ol.test", fetch });

    expect(result).toEqual({ status: "found", book: expect.objectContaining({ title: "Fantastic Mr. Fox" }) });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith("https://ol.test/search.json?")).toBe(true);
    expect(new URL(url).searchParams.get("isbn")).toBe("9780140328721");
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^Lisette\//);
  });

  test("an unknown ISBN is not_found and nothing is invented", async () => {
    const result = await lookupOpenLibrary("9786069999127", { baseUrl: "https://ol.test", fetch: () => okResponse(unknown) });
    expect(result).toEqual({ status: "not_found" });
  });

  test("a server error or a network failure is unavailable", async () => {
    const failing = () => Promise.resolve(new Response("busy", { status: 503 }));
    expect(await lookupOpenLibrary("9780140328721", { baseUrl: "https://ol.test", fetch: failing })).toEqual({
      status: "unavailable",
    });
    const offline = () => Promise.reject(new TypeError("network down"));
    expect(await lookupOpenLibrary("9780140328721", { baseUrl: "https://ol.test", fetch: offline })).toEqual({
      status: "unavailable",
    });
  });

  test("a slow answer times out as unavailable", async () => {
    // Never answers on its own; rejects only when the client aborts.
    const hanging = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const result = await lookupOpenLibrary("9780140328721", { baseUrl: "https://ol.test", fetch: hanging, timeoutMs: 20 });
    expect(result).toEqual({ status: "unavailable" });
  });
});
