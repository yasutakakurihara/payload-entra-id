import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { withPayload } from "payload-authjs";
import payloadConfig from "@payload-config";


export const { handlers: { GET, POST }, signIn, signOut, auth } = NextAuth(
  withPayload(authConfig, {
    payloadConfig,
    updateUserOnSignIn:true,
  }),
);
