import { ScanSearch } from "lucide-react";
import { SubscriptionRow } from "@/components/trace/charge-row";
import type { LedgerStats } from "@/lib/subscriptions/calc";
import { formatMoney } from "@/lib/subscriptions/money";
import {
  CATEGORY_LABELS,
  type Currency,
  type Subscription,
} from "@/lib/subscriptions/types";

type Props = {
  stats: LedgerStats;
  currency: Currency;
  onEdit: (item: Subscription) => void;
  onScan: () => void;
};

export function HomePanel({ stats, currency, onEdit, onScan }: Props) {
  const slice = stats.upcoming.slice(0, 6);
  const top = stats.byCategory[0];

  return (
    <div className="flex flex-col gap-8">
      <button
        type="button"
        onClick={onScan}
        className="flex items-start gap-3 rounded-3xl bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
      >
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
          <ScanSearch className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-medium">Scan inbox</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
            Pull Apple, Stripe, 3 Hong Kong, GitHub, and card alerts — Visa,
            Mastercard, American Express, UnionPay, and others — from the Gmail
            connected to Grok. Banks have no direct login here.
          </span>
        </span>
      </button>

      {stats.overdue.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-warn">Overdue</h2>
          <div className="mt-3 flex flex-col gap-3">
            {stats.overdue.map((ev) => (
              <SubscriptionRow
                key={`${ev.sub.id}-${ev.date.toISOString()}`}
                item={ev.sub}
                currency={currency}
                onEdit={onEdit}
                charge={ev}
                showMark
              />
            ))}
          </div>
        </section>
      ) : null}

      {stats.trialsEnding.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">
            Trials ending
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {stats.trialsEnding.map(({ sub, days }) => (
              <li
                key={sub.id}
                className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <button
                  type="button"
                  className="text-left font-medium"
                  onClick={() => onEdit(sub)}
                >
                  {sub.name}
                </button>
                <span className="text-sm text-warn tabular-nums">
                  {days < 0
                    ? "Ended"
                    : days === 0
                      ? "Ends today"
                      : `${days} day${days === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Upcoming charges
          </h2>
          <p className="text-sm text-muted-foreground">Next 45 days</p>
        </div>
        {slice.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            No live charges on the horizon.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {slice.map((ev) => (
              <SubscriptionRow
                key={`${ev.sub.id}-${ev.date.toISOString()}`}
                item={ev.sub}
                currency={currency}
                onEdit={onEdit}
                charge={ev}
                showMark
              />
            ))}
          </div>
        )}
      </section>

      {top ? (
        <p className="text-sm text-muted-foreground">
          {CATEGORY_LABELS[top.category]} is the largest line at{" "}
          {formatMoney(top.monthly, currency)} / month.
        </p>
      ) : null}
    </div>
  );
}
