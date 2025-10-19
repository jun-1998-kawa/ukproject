import { defineFunction } from "@aws-amplify/backend";

// AI coach / summarization & QA via Amazon Bedrock
// The underlying model is selected via env var `AI_MODEL_ID`.
// Example: "anthropic.claude-3-5-sonnet-20240620-v1:0"
// Bedrock region can be set via `AI_BEDROCK_REGION` (defaults to Lambda's region)
// System prompt priority: S3 → Environment Variable → Default
//   - S3: AI_PROMPT_S3_BUCKET + AI_PROMPT_S3_KEY
//   - Env: AI_SYSTEM_PROMPT
export const aiCoach = defineFunction({
  name: "aiCoach",
  entry: "./handler.ts",
  environment: {
    AI_MODEL_ID: process.env.AI_MODEL_ID ?? "",
    AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT ?? "",
    AI_BEDROCK_REGION: process.env.AI_BEDROCK_REGION ?? "",
    AI_PROMPT_S3_BUCKET: process.env.AI_PROMPT_S3_BUCKET ?? "",
    AI_PROMPT_S3_KEY: process.env.AI_PROMPT_S3_KEY ?? "prompts/system-prompt.txt",
  },
});

