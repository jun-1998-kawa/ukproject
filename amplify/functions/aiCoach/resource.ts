import { defineFunction } from "@aws-amplify/backend";

// AI coach / summarization & QA via Amazon Bedrock
// The underlying model is selected via env var `AI_MODEL_ID`.
// Example: "anthropic.claude-3-5-sonnet-20240620-v1:0"
export const aiCoach = defineFunction({
  name: "aiCoach",
  entry: "./handler.ts",
  environment: {
    AI_MODEL_ID: process.env.AI_MODEL_ID ?? "",
    AI_SYSTEM_PROMPT: process.env.AI_SYSTEM_PROMPT ?? "",
  },
});

