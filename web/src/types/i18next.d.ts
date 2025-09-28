import 'i18next'
import en from '../locales/en/translation.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    // Use the English resource shape as the canonical key map
    resources: typeof en
    returnNull: false
  }
}

