export interface CalendarMilestone {
  id: string;
  name: string;
  type: "birthday" | "anniversary";
  month: number;
  day: number;
}

export interface UpcomingCalendarMilestone extends CalendarMilestone {
  nextDate: Date;
  daysUntil: number;
}

const DAY_MS = 24 * 60 * 60 * 1_000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfDayInTimeZone(date: Date, timeZone?: string): Date | null {
  if (!timeZone) return startOfLocalDay(date);

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      calendar: "gregory",
      day: "numeric",
      month: "numeric",
      numberingSystem: "latn",
      timeZone,
      year: "numeric",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
        .map((part) => [part.type, Number(part.value)]),
    );
    if (
      !Number.isInteger(values.year) ||
      !Number.isInteger(values.month) ||
      !Number.isInteger(values.day)
    ) {
      return null;
    }
    return new Date(values.year, values.month - 1, values.day);
  } catch {
    return null;
  }
}

function isExactLocalDate(date: Date, year: number, month: number, day: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Returns the next exact calendar occurrence; February 29 is never coerced. */
export function nextMilestoneOccurrence(
  month: number,
  day: number,
  from: Date = new Date(),
  timeZone?: string,
): Date | null {
  const today = startOfDayInTimeZone(from, timeZone);
  if (!today) return null;
  for (let year = today.getFullYear(); year <= today.getFullYear() + 8; year += 1) {
    const candidate = new Date(year, month - 1, day);
    if (isExactLocalDate(candidate, year, month, day) && candidate >= today) {
      return candidate;
    }
  }
  return null;
}

/** Calendar-day distance using UTC ordinals so daylight-saving changes cannot skew it. */
export function calendarDayDistance(from: Date, to: Date): number {
  const fromOrdinal = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toOrdinal = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toOrdinal - fromOrdinal) / DAY_MS);
}

export function getUpcomingMilestones(
  milestones: CalendarMilestone[],
  from: Date = new Date(),
  limit = 6,
  timeZone?: string,
): UpcomingCalendarMilestone[] {
  if (milestones.length === 0) return [];
  const today = startOfDayInTimeZone(from, timeZone);
  if (!today) return [];
  return milestones
    .map((milestone): UpcomingCalendarMilestone | null => {
      const nextDate = nextMilestoneOccurrence(milestone.month, milestone.day, today);
      if (!nextDate) return null;
      return {
        ...milestone,
        nextDate,
        daysUntil: calendarDayDistance(today, nextDate),
      };
    })
    .filter((milestone): milestone is UpcomingCalendarMilestone => milestone !== null)
    .sort((left, right) => left.daysUntil - right.daysUntil || left.name.localeCompare(right.name))
    .slice(0, limit);
}
