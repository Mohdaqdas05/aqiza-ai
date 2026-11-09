import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { getConfiguredAuthProviders } from "@/lib/auth-providers";

export const configuredAuthProviders = getConfiguredAuthProviders();
const providers: Provider[] = [];

if (configuredAuthProviders.includes("google")) {
  providers.push(Google({
    clientId: process.env.AUTH_GOOGLE_ID!.trim(),
    clientSecret: process.env.AUTH_GOOGLE_SECRET!.trim(),
  }));
}

if (configuredAuthProviders.includes("github")) {
  providers.push(GitHub({
    clientId: process.env.AUTH_GITHUB_ID!.trim(),
    clientSecret: process.env.AUTH_GITHUB_SECRET!.trim(),
  }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "database" },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});

