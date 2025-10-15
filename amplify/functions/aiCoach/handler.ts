/*
  aiCoach: Summarization + QA via Amazon Bedrock
  - Model is selected by env `AI_MODEL_ID` (e.g., anthropic.claude-3-5-sonnet-20240620-v1:0)
  - Designed for AppSync Lambda resolver style events (event.info.fieldName)
  - Also tolerates direct invocation with { op: 'summarize'|'ask', payload, question }
*/
import AWS from 'aws-sdk'
import crypto from 'crypto'

const bedrock = new (AWS as any).BedrockRuntime({ region: process.env.AWS_REGION })
const MODEL_ID = process.env.AI_MODEL_ID || ''

type SummarizePayload = any

function sha256(text: string){ return crypto.createHash('sha256').update(text).digest('hex') }

function systemPrompt(locale: string){
  const en = 'You are an analytics coach for a university kendo team. Summarize only from the provided stats. In every figure include the numeric basis (e.g., PF=68, WinRate=55.6%). Do not speculate beyond data. End with three Next Questions.please answer in japanese';
  return en;
}

function isAnthropic(modelId: string){ return /^anthropic\./.test(modelId) }
function isTitan(modelId: string){ return /^amazon\.titan-text/.test(modelId) }

function buildAnthropicBody(system: string, user: string, maxTokens=800, temperature=0.3){
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [ { role: 'user', content: [ { type: 'text', text: user } ] } ],
  })
}

function buildTitanBody(system: string, user: string, maxTokens=800, temperature=0.3){
  const text = system + "\n\n" + user;
  return JSON.stringify({
    inputText: text,
    textGenerationConfig: {
      temperature,
      maxTokenCount: maxTokens,
      topP: 0.9,
    },
  })
}
function buildInvokeParams(modelId: string, system: string, user: string, maxTokens=800, temperature=0.3){
  if (isTitan(modelId)){
    return { modelId, accept: 'application/json', contentType: 'application/json', body: buildTitanBody(system, user, maxTokens, temperature) }
  }
  // default anthropic family
  return { modelId, accept: 'application/json', contentType: 'application/json', body: buildAnthropicBody(system, user, maxTokens, temperature) }
}

function buildMessagesForSummary(payload: SummarizePayload){
  const locale = payload?.locale || 'ja'
  const user = 'Provided STATS JSON follows. Summarize concisely using only these stats. In every figure include numeric basis (e.g., PF=68, WinRate=55.6%). End with three Next Questions.\nJSON:\n' + JSON.stringify(payload);
  return buildInvokeParams(MODEL_ID, systemPrompt(locale), user, 800, 0.3)
}
function buildMessagesForAsk(question: string, payload: SummarizePayload){
  const locale = payload?.locale || 'ja'
  const user = 'Answer the question using only the provided STATS JSON. In every figure include numeric basis. Do not speculate.\nQuestion: ' + question + '\n\nJSON:\n' + JSON.stringify(payload);
  return buildInvokeParams(MODEL_ID, systemPrompt(locale), user, 600, 0.2)
}
function extractText(respBody: any): string{
  try{
    // Anthropic format
    const content = respBody?.content
    if(Array.isArray(content)){
      for(const c of content){ if(c?.type==='text' && typeof c.text==='string') return c.text }
    }
    // Titan format
    const results = respBody?.results
    if(Array.isArray(results) && results[0]?.outputText){ return String(results[0].outputText) }
  }catch{}
  return ''
}

export const handler = async (event: any) => {
  if(!MODEL_ID){ return { error: 'AI_MODEL_ID env is not set.' } }

  // Determine op + args from AppSync or direct invoke
  const field = event?.info?.fieldName
  const args = event?.arguments || {}
  const directOp = event?.op
  const op = field || directOp || 'summarize'

  if(op === 'aiSummarize' || op === 'summarize'){
    const payloadStr = args?.payload || event?.payload
    const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr
    const payloadHash = sha256(JSON.stringify(payload||{}))
    const req = buildMessagesForSummary(payload)
    const raw = await bedrock.invokeModel(req as any).promise()
    const body = JSON.parse(raw.body?.toString?.() || raw.body || '{}')
    const text = extractText(body)
    return { text, conversationId: payloadHash, model: MODEL_ID }
  }

  if(op === 'aiAsk' || op === 'ask'){
    const input = args?.input || event?.input || {}
    const question = input?.question || event?.question || ''
    const payloadStr = input?.payload || event?.payload
    const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr
    const payloadHash = sha256(JSON.stringify(payload||{}))
    const req = buildMessagesForAsk(question, payload)
    const raw = await bedrock.invokeModel(req as any).promise()
    const body = JSON.parse(raw.body?.toString?.() || raw.body || '{}')
    const text = extractText(body)
    return { text, conversationId: payloadHash, model: MODEL_ID }
  }

  return { error: `Unknown operation: ${op}` }
}



