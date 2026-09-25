import bcryptjs from "bcryptjs";
import get from "lodash/get";
import pick from "lodash/pick";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import InvalidPayloadError from "@/lib/errors/InvalidPayloadError";
import UserInactiveError from "@/lib/errors/UserInactiveError";
import UserNoPasswordError from "@/lib/errors/UserNoPasswordError";
import UserNotFoundError from "@/lib/errors/UserNotFoundError";
import { env } from "@/env.mjs";
import { loginSchema } from "@/validators/login.schema";
import getDb from "@repo/nosql";
import { UserModel } from "@repo/nosql/schema/auth";
import { MDMongooseAdapter } from "./mongoose-adapter";

export const authOptions: NextAuthOptions = {
  adapter: MDMongooseAdapter(),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.maxAge = user.maxAge;
        token.groups = user.groups;
        token.bmus = user.bmus;
        token.userBmu = user.userBmu;
        token.fisherId = user.fisherId;
      }
      return token;
    },
    async session({ session, token }) {
      const expiry = get(token, "maxAge")
        ? {
            maxAge: token.maxAge as number,
            expires: new Date(
              Date.now() + (token.maxAge as number) * 1000
            ).toISOString(),
          }
        : {};

      return {
        ...session,
        ...expiry,
        user: {
          ...session.user,
          id: token.id as string | undefined,
          name: token.name,
          email: token.email,
          groups: token.groups,
          bmus: token.bmus,
          userBmu: token.userBmu,
          fisherId: token.fisherId as string | undefined,
        },
      };
    },
    async redirect({ baseUrl }) {
      return baseUrl;
    },
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {},
      async authorize(credentials) {
        const rememberMe = get(credentials, "rememberMe") === "true";
        const parsedCredentials = loginSchema.safeParse({
          ...credentials,
          rememberMe,
        });

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          await getDb();
          const user = await UserModel.findOne({ email: email })
            .select('+fisherId') // Explicitly include fisherId
            .populate([
              {
                path: "groups",
                populate: {
                  path: "permission_id",
                  model: "Permission",
                },
              },
              {
                path: "bmus",
                select: { BMU: true, group: true },
              },
              {
                path: "userBmu",
                select: { BMU: true, group: true },
              },
            ])
            .lean();
          

          
          if (!user) throw new UserNotFoundError();

          if (!user.password) {
            throw new UserNoPasswordError();
          }

          /**
           * Deactivated accounts are rejected before the password is even
           * considered, so a correct password cannot grant them a session.
           */
          if (user.status === "inactive") throw new UserInactiveError();

          const passwordsMatch = await bcryptjs.compare(password, user.password);

          if (passwordsMatch) {
            /**
             * If remember me is enabled, maxAge is 1 month.
             * Otherwise 1 day only.
             */
            const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

            // Ensure userBmu is properly serialized
            const serializedUserBmu = user.userBmu ? {
              _id: user.userBmu._id.toString(),
              BMU: user.userBmu.BMU,
              group: user.userBmu.group
            } : undefined;

            return {
              ...pick(user, ["email", "groups", "bmus", "name", "fisherId"]),
              id: user._id.toString(),
              userBmu: serializedUserBmu,
              maxAge,
            };
          }
        }
        throw new InvalidPayloadError();
      },
    }),
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || "",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
};
