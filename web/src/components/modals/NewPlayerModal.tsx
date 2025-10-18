import { useTranslation } from 'react-i18next'
import { Button } from '@aws-amplify/ui-react'

type University = { id: string; name: string }

type NewPlayerModalProps = {
  open: boolean
  side: 'left' | 'right'
  name: string
  universityId: string
  gender: string
  stance: string
  loading: boolean
  error: string
  universities: University[]
  onClose: () => void
  onChange: (field: string, value: string) => void
  onRegister: () => void
}

export default function NewPlayerModal(props: NewPlayerModalProps) {
  const { t } = useTranslation()
  const { open, name, universityId, gender, stance, loading, error, universities, onClose, onChange, onRegister } = props

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={onClose}>
      <div style={{ background: '#fff', minWidth: 360, maxWidth: 520, width: '90%', padding: 16, borderRadius: 8 }} onClick={e => e.stopPropagation()}>
        <h4 style={{ marginTop: 0 }}>{t('actions.newPlayer')}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('labels.playerName')}</label>
            <input type="text" value={name} onChange={e => onChange('name', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }} disabled={loading} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('labels.university')}</label>
            <select value={universityId} onChange={e => onChange('universityId', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }} disabled={loading}>
              <option value="">{t('placeholders.select')}</option>
              {universities.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('labels.gender')}</label>
            <select value={gender} onChange={e => onChange('gender', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }} disabled={loading}>
              <option value="">{t('placeholders.select')}</option>
              <option value="MALE">{t('gender.MALE')}</option>
              <option value="FEMALE">{t('gender.FEMALE')}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{t('labels.stance')}</label>
            <select value={stance} onChange={e => onChange('stance', e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 }} disabled={loading}>
              <option value="">{t('placeholders.select')}</option>
              <option value="JODAN">{t('stance.JODAN')}</option>
              <option value="CHUDAN">{t('stance.CHUDAN')}</option>
              <option value="NITOU_SHO">{t('stance.NITOU_SHO')}</option>
              <option value="NITOU_GYAKU">{t('stance.NITOU_GYAKU')}</option>
            </select>
          </div>
        </div>
        {error && (
          <div style={{ color: '#b00', fontSize: 12, marginTop: 12 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Button onClick={onClose} variation="link" isDisabled={loading}>{t('action.cancel')}</Button>
          <Button variation="primary" onClick={onRegister} isDisabled={!name.trim() || !universityId} isLoading={loading}>{t('actions.register')}</Button>
        </div>
      </div>
    </div>
  )
}
