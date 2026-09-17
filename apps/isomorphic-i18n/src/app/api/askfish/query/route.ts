// STAGE 2 STEP 2.3: Expose the generic catalog-validated source-record query through
// the existing private AskFish service boundary. The browser never receives the
// service credential and cannot submit MongoDB fields/operators/collections directly.
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { AskFishQueryError, executeAskFishQuery } from "@/askfish/query";

// STAGE 2 STEP 2.3: Pin to Node because the query executor uses the MongoDB/Mongoose
// connection and Node's constant-time service-token comparison.
export const runtime = "nodejs";

// STAGE 2 STEP 2.3: Keep service authentication identical to the existing catalog and
// Catch Trends endpoints so one server-side credential governs the integration surface.
function serviceTokenStatus(request: NextRequest) {
  const expected = process.env.ASKFISH_SERVICE_TOKEN;
  if (!expected) return { configured: false, valid: false };

  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const valid =
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  return { configured: true, valid };
}

// STAGE 2 STEP 2.3: Execute only the generic semantic contract. Validation errors are
// returned explicitly; unexpected database/runtime errors stay opaque to the caller.
export async function POST(request: NextRequest) {
  const tokenStatus = serviceTokenStatus(request);
  if (!tokenStatus.configured) {
    return NextResponse.json(
      { error: "ASKFISH_SERVICE_TOKEN is not configured." },
      { status: 503 },
    );
  }
  if (!tokenStatus.valid) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = await request.json().catch(() => null);
    return NextResponse.json(await executeAskFishQuery(payload));
  } catch (error) {
    if (error instanceof AskFishQueryError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("AskFish generic query failure:", error);
    return NextResponse.json(
      { error: "Peskas could not execute the validated AskFish query." },
      { status: 500 },
    );
  }
}
