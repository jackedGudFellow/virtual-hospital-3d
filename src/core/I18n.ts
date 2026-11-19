export type LangCode = 'en' | 'ar';

const DICT: Record<LangCode, Record<string, string>> = {
  en: {
    brandTitle: 'Virtual Hospital 3D',
    brandSub: 'L1–L5 + NICU Wing · Click room for info · Double-click to enter',
    whole: 'Whole',
    exploded: 'Exploded',
    tour: 'Guided Tour',
    day: 'Day',
    night: 'Night',
    soundOff: 'Sound: Off',
    soundOn: 'Sound: On',
    qualityHigh: 'Quality: High',
    qualityLow: 'Quality: Low',
    contrast: 'High Contrast',
    langBtn: 'AR / عربي',
    departments: 'Departments',
    searchPlaceholder: 'Search rooms (e.g. ICU, Pharmacy, NICU)...',
    hint: 'Click: Select · Double-click: Enter · Esc: Back · ~: FPS',
  },
  ar: {
    brandTitle: 'المستشفى الافتراضي ثلاثي الأبعاد',
    brandSub: 'الطوابق 1–5 + جناح الخدج · انقر للتفاصيل · نقرتان للدخول',
    whole: 'المبنى كامل',
    exploded: 'عرض مفكك',
    tour: 'جولة إرشادية',
    day: 'نهار',
    night: 'ليل',
    soundOff: 'الصوت: إيقاف',
    soundOn: 'الصوت: تشغيل',
    qualityHigh: 'الجودة: عالية',
    qualityLow: 'الجودة: منخفضة',
    contrast: 'تباين عالٍ',
    langBtn: 'EN / English',
    departments: 'الأقسام',
    searchPlaceholder: 'ابحث عن غرفة (مثل: الصيدلية، العناية)...',
    hint: 'نقر: تحديد · نقرتان: دخول · Esc: رجوع · ~: الإطارات',
  },
};

export function t(lang: LangCode, key: string): string {
  return DICT[lang][key] ?? DICT.en[key] ?? key;
}
