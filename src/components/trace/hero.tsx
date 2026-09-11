import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/subscriptions/money";
import type { Currency } from "@/lib/subscriptions/types";
import type { LedgerStats } from "@/lib/subscriptions/calc";

type HeroProps = {
  stats: LedgerStats;
  currency: Currency;
  period: "month" | "year";
  onPeriod: (period: "month" | "year") => void;
  mixedFx: boolean;
};

export function TraceHero({
  stats,
  currency,
  period,
  onPeriod,
  mixedFx,
}: HeroProps) {
  const hero =
    period === "month" ? stats.monthlyRunRate : stats.yearlyRunRate;

  return (
    <section className="stagger-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {period === "month" ? "Monthly run-rate" : "Annual run-rate"}
        </p>
        <div className="inline-flex h-11 items-center rounded-full bg-secondary p-1">
          <button
            type="button"
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
              period === "month"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onPeriod("month")}
          >
            Month
          </button>
          <button
            type="button"
            className={cn(
              "h-9 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
              period === "year"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onPeriod("year")}
          >
            Year
          </button>
        </div>
      </div>
      <p className="mt-3 font-display text-4xl font-medium tracking-tight tabular-nums sm:text-5xl">
        {formatMoney(hero, currency)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {stats.liveCount} live
        {stats.trialCount ? ` · ${stats.trialCount} on trial` : ""}
        {mixedFx ? " · mixed currencies, approximate FX" : ""}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Due this month"
          value={formatMoney(stats.dueThisMonth, currency)}
          hint={`${stats.chargesThisMonth.length} charges`}
        />
        <StatCard
          label="Next charge"
          value={
            stats.nextCharge
              ? formatMoney(stats.nextCharge.amount, currency)
              : "—"
          }
          hint={
            stats.nextCharge
              ? `${stats.nextCharge.sub.name} · ${format(stats.nextCharge.date, "d MMM")}`
              : "Nothing upcoming"
          }
        />
        <StatCard
          label="Paused"
          value={String(stats.pausedCount)}
          hint={
            stats.cancelledCount
              ? `${stats.cancelledCount} cancelled on file`
              : "Sitting idle"
          }
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-medium tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
