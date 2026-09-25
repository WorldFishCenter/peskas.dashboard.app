import intersection from "lodash/intersection";
import isEqual from "lodash/isEqual";
import sortBy from "lodash/sortBy";
import { TRPCError } from "@trpc/server";

import type { TGroup, TPermission } from "@repo/nosql/schema/auth";

import type { Session } from "./auth";

/**
 * Single source of truth for permission checks.
 *
 * A user passes when any of their groups carries a permission domain for
 * `resource` that grants every one of the requested `actions`. Both the tRPC
 * procedures and the UI read from this function, so a menu entry can never
 * disagree with what the server actually allows.
 */
export function hasPermission(
  groups?: TGroup[],
  resource?: string,
  actions?: string[]
) {
  if (!groups) return false;

  return groups.some((group) => {
    const perm = group.permission_id as unknown as TPermission | undefined;
    return perm?.domain.some(
      (dom) =>
        dom.resource === resource &&
        isEqual(sortBy(intersection(dom.actions, actions)), sortBy(actions))
    );
  });
}

/**
 * Throws FORBIDDEN unless the session carries the requested permission.
 * `protectedProcedure` only proves that someone is signed in; mutations that
 * act on other people's records need this on top.
 */
export function assertPermission(
  session: Session,
  resource: string,
  actions: string[]
) {
  if (!hasPermission(session.user.groups, resource, actions)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Missing ${actions.join("/")} permission on ${resource}`,
    });
  }
}
