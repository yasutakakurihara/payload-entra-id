import type { NextAuthConfig, Session, DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt, { JwtPayload } from "jsonwebtoken";
import { syncUserWithPayload } from './app/actions/auth';

declare module "next-auth" {
  interface Session extends DefaultSession {
    error?: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
      emailVerified: Date | null;
      role: string;
    } & DefaultSession["user"];
  }
}

const LoggerMessages = {
  emptyAccessToken: "アクセストークンが取得できませんでした",
  emptySub: "ユーザー識別子 (sub) が取得できませんでした",
  expiredAccessToken: "アクセストークンの有効期限が切れています",
  startedToRefreshAccessToken: "アクセストークンの更新を開始します",
  failedToRefreshAccessToken: "アクセストークンの更新に失敗しました",
  successToRefreshAccessToken: "アクセストークンの更新に成功しました",
} as const;

export const ErrorCodes = {
  emptyAccessToken: "EMPTY_ACCESS_TOKEN",
  emptySub: "EMPTY_SUB",
  failedToRefreshAccessToken: "FAILED_TO_REFRESH_ACCESS_TOKEN",
} as const;

const msalInstance = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  },
});

/**
 * refreshAccessToken
 * リフレッシュトークンを使用してアクセストークンを更新
 *
 * @param refreshToken - リフレッシュトークン
 */
async function refreshAccessToken(refreshToken: string) {
  console.log("refreshAccessToken", LoggerMessages.startedToRefreshAccessToken);
  try {
    const response = await msalInstance.acquireTokenByRefreshToken({
      refreshToken,
      scopes: ["openid", "profile", "email"],
    });

    if (!response?.accessToken) {
      throw new Error(LoggerMessages.failedToRefreshAccessToken);
    }
    console.log("refreshAccessToken", LoggerMessages.successToRefreshAccessToken);

    return {
      idToken: response.idToken,
      accessToken: response.accessToken,
      expiresAt: response.expiresOn?.getTime() ?? Date.now() + 3600 * 1000,
    };
  } catch (error) {
    console.error("refreshAccessToken", LoggerMessages.failedToRefreshAccessToken, error);
    return null;
  }
}

interface CustomToken extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  idToken?: string;
  emailVerified?: Date | null;
  error?: string;
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_CLIENT_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
      allowDangerousEmailAccountLinking:true,
      authorization: {
        params: {
          scope: "openid profile email offline_access",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }): Promise<CustomToken> {
      const customToken = token as CustomToken;

      if (account) {
        const { id_token, access_token, refresh_token, expires_in } = account;
        if (id_token) {
          const decoded = jwt.decode(id_token) as JwtPayload;
          customToken.emailVerified = decoded?.email_verified ? new Date() : null;
        }
        customToken.accessToken = access_token ?? customToken.accessToken;
        customToken.refreshToken = refresh_token ?? customToken.refreshToken;
        customToken.expiresAt = expires_in ? Date.now() + expires_in * 1000 : customToken.expiresAt;
        customToken.error = undefined;
      }

      if (profile) {
        // customToken.sub = profile.sub ?? customToken.sub;
        customToken.sub = profile.sub ?? customToken.sub;
        customToken.oid = profile.oid ?? customToken.oid;
        customToken.email = profile.email ?? customToken.email;
        customToken.name = profile.name ?? customToken.name;
      }

      if (!customToken.accessToken) {
        console.error("authConfig.callback.jwt", LoggerMessages.emptyAccessToken);
        customToken.error = ErrorCodes.emptyAccessToken;
      }

      if (!customToken.sub) {
        console.error("authConfig.callback.jwt", LoggerMessages.emptySub);
        customToken.error = ErrorCodes.emptySub;
      }

      // アクセストークンの有効期限が切れている場合
      // リフレッシュトークンを使用してトークンを更新
      const isExpiredToken = customToken.expiresAt && Date.now() >= customToken.expiresAt;
      if (isExpiredToken && customToken.refreshToken) {
        const refreshedTokens = await refreshAccessToken(customToken.refreshToken);
        if (refreshedTokens && refreshedTokens.accessToken) {
          customToken.idToken = refreshedTokens.idToken;
          customToken.accessToken = refreshedTokens.accessToken;
          customToken.expiresAt = refreshedTokens.expiresAt;
          customToken.error = undefined;
        } else {
          customToken.error = ErrorCodes.failedToRefreshAccessToken;
        }
      }

      return customToken;
    },
    async session({ session, token }): Promise<Session> {
      session.user = {
        // id: token.sub!,
        id: token.oid! as string,
        name: token.name!,
        email: token.email!,
        emailVerified: (token as CustomToken).emailVerified ?? null,
        role: "admin"
      };
      session.error = (token as CustomToken).error ?? null;
      return session;
    },
    async signIn({ user, account, profile }) {
      try {
        console.log('Auth.js user object:', user);
        console.log('Auth.js account object:', account);
        console.log('Raw profile from Entra ID:', profile);
        
        // すべての利用可能なIDを確認
        console.log('Available IDs:', {
          userId: user.id,
          accountId: account?.providerAccountId,
          profileOid: profile?.oid,
          profileSub: profile?.sub,
          // その他のIDフィールド
        });

        // サーバーアクションを使用してユーザーを同期
        await syncUserWithPayload(user, profile);
        console.log('サインイン成功:', { user, account, profile });
        return true;
      } catch (error) {
        console.error('サインインエラー:', error);
        return false;
      }
    },
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  }  
};
