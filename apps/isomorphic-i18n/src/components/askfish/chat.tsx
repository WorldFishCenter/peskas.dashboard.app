import { useState } from "react";
import { ArrowUpIcon, CircleHelpIcon, MapPinnedIcon, type LucideIcon } from "lucide-react";
import { Bubble, BubbleContent, BubbleGroup } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group";
import { Message, MessageContent } from "@workspace/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import { Separator } from "@workspace/ui/components/separator";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Spinner } from "@workspace/ui/components/spinner";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { ASKFISH_PAGES, ASKFISH_QUESTION, askFishKnows } from "@repo/domain/askfish";
import { AnswerView } from "@/components/askfish/answer";
import type { AskFishScope, Turn } from "@/components/askfish/panel";
import { CHOSEN } from "@/components/filters/toggle-states";
import { activeCountry } from "@/config/countryConfig";
import { useT } from "@/i18n/use-lang";
import { metricTitle } from "@/lib/dashboard/metrics";
import { api } from "@/trpc/react";

/**
 * The conversation with AskFish: suggested questions to start from, each
 * question with its answer, and the box to ask the next one.
 */
export default function Chat({
  scope,
  turns,
  onAsk,
  onRestrict,
}: {
  scope: AskFishScope;
  turns: Turn[];
  onAsk: (question: string, suggestionId?: string, retry?: number) => void;
  onRestrict: (restrict: boolean) => void;
}) {
  const { t, lang } = useT();
  // AskFish refuses a question with no district, or about a page metric it doesn't list.
  const known = askFishKnows(scope.page, scope.metric);
  const askable = scope.districts.length > 0 && known;
  // AskFish writes these with one AI call, then keeps them: asked once per page and filters,
  // and only while they show, before the first question.
  const suggestions = api.askfish.suggestions.useQuery(scope, {
    enabled: askable && !turns.length,
    staleTime: Infinity,
    retry: false,
  });
  // One question at a time.
  const busy = turns.some((turn) => !turn.answer && !turn.failed);

  if (!scope.districts.length) {
    return (
      <Notice
        icon={MapPinnedIcon}
        title={t("text-askfish-no-districts-title")}
        description={t("text-askfish-no-districts")}
      />
    );
  }
  if (!known) {
    return (
      <Notice
        icon={CircleHelpIcon}
        title={t("text-askfish-unknown-metric-title", { metric: metricTitle(t, scope.metric) })}
        description={t("text-askfish-unknown-metric", {
          known: new Intl.ListFormat(lang, { type: "disjunction" }).format(
            ASKFISH_PAGES[scope.page].metrics.map((m) => metricTitle(t, m)),
          ),
        })}
      />
    );
  }

  return (
    <>
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="p-4">
              {!turns.length && [
                <MessageScrollerItem key="start" messageId="start">
                  <Message>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent>
                          {t("text-askfish-intro")}
                          {!!suggestions.data?.length && ` ${t("text-askfish-suggestions")}`}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>,
                // Questions AskFish has checked it can answer, offered as replies to pick
                // (shadcn's button bubbles).
                <MessageScrollerItem key="suggestions" messageId="suggestions">
                  <Message align="end">
                    <MessageContent>
                      <BubbleGroup>
                        {suggestions.isPending &&
                          [0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-3/5 self-end" />)}
                        {suggestions.data?.map((s) => (
                          <Bubble key={s.id} variant="tinted">
                            <BubbleContent
                              render={
                                <button type="button" onClick={() => onAsk(s.question, s.id)} />
                              }
                            >
                              {s.question}
                            </BubbleContent>
                          </Bubble>
                        ))}
                      </BubbleGroup>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>,
              ]}
              {turns.flatMap((turn) => [
                // The question is the top of its turn: the view moves to it, the answer follows below.
                <MessageScrollerItem key={`q${turn.id}`} messageId={`q${turn.id}`} scrollAnchor>
                  <Message align="end">
                    <MessageContent>
                      <Bubble variant="secondary">
                        <BubbleContent>{turn.question}</BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>,
                <MessageScrollerItem key={`a${turn.id}`} messageId={`a${turn.id}`}>
                  <Message>
                    <MessageContent>
                      {turn.answer ? (
                        <AnswerView answer={turn.answer} />
                      ) : turn.failed ? (
                        <>
                          <Bubble variant="destructive">
                            <BubbleContent>{t("text-askfish-failed")}</BubbleContent>
                          </Bubble>
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            disabled={busy}
                            onClick={() => onAsk(turn.question, undefined, turn.id)}
                          >
                            {t("text-askfish-retry")}
                          </Button>
                        </>
                      ) : (
                        <Bubble variant="ghost">
                          <BubbleContent>
                            <span className="shimmer text-muted-foreground">
                              {t("text-askfish-thinking")}
                            </span>
                          </BubbleContent>
                        </Bubble>
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>,
              ])}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
      <Separator />
      <Composer busy={busy} restrict={scope.restrict} onAsk={onAsk} onRestrict={onRestrict} />
    </>
  );
}

/**
 * The box to ask the next question and what its answer may draw on. It alone
 * holds the draft, so typing redraws neither the conversation nor its charts.
 */
function Composer({
  busy,
  restrict,
  onAsk,
  onRestrict,
}: {
  busy: boolean;
  restrict: boolean;
  onAsk: (question: string) => void;
  onRestrict: (restrict: boolean) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const question = draft.trim();
  const submit = () => {
    if (busy || question.length < ASKFISH_QUESTION.min) return;
    onAsk(question);
    setDraft("");
  };

  return (
    <form
      className="flex flex-col gap-2 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // Enter sends, Shift+Enter starts a new line; not while an input method is composing.
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }}
          placeholder={t("text-askfish-placeholder")}
          aria-label={t("text-askfish-placeholder")}
          maxLength={ASKFISH_QUESTION.max}
          rows={2}
        />
        <InputGroupAddon align="block-end" className="pt-1">
          {/* What an answer may draw on: this page as filtered, or all the country's summaries. */}
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label={t("text-askfish-scope")}
            value={[restrict ? "page" : "all"]}
            onValueChange={(next) => next[0] && onRestrict(next[0] === "page")}
          >
            <ToggleGroupItem value="page" className={CHOSEN}>
              {t("text-askfish-scope-page")}
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className={CHOSEN}>
              {t("text-askfish-scope-all", { country: activeCountry.countryName })}
            </ToggleGroupItem>
          </ToggleGroup>
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-xs"
            className="ml-auto"
            aria-label={t("text-askfish-send")}
            // Only while AskFish works: a disabled button dims the whole box, which an
            // empty one must not be. Sending nothing does nothing.
            disabled={busy}
          >
            {busy ? <Spinner /> : <ArrowUpIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-xs text-muted-foreground">{t("text-askfish-note")}</p>
    </form>
  );
}

/** Why AskFish can't be asked right now, in place of the conversation. */
function Notice({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
