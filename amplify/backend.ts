import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { aggStream } from "./functions/aggStream/resource";

// Central backend composition for Amplify Gen 2
export const backend = defineBackend({
  auth,
  data,
  aggStream,
});
