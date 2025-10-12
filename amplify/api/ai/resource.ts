import { defineApi } from "@aws-amplify/backend";
import { aiSummary } from "../../functions/aiSummary/resource";

export const ai = defineApi({
  name: "ai",
  authorizationType: "userPool",
  routes: [
    {
      path: "/ai/summary",
      method: "POST",
      function: aiSummary,
    },
  ],
  cors: {
    allowOrigins: ["*"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "OPTIONS"],
  },
});

