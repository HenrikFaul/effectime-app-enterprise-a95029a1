import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Cake, PartyPopper, ChevronDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useDateLocale, useI18n } from "@/i18n/I18nProvider";
import {
  loadWorkspaceMemberMilestones,
  WorkspaceMilestonesError,
  type WorkspaceMemberMilestone,
} from "@/lib/workspaceMilestonesApi";
import { getUpcomingMilestones, type CalendarMilestone } from "@/lib/workspaceMilestoneCalendar";

interface Props {
  workspaceId: string;
  workspaceTimeZone: string;
}

type LoadState =
  | { status: "loading"; records: [] }
  | { status: "ready"; records: WorkspaceMemberMilestone[] }
  | { status: "error"; records: [] };

const RELATIVE_TIME_LOCALE: Record<string, string> = {
  at: "de-AT",
};

function buildMilestones(
  records: WorkspaceMemberMilestone[],
  unknownMember: string,
): CalendarMilestone[] {
  return records.map((record) => ({
    id: `${record.type === "birthday" ? "bday" : "ann"}-${record.membershipId}`,
    name: record.displayName ?? unknownMember,
    type: record.type,
    month: record.month,
    day: record.day,
  }));
}

function relativeDayLabel(daysUntil: number, locale: string): string {
  const localeTag = RELATIVE_TIME_LOCALE[locale] ?? locale;
  try {
    return new Intl.RelativeTimeFormat(localeTag, { numeric: "auto" }).format(daysUntil, "day");
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(daysUntil, "day");
  }
}

function reportMilestoneLoadFailure(error: unknown): void {
  const code = error instanceof WorkspaceMilestonesError ? error.code : "request-failed";
  // Only the bounded adapter code is observable; backend messages and response
  // payloads must never enter browser/native logs.
  console.warn("[BirthdayAnniversaryWidget] milestone request failed", { code });
}

export function BirthdayAnniversaryWidget({ workspaceId, workspaceTimeZone }: Props) {
  const { locale, t } = useI18n();
  const dateLocale = useDateLocale();
  const requestGeneration = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading", records: [] });
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [calendarNow, setCalendarNow] = useState(() => new Date());

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const abortController = new AbortController();
    setLoadState({ status: "loading", records: [] });

    void loadWorkspaceMemberMilestones(workspaceId, { signal: abortController.signal })
      .then((records) => {
        if (generation === requestGeneration.current && !abortController.signal.aborted) {
          setLoadState({ status: "ready", records });
        }
      })
      .catch((error: unknown) => {
        const wasCancelled = error instanceof WorkspaceMilestonesError && error.code === "aborted";
        if (!wasCancelled && generation === requestGeneration.current) {
          reportMilestoneLoadFailure(error);
          setLoadState({ status: "error", records: [] });
        }
      });

    return () => {
      requestGeneration.current += 1;
      abortController.abort();
    };
  }, [workspaceId, workspaceTimeZone, retryGeneration]);

  useEffect(() => {
    const refreshCalendarClock = () => setCalendarNow(new Date());
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshCalendarClock();
    };

    refreshCalendarClock();
    const intervalId = globalThis.setInterval(refreshCalendarClock, 60_000);
    window.addEventListener("focus", refreshCalendarClock);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      globalThis.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCalendarClock);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [workspaceTimeZone]);

  const milestones = useMemo(
    () => buildMilestones(loadState.records, t("birthday_widget.unknown_member")),
    [loadState.records, t],
  );
  const upcoming = useMemo(
    () => getUpcomingMilestones(milestones, calendarNow, 6, workspaceTimeZone),
    [calendarNow, milestones, workspaceTimeZone],
  );
  const soonCount = useMemo(
    () =>
      getUpcomingMilestones(
        milestones,
        calendarNow,
        Number.POSITIVE_INFINITY,
        workspaceTimeZone,
      ).filter((item) => item.daysUntil <= 7).length,
    [calendarNow, milestones, workspaceTimeZone],
  );
  const loading = loadState.status === "loading";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 rounded-t-lg transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="text-sm font-semibold leading-none tracking-tight flex items-center gap-2">
              <Cake className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("birthday_widget.card_title")}
              {soonCount > 0 && loadState.status === "ready" && (
                <>
                  <span
                    className="bg-red-700 text-white rounded-full text-xs font-bold px-2 py-0.5 ml-1 leading-none"
                    aria-hidden="true"
                  >
                    {soonCount}
                  </span>
                  <span className="sr-only">
                    {t("birthday_widget.upcoming_count", { count: soonCount })}
                  </span>
                </>
              )}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-1 border-t" aria-busy={loading}>
            {loading ? (
              <div
                className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
                  aria-hidden="true"
                />
                <span className="sr-only">{t("birthday_widget.loading")}</span>
              </div>
            ) : loadState.status === "error" ? (
              <div className="flex flex-col items-start gap-2 py-3">
                <p className="text-xs text-destructive" role="alert">
                  {t("birthday_widget.load_error")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    triggerRef.current?.focus();
                    setRetryGeneration((generation) => generation + 1);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("birthday_widget.retry")}
                </Button>
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2" role="status">
                {t("birthday_widget.empty")}
              </p>
            ) : (
              <ul className="space-y-2 pt-2" aria-label={t("birthday_widget.card_title")}>
                {upcoming.map((item) => {
                  const soon = item.daysUntil <= 7;
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between gap-3 border rounded-md p-2 transition-colors",
                        soon &&
                          "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {item.type === "birthday" ? (
                          <Cake className="h-3.5 w-3.5 shrink-0 text-pink-500" aria-hidden="true" />
                        ) : (
                          <PartyPopper
                            className="h-3.5 w-3.5 shrink-0 text-amber-500"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-none">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {item.type === "birthday"
                              ? t("birthday_widget.type_birthday")
                              : t("birthday_widget.type_anniversary")}
                            {" · "}
                            <time dateTime={format(item.nextDate, "yyyy-MM-dd")}>
                              {format(item.nextDate, "PP", { locale: dateLocale })}
                            </time>
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[10px]",
                          soon && "border-red-300 text-red-600 dark:text-red-400",
                        )}
                      >
                        {relativeDayLabel(item.daysUntil, locale)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
