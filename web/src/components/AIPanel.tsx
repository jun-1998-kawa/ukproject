import { useEffect, useState } from 'react'
import { View, Heading, TextField, Button, Flex } from '@aws-amplify/ui-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type AIPanelProps = {
  open: boolean
  onClose: () => void
  apiUrl: string
  getToken: () => Promise<string | null>
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
      const query = `mutation($input: AiAskInputInput!){ aiAsk(input:$input){ text conversationId model } }`
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

          {/* AI Summary Display with Markdown Styling */}
          <div style={{ position: 'relative' }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: '#333'
            }}>
              要約
            </div>
            <div style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1.5rem',
              minHeight: '400px',
              maxHeight: '600px',
              overflowY: 'auto',
              background: '#fafafa',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif',
              lineHeight: 1.8
            }}>
              {loading && (
                <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  <div style={{ marginBottom: '1rem' }}>⏳ AI要約を生成中...</div>
                  <div style={{ fontSize: '0.875rem' }}>しばらくお待ちください</div>
                </div>
              )}
              {!loading && !summary && (
                <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                  ここにAIの要約が表示されます
                </div>
              )}
              {!loading && summary && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '1rem', color: '#1a1a1a', borderBottom: '3px solid #667eea', paddingBottom: '0.5rem' }} {...props} />,
                    h2: ({node, ...props}) => <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.875rem', color: '#2a2a2a', borderBottom: '2px solid #e0e0e0', paddingBottom: '0.5rem' }} {...props} />,
                    h3: ({node, ...props}) => <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.75rem', color: '#333' }} {...props} />,
                    p: ({node, ...props}) => <p style={{ marginTop: '0.75rem', marginBottom: '0.75rem', color: '#444', lineHeight: 1.8 }} {...props} />,
                    ul: ({node, ...props}) => <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.75rem', listStyleType: 'disc' }} {...props} />,
                    ol: ({node, ...props}) => <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem', marginBottom: '0.75rem' }} {...props} />,
                    li: ({node, ...props}) => <li style={{ marginTop: '0.375rem', marginBottom: '0.375rem', color: '#444' }} {...props} />,
                    strong: ({node, ...props}) => <strong style={{ fontWeight: 700, color: '#1a1a1a' }} {...props} />,
                    em: ({node, ...props}) => <em style={{ fontStyle: 'italic', color: '#555' }} {...props} />,
                    code: ({node, inline, ...props}: any) => inline
                      ? <code style={{ background: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.875em', color: '#c7254e', fontFamily: 'Monaco, Consolas, monospace' }} {...props} />
                      : <code style={{ display: 'block', background: '#2d2d2d', color: '#f8f8f2', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.875rem', fontFamily: 'Monaco, Consolas, monospace', marginTop: '0.75rem', marginBottom: '0.75rem' }} {...props} />,
                    blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '4px solid #667eea', paddingLeft: '1rem', marginLeft: 0, marginTop: '1rem', marginBottom: '1rem', color: '#666', fontStyle: 'italic', background: '#f9f9f9', padding: '0.5rem 1rem', borderRadius: '4px' }} {...props} />,
                    hr: ({node, ...props}) => <hr style={{ border: 'none', borderTop: '2px solid #e0e0e0', marginTop: '1.5rem', marginBottom: '1.5rem' }} {...props} />,
                    table: ({node, ...props}) => <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', marginBottom: '1rem', fontSize: '0.9rem' }} {...props} />,
                    thead: ({node, ...props}) => <thead style={{ background: '#667eea', color: 'white' }} {...props} />,
                    th: ({node, ...props}) => <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 600 }} {...props} />,
                    td: ({node, ...props}) => <td style={{ padding: '0.75rem', borderBottom: '1px solid #e0e0e0' }} {...props} />,
                    a: ({node, ...props}) => <a style={{ color: '#667eea', textDecoration: 'none', borderBottom: '1px solid #667eea', transition: 'color 0.2s' }} {...props} />,
                  }}
                >
                  {summary}
                </ReactMarkdown>
              )}
            </div>
          </div>

          <Flex alignItems="flex-end" gap={8}>
            <TextField label="要約への質問" value={question} onChange={e=> setQuestion(e.target.value)} placeholder="例: この選手に対し有効な対策は？" width="100%" />
            <Button isDisabled={loading || !question} onClick={runAsk}>質問する</Button>
          </Flex>
        </View>
      </div>
    </div>
  )
}

