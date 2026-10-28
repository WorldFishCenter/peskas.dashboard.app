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
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import type { RouterInputs, RouterOutputs } from "@isomorphic/api";
import { activeCountry } from "@/config/countryConfig";
import { useT } from "@/i18n/use-lang";
import { trackEvent } from "@/lib/analytics";
import { useScope } from "@/store/filters";
import { api } from "@/trpc/react";

// The conversation and its charts load when the panel first opens.
const Chat = /* @__PURE__ */ lazy(() => import("@/components/askfish/chat"));

/** The filters picked on screen, as every AskFish procedure takes them. */
export type AskFishFilters = RouterInputs["askfish"]["suggestions"];
export type Answer = RouterOutputs["askfish"]["ask"];
/** A question and what came of it: no answer while AskFish works, `failed` when it couldn't. */
export type Turn = { id: number; question: string; answer?: Answer; failed?: boolean };
/** A question to send, typed or a suggestion's; `retry` is the failed turn it repeats. */
export type Ask = { question: string; suggestionId?: string; retry?: number };

/**
 * The top bar's AskFish button and the side panel it opens: one conversation
 * for the whole dashboard, kept while the reader moves between pages.
 */
export function AskFish() {
  const { t, lang } = useT();
  const { districts, months } = useScope();
  // Kept here, not in the panel, so closing it loses neither the conversation nor an answer on its way.
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(0);
  const ask = api.askfish.ask.useMutation();
  const filters: AskFishFilters = { districts, months, lang };

  const send = ({ question, suggestionId, retry }: Ask) => {
    const turn = nextId.current++;
    const settle = (result: Partial<Turn>) =>
      setTurns((all) => all.map((t) => (t.id === turn ? { ...t, ...result } : t)));
    setTurns((all) => [...all.filter((t) => t.id !== retry), { id: turn, question }]);
    trackEvent("askfish_ask", { control_source: suggestionId ? "suggestion" : "typed" });
    ask.mutateAsync({ ...filters, question, suggestionId }).then(
      (answer) => settle({ answer }),
      () => settle({ failed: true }),
    );
  };

  return (
    <Sheet onOpenChange={(open) => open && trackEvent("askfish_open")}>
      {/* An icon with a tooltip, like the theme switch beside it: the top bar has no room for
          the name until the widest screens, Portuguese labels being the longest. */}
      <Tooltip>
        <TooltipTrigger render={<SheetTrigger render={<Button variant="ghost" size="sm" />} />}>
          <SparklesIcon data-icon="inline-start" />
          <span className="max-2xl:sr-only">AskFish</span>
        </TooltipTrigger>
        <TooltipContent>{t("text-askfish-tooltip")}</TooltipContent>
      </Tooltip>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>AskFish</SheetTitle>
          <SheetDescription>
            {t("text-askfish-context", { country: activeCountry.countryName })}
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <Suspense fallback={<Skeleton className="m-4 flex-1" />}>
          <Chat filters={filters} turns={turns} onAsk={send} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
