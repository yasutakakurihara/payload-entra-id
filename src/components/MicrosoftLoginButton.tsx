"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  const handleSignIn = () => {
    signIn(
      "microsoft-entra-id",
      {
        redirect: true,
      },
      {
        prompt: "select_account",
      }
    );
  };

  return (
    <button type="button" onClick={handleSignIn}>
      Sign in with Microsoft
    </button>
  );
}