// Fallback master data when API returns empty (e.g., in production before seeding)

export type Master = { code: string; nameJa?: string; nameEn?: string }

export const fallbackTargets: Master[] = [
  { code: 'MEN', nameJa: '面', nameEn: 'Men' },
  { code: 'KOTE', nameJa: '小手', nameEn: 'Kote' },
  { code: 'DO', nameJa: '胴', nameEn: 'Do' },
  { code: 'TSUKI', nameJa: '突き', nameEn: 'Tsuki' },
]

export const fallbackMethods: Master[] = [
  { code: 'SURIAGE', nameJa: 'すり上げ', nameEn: 'Suriage' },
  { code: 'KAESHI', nameJa: '返し', nameEn: 'Kaeshi' },
  { code: 'NUKI', nameJa: '抜き', nameEn: 'Nuki' },
  { code: 'DEBANA', nameJa: '出ばな', nameEn: 'Debana' },
  { code: 'HIKI', nameJa: '引き', nameEn: 'Hiki' },
  { code: 'HARAI', nameJa: '払い', nameEn: 'Harai' },
  { code: 'TOBIKOMI', nameJa: '飛び込み', nameEn: 'Tobikomi' },
  { code: 'GYAKU', nameJa: '逆', nameEn: 'Gyaku' },
  { code: 'HIDARI', nameJa: '左', nameEn: 'Left' },
  { code: 'AIKOTE', nameJa: '相小手', nameEn: 'Aikote' },
]
