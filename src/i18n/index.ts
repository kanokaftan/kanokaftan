import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { ha } from "./ha";

const savedLang = localStorage.getItem("kk_language") || "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ha: { translation: ha },
    },
    lng: savedLang,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;
