import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  format,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { convert, isLive, monthlyEquivalent } from "./money";
import type { BillingCycle, Category, Currency, Subscription } from "./types";

export type ChargeEvent = {
  sub: Subscription;
  date: Date;
  overdue: boolean;
  amount: number;
};

export function addCycle(date: Date, cycle: BillingCycle): Date {
  switch (cycle) {
    case "weekly":
      return addWeeks(date, 1);
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addQuarters(date, 1);
    case "yearly":
      return addYears(date, 1);
  }
}

export function parseDate(iso: string): Date {
  return startOfDay(parseISO(iso));
}

export function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function advanceBilling(iso: string, cycle: BillingCycle): string {
  return toIsoDate(addCycle(parseDate(iso), cycle));
}

function eventsForSub(
  sub: Subscription,
  from: Date,
  to: Date,
  today: Date,
  display: Currency,
): ChargeEvent[] {
  if (!isLive(sub)) return [];
  let cursor = parseDate(sub.nextBillingDate);
  const events: ChargeEvent[] = [];
  let guard = 0;
  while (isBefore(cursor, from) && guard++ < 240) {
    cursor = addCycle(cursor, sub.cycle);
  }
  guard = 0;
  while (!isBefore(to, cursor) && guard++ < 240) {
    events.push({
      sub,
      date: cursor,
      overdue: isBefore(cursor, today),
      amount: convert(sub.amount, sub.currency, display),
    });
    cursor = addCycle(cursor, sub.cycle);
  }
  return events;
}

export function listCharges(
  items: Subscription[],
  from: Date,
  to: Date,
  display: Currency,
  now = new Date(),
): ChargeEvent[] {
  const today = startOfDay(now);
  const start = startOfDay(from);
  const end = startOfDay(to);
  const events = items.flatMap((sub) =>
    eventsForSub(sub, start, end, today, display),
  );
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function upcomingCharges(
  items: Subscription[],
  display: Currency,
  horizonDays = 45,
  now = new Date(),
): ChargeEvent[] {
  const today = startOfDay(now);
  const overdueFrom = items.reduce((earliest, sub) => {
    if (!isLive(sub)) return earliest;
    const next = parseDate(sub.nextBillingDate);
    return isBefore(next, earliest) ? next : earliest;
  }, today);
  return listCharges(items, overdueFrom, addDays(today, horizonDays), display, now);
}

export type LedgerStats = {
  monthlyRunRate: number;
  yearlyRunRate: number;
  dueThisMonth: number;
  chargesThisMonth: ChargeEvent[];
  liveCount: number;
  trialCount: number;
  pausedCount: number;
  cancelledCount: number;
  nextCharge: ChargeEvent | null;
  overdue: ChargeEvent[];
  upcoming: ChargeEvent[];
  byCategory: { category: Category; monthly: number }[];
  trialsEnding: { sub: Subscription; days: number }[];
  topShare: number;
};

export function computeStats(
  items: Subscription[],
  display: Currency,
  now = new Date(),
): LedgerStats {
  const today = startOfDay(now);
  const live = items.filter(isLive);
  const monthlyRunRate = live.reduce(
    (sum, sub) => sum + monthlyEquivalent(sub, display),
    0,
  );
  const chargesThisMonth = listCharges(
    items,
    startOfMonth(today),
    endOfMonth(today),
    display,
    now,
  );
  const dueThisMonth = chargesThisMonth.reduce((sum, ev) => sum + ev.amount, 0);
  const upcoming = upcomingCharges(items, display, 45, now);
  const overdue = upcoming.filter((ev) => ev.overdue);
  const future = upcoming.filter((ev) => !ev.overdue);
  const nextCharge = future[0] ?? overdue[0] ?? null;

  const categoryMap = new Map<Category, number>();
  for (const sub of live) {
    categoryMap.set(
      sub.category,
      (categoryMap.get(sub.category) ?? 0) + monthlyEquivalent(sub, display),
    );
  }
  const byCategory = [...categoryMap.entries()]
    .map(([category, monthly]) => ({ category, monthly }))
    .sort((a, b) => b.monthly - a.monthly);

  const top3 = byCategory.slice(0, 3).reduce((s, row) => s + row.monthly, 0);
  const topShare = monthlyRunRate > 0 ? top3 / monthlyRunRate : 0;

  const trialsEnding = items
    .filter((sub) => sub.status === "trial" && sub.trialEndsAt)
    .map((sub) => {
      const end = parseDate(sub.trialEndsAt as string);
      const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
      return { sub, days };
    })
    .sort((a, b) => a.days - b.days);

  return {
    monthlyRunRate,
    yearlyRunRate: monthlyRunRate * 12,
    dueThisMonth,
    chargesThisMonth,
    liveCount: live.length,
    trialCount: items.filter((s) => s.status === "trial").length,
    pausedCount: items.filter((s) => s.status === "paused").length,
    cancelledCount: items.filter((s) => s.status === "cancelled").length,
    nextCharge,
    overdue,
    upcoming: future,
    byCategory,
    trialsEnding,
    topShare,
  };
}

export function daysUntil(iso: string, now = new Date()): number {
  const today = startOfDay(now);
  const target = parseDate(iso);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
