import { defineBackend } from "@aws-amplify/backend";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.ts";
import { data } from "./data/resource.ts";
import { aggStream } from "./functions/aggStream/resource.ts";
import { aiCoach } from "./functions/aiCoach/resource.ts";

// Central backend composition for Amplify Gen 2
export const backend = defineBackend({
  auth,
  data,
  aggStream,
  aiCoach,
});

// Grant aiCoach Lambda read access to S3 for system prompt loading
// Bucket name is specified via AI_PROMPT_S3_BUCKET environment variable
if (process.env.AI_PROMPT_S3_BUCKET) {
  const s3ReadPolicy = new Policy(backend.aiCoach.resources.lambda, "S3PromptReadPolicy", {
    statements: [
      new PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`arn:aws:s3:::${process.env.AI_PROMPT_S3_BUCKET}/*`],
      }),
    ],
  });
  backend.aiCoach.resources.lambda.role?.attachInlinePolicy(s3ReadPolicy);
}

