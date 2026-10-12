import i18n from "@/i18n/index";

export const LANGUAGE_KEY = "kk_language";
export type AppLanguage = "en" | "ha";

export function currentLanguage(): AppLanguage {
  return i18n.language?.startsWith("ha") ? "ha" : "en";
}

/** Switch language now and remember it on this device. */
export function setLanguage(value: AppLanguage) {
  if (i18n.language !== value) i18n.changeLanguage(value);
  try {
    localStorage.setItem(LANGUAGE_KEY, value);
  } catch (error) {
    console.warn("[language] could not remember the choice", error);
  }
}
