import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { enUS } from "date-fns/locale";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceMemberMilestone } from "@/lib/workspaceMilestonesApi";

const mocks = vi.hoisted(() => ({
  loadMilestones: vi.fn(),
}));

vi.mock("@/lib/workspaceMilestonesApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspaceMilestonesApi")>();
  return {
    ...actual,
    loadWorkspaceMemberMilestones: mocks.loadMilestones,
  };
});

const MESSAGES: Record<string, string> = {
  "birthday_widget.card_title": "Upcoming birthdays and anniversaries",
  "birthday_widget.empty": "No upcoming events based on available data.",
  "birthday_widget.type_birthday": "Birthday",
  "birthday_widget.type_anniversary": "Work anniversary",
  "birthday_widget.loading": "Loading milestones…",
  "birthday_widget.load_error": "Birthdays and anniversaries could not be loaded.",
  "birthday_widget.retry": "Try again",
  "birthday_widget.unknown_member": "Unknown member",
  "birthday_widget.upcoming_count": "Upcoming milestones, 7 days: {{count}}",
};

vi.mock("@/i18n/I18nProvider", () => ({
  useDateLocale: () => enUS,
  useI18n: () => ({
    locale: "en",
    t: (key: string, vars?: Record<string, string | number>) => {
      const source = MESSAGES[key] ?? key;
      return source.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(vars?.[name] ?? ""));
    },
  }),
}));

import { BirthdayAnniversaryWidget } from "@/components/enterprise/BirthdayAnniversaryWidget";
import {
  calendarDayDistance,
  getUpcomingMilestones,
  nextMilestoneOccurrence,
} from "@/lib/workspaceMilestoneCalendar";

const WORKSPACE_A = "10000000-0000-4000-8000-000000000001";
const WORKSPACE_B = "10000000-0000-4000-8000-000000000002";
const WORKSPACE_TIME_ZONE = "Europe/Budapest";

function record(
  suffix: string,
  displayName: string | null,
  month: number,
  day: number,
): WorkspaceMemberMilestone {
  return {
    membershipId: `20000000-0000-4000-8000-${suffix.padStart(12, "0")}`,
    displayName,
    type: "birthday",
    month,
    day,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function openWidget() {
  const trigger = screen.getByRole("button", { name: /upcoming birthdays and anniversaries/i });
  fireEvent.click(trigger);
  return trigger;
}

describe("BirthdayAnniversaryWidget", () => {
  beforeEach(() => {
    mocks.loadMilestones.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("announces loading and exposes native collapsible semantics", () => {
    mocks.loadMilestones.mockReturnValue(new Promise(() => undefined));
    render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );

    const trigger = openWidget();
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading milestones…");
    expect(mocks.loadMilestones).toHaveBeenCalledWith(
      WORKSPACE_A,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("renders a minimal semantic list and keeps a milestone occurring today on today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    mocks.loadMilestones.mockResolvedValue([record("1", "Ada Lovelace", 7, 19)]);
    render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    openWidget();

    await act(async () => Promise.resolve());
    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    expect(
      screen.getByRole("list", { name: /upcoming birthdays and anniversaries/i }),
    ).toBeVisible();
    expect(screen.getByRole("listitem")).toHaveTextContent("today");
    expect(screen.getByText("Upcoming milestones, 7 days: 1")).toHaveClass("sr-only");
  });

  it("uses the localized unknown-member fallback without exposing profile preferences", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    mocks.loadMilestones.mockResolvedValue([record("2", null, 7, 20)]);
    render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    openWidget();

    await act(async () => Promise.resolve());
    expect(screen.getByText("Unknown member")).toBeVisible();
    expect(screen.queryByText(/preferences|birthday_month/i)).not.toBeInTheDocument();
  });

  it("shows a recoverable error instead of misrepresenting failure as an empty result", async () => {
    mocks.loadMilestones
      .mockRejectedValueOnce(new Error("database details must stay hidden"))
      .mockResolvedValueOnce([]);
    render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    const trigger = openWidget();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Birthdays and anniversaries could not be loaded.",
    );
    expect(screen.queryByText("database details must stay hidden")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(trigger).toHaveFocus();
    expect(await screen.findByText("No upcoming events based on available data.")).toBeVisible();
    expect(mocks.loadMilestones).toHaveBeenCalledTimes(2);
  });

  it("clears old tenant data immediately and ignores a late response after workspace change", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    const requestA = deferred<WorkspaceMemberMilestone[]>();
    const requestB = deferred<WorkspaceMemberMilestone[]>();
    mocks.loadMilestones.mockImplementation((workspaceId: string) =>
      workspaceId === WORKSPACE_A ? requestA.promise : requestB.promise,
    );

    const view = render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    openWidget();
    await act(async () => {
      requestA.resolve([record("3", "Tenant A member", 7, 19)]);
    });
    expect(screen.getByText("Tenant A member")).toBeVisible();

    view.rerender(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_B}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    expect(screen.queryByText("Tenant A member")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading milestones…");

    await act(async () => {
      requestB.resolve([record("4", "Tenant B member", 7, 19)]);
    });
    expect(screen.getByText("Tenant B member")).toBeVisible();
    expect(screen.queryByText("Tenant A member")).not.toBeInTheDocument();
  });

  it("does not commit a stale response when workspaces resolve out of order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00Z"));
    const requestA = deferred<WorkspaceMemberMilestone[]>();
    const requestB = deferred<WorkspaceMemberMilestone[]>();
    mocks.loadMilestones.mockImplementation((workspaceId: string) =>
      workspaceId === WORKSPACE_A ? requestA.promise : requestB.promise,
    );

    const view = render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    openWidget();
    view.rerender(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_B}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    await act(async () => {
      requestA.resolve([record("5", "Stale tenant member", 7, 19)]);
    });
    expect(screen.queryByText("Stale tenant member")).not.toBeInTheDocument();

    await act(async () => {
      requestB.resolve([record("6", "Current tenant member", 7, 19)]);
    });
    expect(screen.getByText("Current tenant member")).toBeVisible();
  });

  it("reloads server-derived anniversary dates when the workspace timezone changes", async () => {
    mocks.loadMilestones.mockResolvedValue([]);
    const view = render(
      <BirthdayAnniversaryWidget workspaceId={WORKSPACE_A} workspaceTimeZone="Europe/Budapest" />,
    );
    await waitFor(() => expect(mocks.loadMilestones).toHaveBeenCalledTimes(1));

    view.rerender(
      <BirthdayAnniversaryWidget workspaceId={WORKSPACE_A} workspaceTimeZone="America/New_York" />,
    );
    await waitFor(() => expect(mocks.loadMilestones).toHaveBeenCalledTimes(2));
  });

  it("refreshes relative dates after a workspace-midnight focus resume", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T21:59:30Z"));
    mocks.loadMilestones.mockResolvedValue([record("7", "Midnight member", 7, 20)]);
    render(
      <BirthdayAnniversaryWidget
        workspaceId={WORKSPACE_A}
        workspaceTimeZone={WORKSPACE_TIME_ZONE}
      />,
    );
    openWidget();
    await act(async () => Promise.resolve());
    expect(screen.getByRole("listitem")).toHaveTextContent("tomorrow");

    vi.setSystemTime(new Date("2026-07-19T22:00:30Z"));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(screen.getByRole("listitem")).toHaveTextContent("today");
  });
});

describe("milestone calendar calculations", () => {
  it("treats an occurrence later on the current wall-clock day as today", () => {
    const from = new Date(2026, 6, 19, 18, 45);
    const next = nextMilestoneOccurrence(7, 19, from);

    expect(next).toEqual(new Date(2026, 6, 19));
    expect(calendarDayDistance(from, next as Date)).toBe(0);
  });

  it("sorts across a year boundary by calendar day distance", () => {
    const from = new Date(2026, 11, 31, 23, 50);
    const result = getUpcomingMilestones(
      [
        { id: "jan-2", name: "Second", type: "birthday", month: 1, day: 2 },
        { id: "jan-1", name: "First", type: "birthday", month: 1, day: 1 },
      ],
      from,
    );

    expect(result.map((item) => [item.id, item.daysUntil])).toEqual([
      ["jan-1", 1],
      ["jan-2", 2],
    ]);
  });

  it("uses UTC calendar ordinals across daylight-saving transitions", () => {
    expect(calendarDayDistance(new Date(2026, 2, 28, 23, 30), new Date(2026, 3, 4, 0, 15))).toBe(7);
  });

  it("keeps February 29 exact instead of silently coercing it in a non-leap year", () => {
    expect(nextMilestoneOccurrence(2, 29, new Date(2026, 0, 1))).toEqual(new Date(2028, 1, 29));
  });

  it("uses the canonical workspace day independently of the device instant boundary", () => {
    const instant = new Date("2026-03-31T22:30:00Z");
    const milestone = [
      { id: "apr-1", name: "Workspace day", type: "anniversary" as const, month: 4, day: 1 },
    ];

    expect(getUpcomingMilestones(milestone, instant, 6, "Europe/Budapest")[0]?.daysUntil).toBe(0);
    expect(getUpcomingMilestones(milestone, instant, 6, "America/New_York")[0]?.daysUntil).toBe(1);
  });

  it.each([
    [0, 10],
    [13, 1],
    [4, 31],
  ])("rejects an invalid month/day pair (%s/%s)", (month, day) => {
    expect(nextMilestoneOccurrence(month, day, new Date(2026, 0, 1))).toBeNull();
  });
});
