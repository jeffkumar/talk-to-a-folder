import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Allow static files
      const isStaticFile =
        /\.(jpg|jpeg|png|gif|svg|ico|webp|css|js|woff|woff2|ttf|eot)$/i.test(
          nextUrl.pathname
        );
      if (isStaticFile) {
        return true;
      }

      // Allow these paths without authentication
      const publicPaths = [
        "/privacy",
        "/terms",
        "/login",
        "/register",
        "/waitlist-status",
        "/forgot-password",
        "/reset-password",
      ];
      const isPublicPath = publicPaths.some((path) =>
        nextUrl.pathname.startsWith(path)
      );

      // Allow exact match for landing page
      const isLandingPage = nextUrl.pathname === "/";

      if (isPublicPath || isLandingPage) {
        return true;
      }

      // For all other routes, require authentication
      const isLoggedIn = Boolean(auth?.user);
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
