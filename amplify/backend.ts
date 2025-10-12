import { defineBackend } from "@aws-amplify/backend";
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

