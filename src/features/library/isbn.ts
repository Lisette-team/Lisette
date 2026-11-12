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
