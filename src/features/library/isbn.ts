// ISBN checks done on the phone before any lookup. The database checks ISBN-13 again (works.isbn).
// [0-9] rather than \d, which would also match non-ASCII digits.

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^[0-9]{9}[0-9Xx]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, c, i) => total + (c === "X" || c === "x" ? 10 : Number(c)) * (10 - i), 0);
  return sum % 11 === 0;
}

// The ISBN-13 for what a person typed or the camera read, or null when it is not a valid ISBN.
// Hyphens and spaces are ignored; an ISBN-10 becomes its 978 ISBN-13.
export function toIsbn13(input: string): string | null {
  const clean = input.replace(/[\s-]/g, "");
  if (isValidIsbn13(clean)) return clean;
  if (!isValidIsbn10(clean)) return null;
  const body = `978${clean.slice(0, 9)}`;
  const sum = [...body].reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

export type BarcodeKind = { kind: "isbn"; isbn: string } | { kind: "not_isbn" } | { kind: "unreadable" };

// What the scanner read. Books carry an EAN-13 starting 978 or 979; a 978/979 code whose check digit
// fails was misread. Any other EAN-13, EAN-8, UPC-A or UPC-E is a product code, not a book's ISBN.
export function classifyBarcode(data: string): BarcodeKind {
  const code = data.trim();
  if (/^97[89][0-9]{10}$/.test(code)) return isValidIsbn13(code) ? { kind: "isbn", isbn: code } : { kind: "unreadable" };
  if (/^[0-9]{13}$/.test(code) || /^[0-9]{12}$/.test(code) || /^[0-9]{6,8}$/.test(code)) return { kind: "not_isbn" };
  return { kind: "unreadable" };
}
