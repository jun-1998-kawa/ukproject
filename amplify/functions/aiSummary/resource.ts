import { defineFunction } from "@aws-amplify/backend";

export const aiSummary = defineFunction({
  name: "aiSummary",
  entry: "./handler.ts",
  environment: {
    // Use environment variable (falls back in handler if unset)
    MODEL_ID: process.env.MODEL_ID ?? "",
  },
});
