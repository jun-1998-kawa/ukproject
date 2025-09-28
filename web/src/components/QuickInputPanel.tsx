import { useState } from 'react'
import { methodAllowedForTargetJaLabel } from '../lib/tech'
import { useTranslation } from 'react-i18next'
import { Button, Badge } from '@aws-amplify/ui-react'

export type QuickInputPanelProps = {
  side: 'left'|'right'
  playerName: string
  targets: { code: string; label: string }[]
  methods: { code: string; label: string }[]
  foulCount: number
  onPoint: (p:{ side:'left'|'right'; target:string; methods:string[] })=>void
  onFoul: (side:'left'|'right')=>void
}

export default function QuickInputPanel({ side, playerName, targets, methods, foulCount, onPoint, onFoul }: QuickInputPanelProps){
  const { t } = useTranslation()
  const [pending, setPending] = useState<{target?:string; methods:string[]}>({ methods:[] })

  function tryCommit(next:{target?:string; methods:string[]}){
    if(next.target && next.methods.length>0){
      onPoint({ side, target: next.target, methods: next.methods })
      setPending({ methods: [] })
    } else {
      setPending(next)
    }
  }

  function pickTarget(tcode:string){
    tryCommit({ ...pending, target: tcode })
  }
  function toggleMethod(m:string){
    // apply simple constraints by target label
    const tgt = pending.target
    const tgtLabel = targets.find(t=> t.code===tgt)?.label ?? ''
    const allowed = !tgt ? true : (
      m==='GYAKU' ? /胴/.test(tgtLabel) :
      m==='HIDARI' ? /小手/.test(tgtLabel) :
      m==='AIKOTE' ? /面/.test(tgtLabel) : true
    )
    if(!allowed) return
    const s = new Set(pending.methods)
    s.has(m) ? s.delete(m) : s.add(m)
    tryCommit({ ...pending, methods: Array.from(s) })
  }

  return (
    <div style={{ border:'1px solid #eee', borderRadius:8, padding:12 }}>
      <div style={{ fontWeight:600, marginBottom:8 }}>{playerName}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(70px,1fr))', gap:8 }}>
        {targets.map(t=> (
          <Button key={t.code} onClick={()=> pickTarget(t.code)}>{t.label}</Button>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
        {methods.map(m=> {
          const tgtLabel = targets.find(t=> t.code===pending.target)?.label ?? ''
          const allowed = !pending.target ? true : (
            methodAllowedForTargetJaLabel(m.code, tgtLabel)
          )
          return (
            <Button key={m.code} onClick={()=> toggleMethod(m.code)} isDisabled={!allowed}>{m.label}</Button>
          )
        })}
      </div>
      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
        <Button variation="warning" onClick={()=> onFoul(side)}>{t('actions.foul')}</Button>
        <Badge variation="warning">{t('badges.foulCountFmt', { count: foulCount })}</Badge>
      </div>
    </div>
  )
}




