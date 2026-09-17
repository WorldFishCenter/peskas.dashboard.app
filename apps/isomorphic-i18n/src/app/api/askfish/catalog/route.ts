// STAGE 2 STEP 2.2: Expose the validated semantic catalog through the same private
// server-to-server trust boundary used by the Catch Trends adapter. The browser
// does not need the service token and cannot select a different deployment.
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { semanticCatalogForCountry } from "@/askfish/semantic-catalog";
import { activeCountry } from "@/config/countryConfig";

// STAGE 2 STEP 2.2: Keep this route on the Node runtime because the service-token
// comparison uses Node crypto and the catalog is deployment/server metadata.
export const runtime = "nodejs";

// STAGE 2 STEP 2.2: Reuse constant-time bearer-token semantics without exposing
// whether any token prefix matched.
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

// STAGE 2 STEP 2.2: Return only the planner-safe catalog projection for the active
// deployment. Discovery-only lower-grain sources remain explicitly non-queryable.
export async function GET(request: NextRequest) {
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
    return NextResponse.json(semanticCatalogForCountry(activeCountry.countryCode));
  } catch (error) {
    console.error("AskFish semantic catalog validation error:", error);
    return NextResponse.json(
      { error: "Peskas semantic catalog is invalid for this deployment." },
      { status: 500 },
    );
  }
}
