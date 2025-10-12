import { useEffect, useState } from 'react'
import { View, Heading, TextAreaField, TextField, Button, Flex } from '@aws-amplify/ui-react'

type AIPanelProps = {
  open: boolean
  onClose: () => void
  apiUrl: string
  getToken: () => Promise<string>
  payload: any | null
}

export default function AIPanel({ open, onClose, apiUrl, getToken, payload }: AIPanelProps){
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [summary, setSummary] = useState('')
  const [question, setQuestion] = useState('')
  const [conversationId, setConversationId] = useState<string>('')

  useEffect(()=>{ setSummary(''); setQuestion(''); setError(null); setConversationId('') }, [open])

  if(!open) return null

  async function runSummarize(){
    if(!payload) return
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) throw new Error('No ID token')
      const query = `mutation($payload: AWSJSON!){ aiSummarize(payload:$payload){ text conversationId model } }`
      const res = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query, variables:{ payload: JSON.stringify(payload) } }) })
      const json = await res.json()
      const data = json?.data?.aiSummarize
      if(!data) throw new Error(json?.errors ? JSON.stringify(json.errors) : 'No response')
      setSummary(data.text || '')
      setConversationId(data.conversationId || '')
    }catch(e:any){ setError(String(e?.message ?? e)) }
    finally{ setLoading(false) }
  }

  async function runAsk(){
    if(!payload || !question) return
    setLoading(true); setError(null)
    try{
      const token = await getToken(); if(!token) throw new Error('No ID token')
      const query = `mutation($input: AiAskInput!){ aiAsk(input:$input){ text conversationId model } }`
      const input = { question, payload: JSON.stringify(payload), conversationId }
      const res = await fetch(apiUrl, { method:'POST', headers:{ 'Content-Type':'application/json','Authorization': token }, body: JSON.stringify({ query, variables:{ input } }) })
      const json = await res.json()
      const data = json?.data?.aiAsk
      if(!data) throw new Error(json?.errors ? JSON.stringify(json.errors) : 'No response')
      setSummary(prev => (prev ? prev + '\n\n---\n' : '') + (data.text || ''))
      setConversationId(data.conversationId || conversationId)
      setQuestion('')
    }catch(e:any){ setError(String(e?.message ?? e)) }
    finally{ setLoading(false) }
  }

  return (
    <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.25)', zIndex: 1000 }}>
      <div className="modal" style={{ position:'absolute', top:'6%', left:'50%', transform:'translateX(-50%)', width:'min(1000px, 92vw)', background:'#fff', border:'1px solid #ddd', borderRadius:8, boxShadow:'0 6px 20px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid #eee' }}>
          <Heading level={5} style={{ margin:0 }}>AI要約 / 質問</Heading>
          <Button onClick={onClose}>閉じる</Button>
        </div>
        <View padding="12px 14px" style={{ display:'grid', gap:12 }}>
          <Flex gap={8}>
            <Button variation="primary" isDisabled={loading || !payload} onClick={runSummarize}>要約を生成</Button>
            {error && <div style={{ color:'#b00020' }}>{error}</div>}
          </Flex>
          <TextAreaField label="要約" value={summary} isReadOnly rows={14} placeholder="ここにAIの要約が表示されます" />
          <Flex alignItems="flex-end" gap={8}>
            <TextField label="要約への質問" value={question} onChange={e=> setQuestion(e.target.value)} placeholder="例: 出鼻小手の失点対策は？" width="100%" />
            <Button isDisabled={loading || !question} onClick={runAsk}>質問する</Button>
          </Flex>
        </View>
      </div>
    </div>
  )
}

