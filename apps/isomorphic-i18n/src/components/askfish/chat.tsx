import { useState } from "react";
import { ArrowUpIcon } from "lucide-react";
import { Bubble, BubbleContent, BubbleGroup } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
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
import { ASKFISH_QUESTION } from "@repo/domain/askfish";
import { AnswerView } from "@/components/askfish/answer";
import type { Ask, AskFishFilters, Turn } from "@/components/askfish/panel";
import { useT } from "@/i18n/use-lang";
import { api } from "@/trpc/react";

/**
 * The conversation with AskFish: suggested questions to start from, each
 * question with its answer, and the box to ask the next one.
 */
export default function Chat({
  filters,
  turns,
  onAsk,
}: {
  filters: AskFishFilters;
  turns: Turn[];
  onAsk: (ask: Ask) => void;
}) {
  const { t } = useT();
  // Dashboard-wide queries use districts/months/locale as context, not page-specific scope.
  const suggestions = api.askfish.suggestions.useQuery(filters, {
    enabled: !turns.length,
    staleTime: Infinity,
    retry: false,
  });
  const busy = turns.some((turn) => !turn.answer && !turn.failed);

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
                        {suggestions.isError && (
                          <Bubble variant="muted">
                            <BubbleContent>
                              Suggested questions are unavailable. You can still ask your own question.
                            </BubbleContent>
                          </Bubble>
                        )}
                        {suggestions.data?.map((s) => (
                          <Bubble key={s.id} variant="tinted">
                            <BubbleContent
                              render={
                                <button type="button" onClick={() => onAsk({ question: s.question, suggestionId: s.id })} />
                              }
                            >
                              {s.question}
                            </BubbleContent>
                          </Bubble>
                        ))}
                        {!suggestions.isPending && (
                          <Button type="button" size="sm" variant="outline"
                            disabled={suggestions.isFetching}
                            onClick={() => void suggestions.refetch()}>
                            {t("text-askfish-refresh-suggestions")}
                          </Button>
                        )}
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
                            <BubbleContent>{"failureMessage" in turn && typeof turn.failureMessage === "string" ? turn.failureMessage : t("text-askfish-failed")}</BubbleContent>
                          </Bubble>
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            disabled={busy}
                            onClick={() => onAsk({ question: turn.question, retry: turn.id })}
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
      <Composer busy={busy} onAsk={onAsk} />
    </>
  );
}

/**
 * The box to ask the next question and what its answer may draw on. It alone
 * holds the draft, so typing redraws neither the conversation nor its charts.
 */
function Composer({
  busy,
  onAsk,
}: {
  busy: boolean;
  onAsk: (ask: Ask) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const question = draft.trim();
  const submit = () => {
    if (busy || question.length < ASKFISH_QUESTION.min) return;
    onAsk({ question });
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
