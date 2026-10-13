import { lazy, Suspense, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Skeleton } from "@workspace/ui/components/skeleton";
import type { RouterInputs, RouterOutputs } from "@isomorphic/api";
import { ASKFISH_PAGES } from "@repo/domain/askfish";
import type { Page, PageMetric } from "@/config/routes";
import { useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { usePageMetric, useScope } from "@/store/filters";
import { api } from "@/trpc/react";

/*
 * AskFish answers questions about the page's data. The dashboard draws the
 * conversation itself; the answers come from the AskFish service through the
 * `askfish` procedures (`packages/api/src/router/askfish.ts`), so the browser
 * never talks to AskFish.
 */

// The conversation and its charts load when the panel first opens.
const Chat = lazy(() => import("@/components/askfish/chat"));

/** The page and its filters, as every AskFish procedure takes them. */
export type AskFishScope = RouterInputs["askfish"]["suggestions"];
export type Answer = RouterOutputs["askfish"]["ask"];
/** A question and what came of it: no answer while AskFish works, `failed` when it couldn't. */
export type Turn = { id: number; question: string; answer?: Answer; failed?: boolean };

// Hooks can't be skipped: a page without a metric picker reads this empty one.
const NO_PICKER: PageMetric = { default: "mean_cpue", options: [] };

/** The page header's AskFish button and the side panel it opens; nothing on a page without AskFish. */
export function AskFish({ page }: { page: Page }) {
  const { t, lang } = useT();
  const { districts, months } = useScope();
  const [picked] = usePageMetric(page.metric ?? NO_PICKER);
  // Kept here, not in the panel, so closing it loses neither the conversation nor an answer on its way.
  const [turns, setTurns] = useState<Turn[]>([]);
  const [restrict, setRestrict] = useState(true);
  const nextId = useRef(0);
  const ask = api.askfish.ask.useMutation();

  const id = page.askfish;
  if (!id) return null;
  // A page without a metric picker has one measure: the only one AskFish lists for it.
  const metric = page.metric ? picked : ASKFISH_PAGES[id].metrics[0];
  const scope: AskFishScope = { page: id, metric, districts, months, lang, restrict };

  /** Ask a question, typed or a suggestion's; `retry` replaces the failed turn it repeats. */
  const send = (question: string, suggestionId?: string, retry?: number) => {
    const turn = nextId.current++;
    const settle = (result: Partial<Turn>) =>
      setTurns((all) => all.map((t) => (t.id === turn ? { ...t, ...result } : t)));
    setTurns((all) => [...all.filter((t) => t.id !== retry), { id: turn, question }]);
    trackEvent("askfish_ask", { control_source: suggestionId ? "suggestion" : "typed" });
    ask.mutateAsync({ ...scope, question, suggestionId }).then(
      (answer) => settle({ answer }),
      () => settle({ failed: true }),
    );
  };

  return (
    <Sheet onOpenChange={(open) => open && trackEvent("askfish_open")}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <SparklesIcon data-icon="inline-start" />
        {t("text-askfish-open")}
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>AskFish</SheetTitle>
          <SheetDescription>
            {t("text-askfish-context", { page: t(page.titleKey) })}
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <Suspense fallback={<Skeleton className="m-4 flex-1" />}>
          <Chat scope={scope} turns={turns} onAsk={send} onRestrict={setRestrict} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
