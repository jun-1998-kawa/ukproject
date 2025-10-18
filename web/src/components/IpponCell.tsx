import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Badge, SelectField, TextField } from '@aws-amplify/ui-react'
import type { Master } from '../constants/fallbackMasters'

export type PointInput = { tSec: number | ''; target: string; methods: string[] }

type IpponCellProps = {
  value: PointInput | null
  onChange: (next: PointInput | null) => void
  targets: Master[]
  methods: Master[]
  onFocus?: () => void
}

export default function IpponCell(props: IpponCellProps) {
  const { t, i18n } = useTranslation()
  const { value, onChange, targets, methods, onFocus } = props
  const v = value ?? { tSec: 0, target: '', methods: [] }
  const valid = (v.methods.length > 0) && !!v.target && ((typeof v.tSec === 'number' && v.tSec >= 0) || v.tSec === '')
  const [open, setOpen] = useState(false)

  function parseTime(input: string): number | '' {
    const s = input.trim()
    if (s === '') return ''
    const mmss = s.match(/^([0-9]{1,2})[:'m]\s*([0-5]?[0-9])$/)
    if (mmss) { return Number(mmss[1]) * 60 + Number(mmss[2]) }
    const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : ''
  }

  function targetLabelJa(code: string) {
    const m = targets.find(t => t.code === code)
    return (m?.nameJa ?? m?.nameEn ?? '')
  }

  function methodAllowedForTarget2(mcode: string, tcode: string) {
    if (!tcode) return true
    const tl = targetLabelJa(tcode)
    if (mcode === 'GYAKU') return tl.includes('胴')
    if (mcode === 'HIDARI') return tl.includes('小手')
    if (mcode === 'AIKOTE') return tl.includes('面')
    return true
  }

  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(32px,auto) 1fr', gridAutoRows: 'minmax(20px,auto)', gap: 4, border: valid ? '1px solid transparent' : '1px solid #e66', borderRadius: 6, padding: '2px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 24 }}>
        <Button size="small" variation="link" onClick={() => { onFocus?.(); setOpen(o => !o) }} title={open ? t('ipponCell.closeMethods') : t('ipponCell.chooseMethods')} style={{ minWidth: 28, padding: '2px 4px' }}>
          {open ? '-' : '+'}
        </Button>
        {!open && (
          <div style={{ display: 'flex', gap: 2, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {v.methods.slice(0, 2).map(code => {
              const found = methods.find(mm => mm.code === code)
              const label = found ? (i18n.language.startsWith('ja') ? (found.nameJa ?? found.nameEn ?? found.code) : (found.nameEn ?? found.code)) : code
              return (<Badge key={code} variation="info" style={{ padding: '0 4px' }}>{label}</Badge>)
            })}
            {v.methods.length > 2 && (<Badge variation="info" style={{ padding: '0 4px' }}>+{v.methods.length - 2}</Badge>)}
          </div>
        )}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4, background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, maxHeight: 140, width: 260, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 6, padding: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          {methods.map(m => {
            const checked = v.methods.includes(m.code)
            const allowed = methodAllowedForTarget2(m.code, v.target)
            return (
              <label key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: allowed ? 1 : 0.4 }}>
                <input type="checkbox" disabled={!allowed} checked={checked && allowed} onChange={(e) => {
                  onFocus?.();
                  if (e.target.checked) {
                    onChange({ ...v, methods: [...v.methods, m.code] })
                    setTimeout(() => setOpen(false), 200)
                  } else {
                    onChange({ ...v, methods: v.methods.filter(x => x !== m.code) })
                  }
                }} />
                <span>{i18n.language.startsWith('ja') ? (m.nameJa ?? m.nameEn ?? m.code) : (m.nameEn ?? m.code)}</span>
              </label>
            )
          })}
        </div>
      )}
      <SelectField label="" labelHidden placeholder={t('ipponCell.targetPlaceholder')} value={v.target} onChange={(e) => { onFocus?.(); const nextTarget = e.target.value; const filtered = (v.methods || []).filter(m => methodAllowedForTarget2(m, nextTarget)); onChange({ ...v, target: nextTarget, methods: filtered }) }} size="small">
        <option value=""></option>
        {targets.map(tgt => (
          <option key={tgt.code} value={tgt.code}>{i18n.language.startsWith('ja') ? (tgt.nameJa ?? tgt.nameEn ?? tgt.code) : (tgt.nameEn ?? tgt.code)}</option>
        ))}
      </SelectField>
      <div style={{ gridColumn: '1 / 2', display: 'flex', alignItems: 'center', gap: 4 }}>
        <TextField label="" labelHidden placeholder={t('ipponCell.secondsPlaceholder')} value={v.tSec === '' ? '' : String(v.tSec)} onChange={(e) => { onFocus?.(); onChange({ ...v, tSec: parseTime(e.target.value) }) }} width="40px" style={{ padding: '2px 4px' }} />
        <span style={{ fontSize: 10, color: '#666' }}>s</span>
      </div>
    </div>
  )
}
