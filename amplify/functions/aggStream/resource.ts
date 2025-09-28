import { defineFunction } from "@aws-amplify/backend";

// DynamoDB Streams aggregator (near real-time)
// Note: attach the DynamoDB Stream trigger to this Lambda from the AWS Console
//       for the underlying 'Point' table. See docs/CLAUDE.md.
export const aggStream = defineFunction({
  name: "aggStream",
  entry: "./handler.ts",
  environment: {
    // Set these after deployment (see docs/CLAUDE.md)
    AGG_TARGET_TABLE: process.env.AGG_TARGET_TABLE ?? "",
    AGG_METHOD_TABLE: process.env.AGG_METHOD_TABLE ?? "",
  },
});

