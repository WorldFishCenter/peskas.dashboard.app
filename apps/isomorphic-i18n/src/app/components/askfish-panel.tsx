"use client";

// STAGE 1 STEP 1: Embed AskFish as a separate application and pass only page
// context plus active filters. No rendered chart dataset or service credential
// is sent through postMessage.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { usePathname } from "next/navigation";

// STAGE 2 STEP 2.6.1: Read both Catch and Revenue metric atoms so one shared
// AskFish panel can emit the correct page-specific dashboard context.
import {
  districtsAtom,
  selectedMetricAtom,
  selectedRevenueMetricAtom,
} from "@/app/components/filter-selector";
import { selectedTimeRangeAtom } from "@/app/components/time-range-selector";
import { activeCountry } from "@/config/countryConfig";

// STAGE 1 STEP 1: Version the browser integration contract independently from
// the API operation so both applications can evolve safely.
const CONTEXT_MESSAGE = "PESKAS_PAGE_CONTEXT";
const READY_MESSAGE = "ASKFISH_READY";
const CONTEXT_VERSION = "1.0";

// STAGE 1 STEP 1: Keep a local development default while allowing every
// deployment to point at its separately hosted AskFish service.
const askFishUrl =
  process.env.NEXT_PUBLIC_ASKFISH_URL || "http://127.0.0.1:8000/embedded";

// STAGE 1 STEP 1: Match the dashboard's human-readable time-range labels while
// retaining a numeric/null value for the structured data operation.
function timeRangeLabel(value: string | number) {
  if (value === 3) return "Last 3 months";
  if (value === 6) return "Last 6 months";
  if (value === 12) return "Last year";
  if (value === 72) return "Last 6 years";
  return "All time";
}

// STAGE 2 STEP 2.6.1: Define the three dashboard pages that currently expose
// AskFish. Catch keeps its legacy operation for backward compatibility; Revenue
// and Catch Composition use the generic semantic-context operation.
type AskFishPageId = "catch_trends" | "revenue" | "catch_composition";

type AskFishPanelProps = {
  pageId?: AskFishPageId;
  pageTitle?: string;
};

// STAGE 2 STEP 2.6.1: Keep page semantics in one place instead of duplicating the
// iframe/postMessage component for every dashboard page.
const PAGE_CONFIG: Record<
  AskFishPageId,
  {
    defaultTitle: string;
    requestedOperation: "catch_trends.monthly_time_series.v1" | "dashboard.semantic_context.v1";
    metricMode: "catch" | "revenue" | "composition";
    supportsTimeFilter: boolean;
  }
> = {
  catch_trends: {
    defaultTitle: "Catch Analysis",
    requestedOperation: "catch_trends.monthly_time_series.v1",
    metricMode: "catch",
    supportsTimeFilter: true,
  },
  revenue: {
    defaultTitle: "Revenue Analysis",
    requestedOperation: "dashboard.semantic_context.v1",
    metricMode: "revenue",
    supportsTimeFilter: true,
  },
  catch_composition: {
    defaultTitle: "Catch Composition Analysis",
    requestedOperation: "dashboard.semantic_context.v1",
    metricMode: "composition",
    // STAGE 2 STEP 2.7: Production portal audits confirmed a real monthly `date`
    // field in taxa_summaries for all three deployments, so the page's existing
    // time selector is now a truthful hard constraint when restriction is enabled.
    supportsTimeFilter: true,
  },
};

// STAGE 2 STEP 2.7: Build and maintain page-aware context from the same Jotai
// atoms that drive Peskas. Catch Composition still carries catch_kg as its primary
// semantic metric, but its production-verified monthly taxa source now receives the
// same active time constraint as the visible dashboard charts.
export default function AskFishPanel({
  pageId = "catch_trends",
  pageTitle,
}: AskFishPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pathname = usePathname() || "/catch";
  const districts = useAtomValue(districtsAtom);
  // STAGE 2 STEP 2.6.1: Hooks are unconditional; page configuration chooses which
  // metric becomes authoritative after both atoms have been read.
  const catchMetric = useAtomValue(selectedMetricAtom);
  const revenueMetric = useAtomValue(selectedRevenueMetricAtom);
  const timeRange = useAtomValue(selectedTimeRangeAtom);
  const [isOpen, setIsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // STAGE 2 STEP 2.6.1: Resolve immutable semantics for the mounted dashboard page.
  const pageConfig = PAGE_CONFIG[pageId];
  const resolvedPageTitle = pageTitle || pageConfig.defaultTitle;
  // STAGE 2 STEP 2.7: Catch Composition has no metric selector, but catch_kg is
  // the page's primary composition measure and gives the suggestion profiler a stable,
  // catalog-valid measure while the shared time selector now applies normally.
  const metric =
    pageConfig.metricMode === "revenue"
      ? revenueMetric
      : pageConfig.metricMode === "catch"
        ? catchMetric
        : "catch_kg";
  const effectiveMonths =
    pageConfig.supportsTimeFilter && typeof timeRange === "number" ? timeRange : null;
  // STAGE 2 STEP 2.7: Every currently integrated page now has a production-verified
  // dated source, so the same human-readable dashboard period is propagated whenever
  // that page declares time support.
  const effectiveTimeRangeLabel = pageConfig.supportsTimeFilter
    ? timeRangeLabel(timeRange)
    : "All time";

  const askFishOrigin = useMemo(() => new URL(askFishUrl).origin, []);
  const locale = useMemo(() => {
    const candidate = pathname.split("/").filter(Boolean)[0];
    return activeCountry.languages.includes(candidate) ? candidate : activeCountry.languages[0];
  }, [pathname]);

  const context = useMemo(
    () => ({
      type: CONTEXT_MESSAGE,
      version: CONTEXT_VERSION,
      payload: {
        page: {
          // STAGE 2 STEP 2.6.1: Revenue and Catch Composition now use their real
          // catalog page IDs; the legacy Catch ID is retained for compatibility.
          id: pageId,
          route: pathname,
          title: resolvedPageTitle,
        },
        country: {
          code: activeCountry.countryCode,
          name: activeCountry.countryName,
        },
        locale,
        filters: {
          districts,
          // STAGE 2 STEP 2.6.1: Catch Composition reports catch_kg as its primary
          // page measure so existing schema/data-aware suggestion profiling remains useful.
          // Peskas still allows other catalogued taxa measures inside this page scope.
          metric,
          months: effectiveMonths,
          timeRangeLabel: effectiveTimeRangeLabel,
        },
        requestedOperation: pageConfig.requestedOperation,
      },
    }),
    // STAGE 2 STEP 2.6.1: Re-send context whenever any page-specific semantic
    // input changes, including route/title and the selected page metric.
    [districts, effectiveMonths, effectiveTimeRangeLabel, locale, metric, pageConfig.requestedOperation, pageId, pathname, resolvedPageTitle],
  );

  // STAGE 1 STEP 1: Send context only to the configured AskFish origin and only
  // to the iframe window owned by this panel.
  const postContext = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(context, askFishOrigin);
  }, [askFishOrigin, context]);

  // STAGE 1 STEP 1: Complete a two-way readiness handshake before sending the
  // first context payload. This avoids races during iframe startup.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== askFishOrigin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.type !== READY_MESSAGE
      ) {
        return;
      }
      setIsReady(true);
      postContext();
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [askFishOrigin, postContext]);

  // STAGE 2 STEP 2.6.1: Re-send validated context whenever a user changes an
  // active dashboard filter on any integrated page while AskFish is open.
  useEffect(() => {
    if (isOpen && isReady) postContext();
  }, [isOpen, isReady, postContext]);

  // STAGE 1 STEP 1: Reset readiness when the iframe is removed so a reopened
  // panel performs a fresh handshake.
  useEffect(() => {
    if (!isOpen) setIsReady(false);
  }, [isOpen]);

  return (
    <>
      {/* STAGE 2 STEP 2.6.1: Shared entry point for Catch, Revenue, and Catch Composition. */}
      <div className="mb-4 flex justify-end md:mb-6">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Ask this dashboard
        </button>
      </div>

      {/* STAGE 1 STEP 1: Use a side panel on wide screens and a full-screen panel on mobile. */}
      {isOpen && (
        <div className="fixed inset-0 z-[2100] flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close AskFish"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <section className="relative h-full w-full bg-white shadow-2xl sm:w-[min(720px,92vw)]">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div>
                <div className="font-semibold text-gray-900">AskFish</div>
                <div className="text-xs text-gray-500">{resolvedPageTitle} context</div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>
            <iframe
              ref={iframeRef}
              src={askFishUrl}
              title={`AskFish ${resolvedPageTitle} assistant`}
              className="h-[calc(100%_-_3.5rem)] w-full border-0"
              onLoad={() => {
                // STAGE 1 STEP 1: Use an exact-origin onLoad send as a safe fallback
                // when browser referrer policy prevents the READY handshake.
                setIsReady(true);
                postContext();
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
              allow="clipboard-write"
            />
          </section>
        </div>
      )}
    </>
  );
}
