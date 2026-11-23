import { PAGE_RANGE_JS } from "@/features/manuscripts/reader-html";

type Range = [number, number] | null;
// The reader runs this script inside the WebView; evaluate the same source here.
const nextRange = new Function(`${PAGE_RANGE_JS}; return nextRange;`)() as (range: Range, page: number) => Range;

describe("page range picking", () => {
  test("the first tap selects one page", () => {
    expect(nextRange(null, 5)).toEqual([5, 5]);
  });

  test("taps outside the range extend it, past three pages too", () => {
    let range: Range = null;
    for (const page of [3, 4, 5, 6, 7]) range = nextRange(range, page);
    expect(range).toEqual([3, 7]);
    expect(nextRange([5, 7], 2)).toEqual([2, 7]);
  });

  test("tapping an end deselects it, and the last page clears the selection", () => {
    expect(nextRange([3, 7], 3)).toEqual([4, 7]);
    expect(nextRange([3, 7], 7)).toEqual([3, 6]);
    expect(nextRange([4, 4], 4)).toBeNull();
  });

  test("tapping inside the range makes that page the new end", () => {
    expect(nextRange([3, 9], 5)).toEqual([3, 5]);
  });
});
