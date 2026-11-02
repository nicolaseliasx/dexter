import { describe, expect, it, beforeEach } from "vitest";

import {
  changeAppLanguage,
  consumeLoginLanguage,
  LOCALE_FILES,
  normalizeLanguageCode,
  rememberLoginLanguage,
} from "../../i18n/i18n";
import { LANGUAGES, TRANSLATED_LANGUAGES } from "../../i18n/languages";

describe("i18n language handling", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("normalizes persisted desktop language codes", () => {
    expect(normalizeLanguageCode("en_US")).toBe("en");
    expect(normalizeLanguageCode("zh_CN")).toBe("en");
    expect(normalizeLanguageCode("pt_br")).toBe("en");
    expect(normalizeLanguageCode("EN-us")).toBe("en");
    expect(normalizeLanguageCode("unknown")).toBe("en");
  });

  it("falls back to English for every other language because only English ships", () => {
    for (const code of ["es-MX", "es", "pt", "pt-AO", "zh", "zh-HK", "de-AT", "sk-SK", "fr"]) {
      expect(normalizeLanguageCode(code)).toBe("en");
    }
    expect(normalizeLanguageCode("en-GB")).toBe("en");
    expect(LANGUAGES).toEqual([{ code: "en", label: "English" }]);
  });

  it("lists only English and ships no translated files", () => {
    expect(TRANSLATED_LANGUAGES).toEqual([]);
    expect(Object.keys(LOCALE_FILES)).toEqual([]);
    expect(Object.keys(import.meta.glob("../../locales/translated/*.json"))).toEqual([]);
    expect(LANGUAGES).toEqual([{ code: "en", label: "English" }]);
  });

  it("stores the normalized language after a successful switch", async () => {
    await expect(changeAppLanguage("fr_FR")).resolves.toBe("en");
    expect(localStorage.getItem("i18nextLng")).toBe("en");
  });

  it("keeps an explicit login language until preferences are hydrated", () => {
    expect(rememberLoginLanguage("en_GB")).toBe("en");
    expect(consumeLoginLanguage()).toBe("en");
    expect(consumeLoginLanguage()).toBeNull();
  });
});
