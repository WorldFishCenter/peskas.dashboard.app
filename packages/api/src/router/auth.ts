import bcryptjs from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { UserModel } from "@repo/nosql/schema/auth";

import { sessionCookie, signToken } from "../lib/auth";
import { createTRPCRouter, publicProcedure } from "../trpc";

const DAY = 24 * 60 * 60;

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const authRouter = createTRPCRouter({
  signIn: publicProcedure.input(SignInSchema).mutation(async ({ input, ctx }) => {
    const user = await UserModel.findOne({ email: input.email }).select({ password: 1, status: 1 }).lean();

    // One message for an unknown email, a missing password and a wrong one,
    // so the form cannot be used to find out which emails have accounts.
    const valid = !!user?.password && (await bcryptjs.compare(input.password, user.password));
    if (!user || !valid) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password." });
    }
    if (user.status === "inactive") {
      throw new TRPCError({ code: "FORBIDDEN", message: "User account is inactive." });
    }

    const maxAge = input.rememberMe ? 30 * DAY : DAY;
    const token = await signToken(user._id.toString(), "session", maxAge);
    ctx.resHeaders.append("Set-Cookie", sessionCookie(token, maxAge));
  }),
});
