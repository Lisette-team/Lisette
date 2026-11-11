import type { TFunction } from "i18next";

// "acum 2 ore", "ieri", then the date, as in the v6 post cards.
export function relativeTime(t: TFunction, iso: string, locale: string, now = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return t("community.time.now");
  if (minutes < 60) return t("community.time.minutes", { count: minutes });
  if (minutes < 24 * 60) return t("community.time.hours", { count: Math.floor(minutes / 60) });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("community.time.yesterday");
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
