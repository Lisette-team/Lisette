import { formatDate } from "@/i18n/format";

describe("formatDate", () => {
  test("writes the day and a short month, as in the designs", () => {
    expect(formatDate("2027-01-10T12:00:00.000Z", "ro")).toBe("10 ian. 2027");
    expect(formatDate("2027-01-10T12:00:00.000Z", "en")).toBe("Jan 10, 2027");
  });
});
