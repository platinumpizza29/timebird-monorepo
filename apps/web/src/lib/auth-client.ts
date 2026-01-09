import { env } from "@timebird/env/web";
import { createAuthClient } from "better-auth/react";

// Browser auth client, pointed at the server base URL.
export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
});
