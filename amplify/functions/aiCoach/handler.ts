/*
  aiCoach: Summarization + QA via Amazon Bedrock
  - Model is selected by env `AI_MODEL_ID` (e.g., anthropic.claude-3-5-sonnet-20240620-v1:0)
  - Region is selected by env `AI_BEDROCK_REGION` (defaults to Lambda's AWS_REGION, fallback: us-east-1)
  - System prompt priority: S3 → Environment Variable → Default
    - S3: AI_PROMPT_S3_BUCKET + AI_PROMPT_S3_KEY (can be mode-specific)
    - Env: AI_SYSTEM_PROMPT (for 'personal' mode only)
  - Mode support: 'personal' (default) or 'scouting'
    - S3 keys: prompts/personal-prompt.txt, prompts/scouting-prompt.txt
  - Designed for AppSync Lambda resolver style events (event.info.fieldName)
  - Also tolerates direct invocation with { op: 'summarize'|'ask', payload, question }
*/
import AWS from 'aws-sdk'
import crypto from 'crypto'

const BEDROCK_REGION = process.env.AI_BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1'
const bedrock = new (AWS as any).BedrockRuntime({ region: BEDROCK_REGION })
const s3 = new AWS.S3()
const MODEL_ID = process.env.AI_MODEL_ID || ''
const SYSTEM_PROMPT_OVERRIDE = process.env.AI_SYSTEM_PROMPT || ''
const S3_BUCKET = process.env.AI_PROMPT_S3_BUCKET || ''
const S3_KEY = process.env.AI_PROMPT_S3_KEY || ''

type SummarizePayload = any
type PromptMode = 'personal' | 'scouting'

// Cache for S3-loaded prompts by mode (survives across warm Lambda invocations)
const cachedS3Prompts: Record<PromptMode, string | null> = { personal: null, scouting: null }
const s3LoadAttempted: Record<PromptMode, boolean> = { personal: false, scouting: false }

function sha256(text: string){ return crypto.createHash('sha256').update(text).digest('hex') }

/**
 * Fetch system prompt from S3 (with caching per mode)
 * Falls back to null if S3 is not configured or fetch fails
 */
async function fetchSystemPromptFromS3(mode: PromptMode = 'personal'): Promise<string | null> {
  if(s3LoadAttempted[mode]) return cachedS3Prompts[mode] // Return cached result (including null)
  s3LoadAttempted[mode] = true

  if(!S3_BUCKET){
    console.log('[aiCoach] S3 prompt not configured (AI_PROMPT_S3_BUCKET missing)')
    return null
  }

  // Construct mode-specific key
  const s3Key = S3_KEY || `prompts/${mode}-prompt.txt`

  try {
    console.log(`[aiCoach] Fetching system prompt from s3://${S3_BUCKET}/${s3Key} (mode: ${mode})`)
    const result = await s3.getObject({ Bucket: S3_BUCKET, Key: s3Key }).promise()
    const prompt = result.Body?.toString('utf-8') || null
    if(prompt){
      cachedS3Prompts[mode] = prompt
      console.log(`[aiCoach] Successfully loaded system prompt from S3 (mode: ${mode}, ${prompt.length} chars)`)
    } else {
      console.warn(`[aiCoach] S3 object was empty (mode: ${mode})`)
    }
    return cachedS3Prompts[mode]
  } catch(e: any){
    console.error(`[aiCoach] Failed to load system prompt from S3 (mode: ${mode}):`, e.message)
    return null
  }
}

/**
 * Get system prompt with fallback priority: S3 → Env Var (personal only) → Default
 */
async function systemPrompt(locale: string, mode: PromptMode = 'personal'): Promise<string> {
  // Priority 1: S3
  const s3Prompt = await fetchSystemPromptFromS3(mode)
  if(s3Prompt) {
    console.log(`[aiCoach] Using system prompt from S3 (mode: ${mode})`)
    return s3Prompt
  }

  // Priority 2: Environment variable (for 'personal' mode only)
  if(mode === 'personal' && SYSTEM_PROMPT_OVERRIDE) {
    console.log('[aiCoach] Using system prompt from environment variable (mode: personal)')
    return SYSTEM_PROMPT_OVERRIDE
  }

  // Priority 3: Default prompt (mode-specific)
  console.log(`[aiCoach] Using default system prompt (mode: ${mode})`)

  if(mode === 'scouting') {
    return 'You are a scouting analyst for a university kendo team. Analyze the opponent player data provided. Focus on identifying patterns, strengths, weaknesses, and tactical tendencies. In every figure include the numeric basis (e.g., PF=68, WinRate=55.6%). Do not speculate beyond the provided data. End with three strategic recommendations for facing this opponent. Please answer in Japanese.';
  }

  // Default for 'personal' mode
  return 'You are an analytics coach for a university kendo team. Summarize only from the provided stats. In every figure include the numeric basis (e.g., PF=68, WinRate=55.6%). Do not speculate beyond data. End with three Next Questions. Please answer in Japanese.';
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

async function buildMessagesForSummary(payload: SummarizePayload){
  const locale = payload?.locale || 'ja'
  const mode: PromptMode = payload?.mode === 'scouting' ? 'scouting' : 'personal'
  const system = await systemPrompt(locale, mode)

  let userPrompt = 'Provided STATS JSON follows. Summarize concisely using only these stats. In every figure include numeric basis (e.g., PF=68, WinRate=55.6%). '
  if(mode === 'scouting') {
    userPrompt += 'Focus on opponent analysis: patterns, strengths, weaknesses, tactical tendencies. End with three strategic recommendations.\nJSON:\n'
  } else {
    userPrompt += 'End with three Next Questions.\nJSON:\n'
  }

  const user = userPrompt + JSON.stringify(payload);
  return buildInvokeParams(MODEL_ID, system, user, 800, 0.3)
}
async function buildMessagesForAsk(question: string, payload: SummarizePayload){
  const locale = payload?.locale || 'ja'
  const mode: PromptMode = payload?.mode === 'scouting' ? 'scouting' : 'personal'
  const system = await systemPrompt(locale, mode)
  const user = 'Answer the question using only the provided STATS JSON. In every figure include numeric basis. Do not speculate.\nQuestion: ' + question + '\n\nJSON:\n' + JSON.stringify(payload);
  return buildInvokeParams(MODEL_ID, system, user, 600, 0.2)
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
    const req = await buildMessagesForSummary(payload)
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
    const req = await buildMessagesForAsk(question, payload)
    const raw = await bedrock.invokeModel(req as any).promise()
    const body = JSON.parse(raw.body?.toString?.() || raw.body || '{}')
    const text = extractText(body)
    return { text, conversationId: payloadHash, model: MODEL_ID }
  }

  return { error: `Unknown operation: ${op}` }
}



