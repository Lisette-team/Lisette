import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import ro from "./ro.json";

export type Locale = "ro" | "en";

export const LOCALES: readonly Locale[] = ["ro", "en"];

export function isLocale(value: unknown): value is Locale {
  return value === "ro" || value === "en";
}

// No default from the phone's locale: people choose their language explicitly.
// Until they do, the start screen shows a bilingual prompt.
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ro: { translation: ro } },
  lng: "ro",
  fallbackLng: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
