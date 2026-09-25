import { jwtVerify, SignJWT } from "jose";

import type { TGroup } from "@repo/nosql/schema/auth";
import { UserModel } from "@repo/nosql/schema/auth";

/**
 * Cookie sessions. The cookie holds an HS256 JWT with only the user id; the
 * user and their groups are read from Mongo on each request, so deactivating
 * an account or changing its role takes effect immediately.
 */
const SESSION_COOKIE = "peskas.session";

export type Session = {
  user: { id: string; name: string; email: string; groups: TGroup[] };
};

/** What a token may be used for: a reset link is never a session, and vice versa. */
type Audience = "session" | "reset-password";

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not defined");
  return new TextEncoder().encode(secret);
}

export function signToken(userId: string, audience: Audience, maxAgeSeconds: number) {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey());
}

/** The user id in `token` if it is valid for `audience`, else null. */
export async function verifyToken(token: string, audience: Audience) {
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { audience, algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

export async function readSession(headers: Headers): Promise<Session | null> {
  const token = headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;

  const id = await verifyToken(token, "session");
  if (!id) return null;

  const user = await UserModel.findById(id)
    .select({ name: 1, email: 1, groups: 1, status: 1 })
    .populate({ path: "groups", populate: { path: "permission_id", model: "Permission" } })
    .lean();
  if (!user || user.status === "inactive") return null;

  return { user: { id, name: user.name, email: user.email, groups: user.groups } };
}
