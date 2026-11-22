export function coverColumns(width: number): number {
 return Math.max(1, Math.floor((width + 8) / 104));
}
