/*
  AI Summary + Q&A via Amazon Bedrock (Anthropic Claude)
  - Exposed behind API Gateway (Amplify defineApi) as POST /ai/summary
  - Request body (JSON):
      {
        \"language\": \"ja\"|\"en\",
        \"playerName\": string,
        \"filters\": { from?: string, to?: string, tournament?: string, official?: string },
        \"notes\": [ { match?: string, comment: string } ],
        \"stats\": any, // compact stats object from Dashboard
        \"question\"?: string, // if provided, treat as follow-up Q&A
        \"history\"?: { role: 'user'|'assistant', content: string }[]
      }
  - Environment:
      MODEL_ID (optional, default: Claude 3 Haiku v20240307)
      AWS_REGION (provided by Lambda runtime)
  - IAM: allow bedrock:InvokeModel on the chosen MODEL_ID
*/
import AWS from 'aws-sdk'

const bedrock = new AWS.BedrockRuntime({ region: process.env.AWS_REGION })
const MODEL_ID = process.env.MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0'

type ChatTurn = { role: 'user'|'assistant', content: string }

function json(obj: any, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'OPTIONS,POST',
    },
    body: JSON.stringify(obj),
  }
}

function buildSystemPrompt(lang: string) {
  const jp = `あなたは大学剣道チームのデータアナリストです。\n`+
    `入力として、選手に関する集計（取得技・被取得技、勝敗、時間分布など）と、分析コメント（試合ごとのメモ）が与えられます。\n`+
    `求める出力:\n`+
    `1) 100〜180字程度の要約（全体像）\n`+
    `2) 強み/課題の箇条書き（各3項目まで、数値根拠を簡潔に）\n`+
    `3) 次戦への示唆（短く具体的に）\n`+
    `制約: 与えられたデータ内で推論し、断定を避け、数値は出典（指標名）を併記。`;
  const en = `You are a data analyst for a university kendo team.\n`+
    `You receive player aggregates (scored/conceded techniques, W/L, timing) and qualitative notes.\n`+
    `Output: (1) 1–2 short sentences summary, (2) bullets: strengths/risks with numeric cues, (3) concrete next steps.\n`+
    `Constraints: Grounded strictly in provided data; avoid overclaiming; cite metric names with numbers.`
  return lang === 'en' ? en : jp
}

function sanitizeNotes(notes: any[]): { match?: string, comment: string }[] {
  if (!Array.isArray(notes)) return []
  return notes
    .map((n) => ({ match: typeof n?.match === 'string' ? n.match : undefined, comment: String(n?.comment ?? '').slice(0, 1000) }))
    .filter((n) => n.comment)
    .slice(0, 200)
}

exports.handler = async (event: any) => {
  if (event?.httpMethod === 'OPTIONS') return json({ ok: true })
  try {
    const body = typeof event?.body === 'string' ? JSON.parse(event.body) : (event?.body || {})
    const language = (body?.language === 'en' ? 'en' : 'ja') as 'ja'|'en'
    const playerName = String(body?.playerName || '').slice(0, 200)
    const filters = body?.filters || {}
    const stats = body?.stats || {}
    const notes = sanitizeNotes(body?.notes || [])
    const question: string | undefined = body?.question ? String(body.question).slice(0, 2000) : undefined
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history.filter((h:any)=> h && (h.role==='user' || h.role==='assistant') && typeof h.content==='string').slice(0, 10) : []

    // Minimal guardrails
    if (!playerName) return json({ error: 'playerName required' }, 400)

    const system = buildSystemPrompt(language)
    const context = { playerName, filters, stats, notes }

    const messages: { role: 'user'|'assistant', content: { type: 'text', text: string }[] }[] = []
    // Convert history if provided
    for (const h of history) {
      messages.push({ role: h.role, content: [{ type: 'text', text: h.content }] })
    }

    // First turn content: provide context JSON, then the instruction or question
    const header = language === 'en' ? `Context JSON for ${playerName}:` : `コンテキスト（${playerName}）:`
    const baseInstruction = question
      ? (language === 'en' ? 'Answer the user question strictly using the context.' : '以下の質問に、コンテキストの範囲で簡潔に回答してください。')
      : (language === 'en' ? 'Write the requested summary now.' : '要約を作成してください。')

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `${header}\n\n${JSON.stringify(context).slice(0, 180000)}` },
        { type: 'text', text: baseInstruction },
      ],
    })

    // If a specific question is present, append it
    if (question) {
      messages.push({ role: 'user', content: [{ type: 'text', text: question }] })
    }

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      messages,
      system,
      max_tokens: 800,
      temperature: 0.2,
    }

    const resp = await bedrock.invokeModel({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    }).promise()

    const raw = resp.body ? resp.body.toString() : '{}'
    let parsed: any = {}
    try { parsed = JSON.parse(raw) } catch {}
    const text: string = parsed?.content?.[0]?.text || parsed?.output_text || ''

    return json({ ok: true, model: MODEL_ID, answer: text })
  } catch (e: any) {
    console.error('ai/summary error', e)
    return json({ error: String(e?.message ?? e) }, 500)
  }
}

