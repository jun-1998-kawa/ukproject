import { useTranslation } from 'react-i18next'
import { Button } from '@aws-amplify/ui-react'

type BoutAnalysisModalProps = {
  open: boolean
  category: string
  content: string
  importance: string
  tags: string
  onClose: () => void
  onChange: (field: string, value: string) => void
  onSave: () => void
}

export default function BoutAnalysisModal(props: BoutAnalysisModalProps) {
  const { t } = useTranslation()
  const { open, category, content, importance, tags, onClose, onChange, onSave } = props

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={onClose}>
      <div style={{ background: '#fff', minWidth: 400, maxWidth: 600, width: '90%', padding: 16, borderRadius: 8 }} onClick={e => e.stopPropagation()}>
        <h4 style={{ marginTop: 0 }}>{t('analysis.boutAnalysis')}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('analysis.category')}</label>
            <select value={category} onChange={e => onChange('category', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="STRENGTH">{t('analysis.categories.STRENGTH')}</option>
              <option value="WEAKNESS">{t('analysis.categories.WEAKNESS')}</option>
              <option value="TACTICAL">{t('analysis.categories.TACTICAL')}</option>
              <option value="MENTAL">{t('analysis.categories.MENTAL')}</option>
              <option value="TECHNICAL">{t('analysis.categories.TECHNICAL')}</option>
              <option value="OTHER">{t('analysis.categories.OTHER')}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('analysis.importance')}</label>
            <select value={importance} onChange={e => onChange('importance', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="HIGH">{t('analysis.importance_levels.HIGH')}</option>
              <option value="MEDIUM">{t('analysis.importance_levels.MEDIUM')}</option>
              <option value="LOW">{t('analysis.importance_levels.LOW')}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('analysis.content')}</label>
            <textarea value={content} onChange={e => onChange('content', e.target.value)} style={{ width: '100%', padding: '8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4, minHeight: 120, fontFamily: 'inherit' }} placeholder={t('analysis.content')} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('analysis.tags')}</label>
            <input type="text" value={tags} onChange={e => onChange('tags', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }} placeholder="tag1, tag2, tag3" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onClose} variation="link">{t('action.cancel')}</Button>
          <Button variation="primary" onClick={onSave} isDisabled={!content.trim()}>{t('actions.save')}</Button>
        </div>
      </div>
    </div>
  )
}
