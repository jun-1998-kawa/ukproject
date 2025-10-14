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
  const base = `縺ゅ↑縺溘・螟ｧ蟄ｦ蜑｣驕馴Κ縺ｮ蛻・梵繧ｳ繝ｼ繝√〒縺吶ゆｸ弱∴繧峨ｌ縺溽ｵｱ險医・縺ｿ繧呈ｹ諡縺ｫ縲∵律譛ｬ隱槭〒邁｡貎斐↓隕∫ｴ・＠縲∵焚蛟､縺ｫ縺ｯ譬ｹ諡蛟､(萓・ PF=68, 蜍晉紫=55.6%)繧呈峡蠑ｧ縺ｧ遉ｺ縺励∪縺吶よ耳貂ｬ繧・､夜Κ遏･隴倥〒遨ｴ蝓九ａ縺励∪縺帙ｓ縲よ怙蠕後↓縲梧ｬ｡縺ｮ雉ｪ蝠丞呵｣懊阪ｒ3縺､蜃ｺ縺励※縺上□縺輔＞縲Ａ;
  const en = `You are an analytics coach for a university kendo team. Summarize only from the provided stats. In every figure include the numeric basis (e.g., PF=68, WinRate=55.6%). Do not speculate beyond data. End with three Next Questions.`
  return (locale||'ja').startsWith('en') ? en : base
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
  const text = `${system}\n\n${user}`
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
  const user = `莉･荳九・繝繝・す繝･繝懊・繝峨〒險育ｮ玲ｸ医∩縺ｮ邨ｱ險・JSON)縺ｧ縺吶Ａ+
    `縺薙ｌ縺ｫ蝓ｺ縺･縺阪・縲・陦後・隕∫ｴ・隕∫せ/蛯ｾ蜷・謾ｹ蝟・｡・繧堤ｮ・擅譖ｸ縺阪〒縲Ａ+
    `譛蠕後↓縲梧ｬ｡縺ｮ雉ｪ蝠丞呵｣懊阪ｒ3莉ｶ縲・n\nJSON:\n`+JSON.stringify(payload)
  return buildInvokeParams(MODEL_ID, systemPrompt(locale), user, 800, 0.3)
}

function buildMessagesForAsk(question: string, payload: SummarizePayload){
  const locale = payload?.locale || 'ja'
  const user = `谺｡縺ｮ隕∫ｴ・さ繝ｳ繝・く繧ｹ繝・JSON)縺ｫ蝓ｺ縺･縺・※雉ｪ蝠上↓遲斐∴縺ｦ縺上□縺輔＞縲Ａ+
    `繝・・繧ｿ逕ｱ譚･縺ｮ譬ｹ諡謨ｰ蛟､繧呈峡蠑ｧ縺ｧ譏守､ｺ縺励∵耳貂ｬ縺励↑縺・〒縺上□縺輔＞縲・n\n雉ｪ蝠・ ${question}\n\nJSON:\n`+JSON.stringify(payload)
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

