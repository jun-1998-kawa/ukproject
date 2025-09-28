import { defineAuth } from "@aws-amplify/backend";

// Email/password auth with user groups for RBAC
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  // User groups used in data access rules
  groups: ["ADMINS", "COACHES", "ANALYSTS", "VIEWERS"],
});

