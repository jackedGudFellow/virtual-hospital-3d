import enJson from '../locales/en.json';
import arJson from '../locales/ar.json';

export type LangCode = 'en' | 'ar';

const LANG_KEY = 'vh3d.lang';
const LOCALES: Record<LangCode, Record<string, string>> = {
  en: enJson,
  ar: arJson,
};

let currentLang: LangCode = loadSavedLang();
const listeners = new Set<(lang: LangCode) => void>();

function loadSavedLang(): LangCode {
  try {
    const val = window.localStorage.getItem(LANG_KEY);
    if (val === 'ar' || val === 'en') return val;
  } catch {
    // Ignore storage access errors
  }
  return 'en';
}

export function applyDocumentDirection(lang: LangCode = currentLang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function getLang(): LangCode {
  return currentLang;
}

export function setLang(lang: LangCode): void {
  currentLang = lang;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Ignore storage errors
  }
  applyDocumentDirection(lang);
  for (const cb of listeners) cb(lang);
}

export function onLangChange(cb: (lang: LangCode) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function t(langOrKey: LangCode | string, maybeKey?: string): string {
  const lang: LangCode = maybeKey ? (langOrKey as LangCode) : currentLang;
  const key = maybeKey ?? langOrKey;
  return LOCALES[lang]?.[key] ?? LOCALES.en[key] ?? key;
}

export function tDept(deptKey: string, fallback: string): string {
  const k = `dept_${deptKey}`;
  return LOCALES[currentLang]?.[k] ?? fallback;
}

applyDocumentDirection(currentLang);
