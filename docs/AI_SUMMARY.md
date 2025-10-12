AI Summary (Bedrock) – Frontend-first integration

Goal
- Add a summary + Q&A feature without touching existing Amplify backend build.
- Frontend calls a REST endpoint whose URL is provided via env or window.

How the web app finds the AI endpoint
- Build-time env: set Vite env `VITE_AI_API_URL` to your HTTPS endpoint.
  - Example: VITE_AI_API_URL=https://abc123.execute-api.ap-northeast-1.amazonaws.com/prod
- Runtime override: define `window.__aiUrl = 'https://...';` in index.html or via a small inline script from your hosting.

Frontend changes included
- web/src/components/ChatSummaryModal.tsx — modal UI for summary & Q&A
- web/src/components/Dashboard.tsx — adds a 🤖 AI button and mounts the modal
  - It sends: { language, playerName, filters, stats, notes } to POST /ai/summary
  - It sends an ID token in Authorization header when available (Amplify Auth)

Backend endpoint (example)
- Implement a small Lambda + API Gateway (or Lambda Function URL) that proxies to Amazon Bedrock (Anthropic Claude 3/3.5 Haiku).
- Enable CORS (Allow-Origin: * or your domain). Expect a JSON body and return { ok:true, answer:string }.
- IAM: allow `bedrock:InvokeModel` on the chosen model ID in your region (Tokyo: `anthropic.claude-3-haiku-20240307-v1:0`).

Minimal request body (from client)
{
  "language": "ja|en",
  "playerName": "...",
  "filters": { ... },
  "stats": { ... },
  "notes": [ { "match": "...", "comment": "..." } ],
  "question": "...",      // optional follow-up
  "history": [ { "role":"user|assistant", "content":"..." } ] // optional
}

Model selection
- Default recommendation for Tokyo: Claude 3 Haiku (low cost, strong JP). MODEL_ID: `anthropic.claude-3-haiku-20240307-v1:0`.
- If/when available in ap-northeast-1, consider Claude 3.5 Haiku for better reasoning at similar price.

Notes
- This approach avoids modifying Amplify Gen2 backend resources, keeping CI/CD stable.
- If you prefer to integrate via Amplify’s defineApi, add a new REST API and Lambda, then expose its URL in amplify_outputs.json; the UI will also pick `window.__aiUrl`/`VITE_AI_API_URL` so you can switch without code changes.

