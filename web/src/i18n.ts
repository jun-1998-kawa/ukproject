import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ja from './locales/ja/translation.json'
import en from './locales/en/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    supportedLngs: ['en', 'ja'],
    fallbackLng: ['ja', 'en'],
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => {
      if (typeof window !== 'undefined') {
        console.warn(`[i18n] Missing key: ${key}`)
      }
      return key
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
    },
  })

export default i18n
