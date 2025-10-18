import { useTranslation } from 'react-i18next'
import { Button } from '@aws-amplify/ui-react'

type DeleteConfirmModalProps = {
  open: boolean
  kind: 'bout' | 'match'
  onClose: () => void
  onConfirm: () => void
}

export default function DeleteConfirmModal(props: DeleteConfirmModalProps) {
  const { t } = useTranslation()
  const { open, kind, onClose, onConfirm } = props

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }} onClick={onClose}>
      <div style={{ background: '#fff', minWidth: 320, maxWidth: 520, width: '90%', padding: 16, borderRadius: 8 }} onClick={e => e.stopPropagation()}>
        <h4 style={{ marginTop: 0 }}>{kind === 'bout' ? t('confirm.deleteBoutTitle') : t('confirm.deleteMatchTitle')}</h4>
        <div style={{ color: '#444', marginBottom: 12 }}>
          {kind === 'bout' && (<>
            <div>{t('confirm.deleteBoutBody')}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{t('confirm.deleteBoutNote')}</div>
          </>)}
          {kind === 'match' && (<>
            <div>{t('confirm.deleteMatchBody')}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{t('confirm.deleteMatchNote')}</div>
          </>)}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} variation="link">{t('action.cancel')}</Button>
          <Button variation="warning" onClick={onConfirm}>{t('action.delete')}</Button>
        </div>
      </div>
    </div>
  )
}
