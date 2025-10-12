AI summary via Amazon Bedrock

Updated: 2025-10-11

Overview
- Adds a new Amplify REST API route POST /ai/summary backed by Lambda function aiSummary.
- The Lambda calls Amazon Bedrock (Anthropic Claude) to generate a Japanese summary and supports follow‑up Q&A using the same context.

Files
- amplify/functions/aiSummary/handler.ts — Bedrock invocation (AWS SDK v2)
- amplify/functions/aiSummary/resource.ts — function definition
- amplify/api/ai/resource.ts — REST API (user pool auth, CORS enabled)
- amplify/backend.ts — includes api + function
- web/src/components/ChatSummaryModal.tsx — UI modal for summary + Q&A
- web/src/components/Dashboard.tsx — adds 🤖 button to open modal

Model choice (cost/perf)
- Default: MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0 (widely available, low cost, strong JP summarization)
- Recommended: Upgrade to Claude 3.5 Haiku when available in your region (e.g., anthropic.claude-3-5-haiku-20241022-v1:0) for better reasoning at similar cost.

Deploy steps
1) Ensure Amplify CLI/Gen2 is up to date and deploy:
   - npm run sandbox (or amplify sandbox) to preview
   - amplify push to deploy
2) Grant Lambda permission to invoke Bedrock:
   - Using AWS CLI on Tokyo (ap-northeast-1) with the default model:
     powershell -ExecutionPolicy Bypass -File scripts/grantBedrock.ps1 -Region ap-northeast-1 -ModelId anthropic.claude-3-haiku-20240307-v1:0 -FunctionName aiSummary
3) Set environment variable MODEL_ID on the aiSummary function to switch models without code changes.
   - Console: Lambda → aiSummary → Configuration → Environment variables → MODEL_ID
   - CLI (Tokyo example):
     powershell -ExecutionPolicy Bypass -File scripts/setModelId.ps1 -Region ap-northeast-1 -FunctionName aiSummary -ModelId anthropic.claude-3-haiku-20240307-v1:0

Frontend config
- The Amplify outputs will include api.ai.url; App.tsx passes this as aiUrl to Dashboard.
- If running locally, you can also set window.__aiUrl to override.

Request format
POST {api.ai.url}/ai/summary with Cognito ID token in Authorization header.
Body (JSON): { language, playerName, filters, stats, notes, question?, history? }

Notes
- The Lambda is stateless; Q&A is maintained client‑side via history[] in the request.
- Temperature is set low (0.2) for stable, grounded outputs.
