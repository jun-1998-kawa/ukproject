import { useEffect, useMemo, useState } from 'react'
import { View, Heading, Button, TextAreaField, Flex } from '@aws-amplify/ui-react'

type ChatTurn = { role: 'user'|'assistant', content: string }

export default function ChatSummaryModal(props:{
  open: boolean
  onClose: ()=>void
  aiUrl?: string | null
  getToken?: ()=> Promise<string|null>
  language?: 'ja'|'en'
  playerName: string
  filters: any
  stats: any
  notes: { match?: string, comment: string }[]
}){
  const { open, onClose, aiUrl, getToken, language='ja', playerName, filters, stats, notes } = props
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [answer, setAnswer] = useState('')
  const [history, setHistory] = useState<ChatTurn[]>([])
  const [question, setQuestion] = useState('')

  useEffect(()=>{ if(!open){ setAnswer(''); setHistory([]); setQuestion(''); setError(null) } }, [open])

  async function callAI(q?: string){
    if(!aiUrl || !getToken) return
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) throw new Error('No ID token')
      const body: any = { language, playerName, filters, stats, notes }
      if(q && q.trim()) body.question = q.trim()
      if(history.length>0) body.history = history
      const res = await fetch(`${aiUrl}/ai/summary`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': token }, body: JSON.stringify(body) })
      const j:any = await res.json(); if(!res.ok || j?.error){ throw new Error(j?.error || res.statusText) }
      const text = String(j?.answer || '')
      setAnswer(text)
      if(q && q.trim()) setHistory(h=> [...h, { role:'user', content: q.trim() }, { role:'assistant', content: text }])
      else setHistory([{ role:'assistant', content: text }])
    }catch(e:any){ setError(String(e?.message ?? e)); }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ if(open) callAI() }, [open])

  if(!open) return null
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <View style={{ width:'min(920px, 96vw)', maxHeight:'88vh', overflow:'auto', background:'#fff', borderRadius:8, padding:16, boxShadow:'0 6px 24px rgba(0,0,0,0.2)' }}>
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={5}>{language==='ja' ? 'AI要約 / 質問' : 'AI Summary / Q&A'}</Heading>
          <Button size="small" onClick={onClose}>
            {language==='ja' ? '閉じる' : 'Close'}
          </Button>
        </Flex>
        {error ? (<div style={{ color:'#c00', marginTop:8, fontSize:13 }}>{error}</div>) : null}
        <div style={{ marginTop:8, whiteSpace:'pre-wrap', lineHeight:1.6, fontSize:14 }}>{answer || (language==='ja' ? '生成中…' : 'Generating…')}</div>
        <div style={{ marginTop:12 }}>
          <TextAreaField
            label={language==='ja' ? '質問を入力' : 'Ask a question'}
            labelHidden
            rows={3}
            value={question}
            onChange={(e)=> setQuestion((e.target as HTMLTextAreaElement).value)}
            placeholder={language==='ja' ? '例: 「どの技で失点が多い？」' : 'e.g., Which techniques concede most?'}
          />
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <Button size="small" variation="link" onClick={()=> setQuestion('')}>{language==='ja' ? 'クリア' : 'Clear'}</Button>
            <Button size="small" isLoading={loading} isDisabled={!aiUrl} onClick={()=> callAI(question)}>{language==='ja' ? '質問する' : 'Ask'}</Button>
          </div>
        </div>
      </View>
    </div>
  )
}

