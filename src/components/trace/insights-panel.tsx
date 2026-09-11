import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { CATEGORY_FILL } from "@/components/trace/category";
import { Button } from "@/components/ui/button";
import type { LedgerStats } from "@/lib/subscriptions/calc";
import { toIsoDate } from "@/lib/subscriptions/calc";
import { formatMoney, isLive, monthlyEquivalent } from "@/lib/subscriptions/money";
import { CATALOG_SUGGESTIONS } from "@/lib/subscriptions/seed";
import { newId, useLedger } from "@/lib/subscriptions/store";
import {
  CATEGORY_LABELS,
  cardLabel,
  matchesSavedCard,
  savedCardLabel,
  type Currency,
  type Subscription,
} from "@/lib/subscriptions/types";

type Props = {
  items: Subscription[];
  stats: LedgerStats;
  currency: Currency;
};

export function InsightsPanel({ items, stats, currency }: Props) {
  const data = useMemo(
    () =>
      stats.byCategory.map((row) => ({
        label: CATEGORY_LABELS[row.category],
        monthly: Math.round(row.monthly),
        fill: CATEGORY_FILL[row.category],
      })),
    [stats.byCategory],
  );

  const names = new Set(items.map((i) => i.name.toLowerCase()));
  const missing = CATALOG_SUGGESTIONS.filter(
    (s) => !names.has(s.name.toLowerCase()),
  ).slice(0, 4);

  const monthlyPlans = items.filter(
    (s) =>
      (s.status === "active" || s.status === "trial") && s.cycle === "monthly",
  );
  const annualIfYearly = monthlyPlans.reduce((sum, sub) => {
    const month = monthlyEquivalent(sub, currency);
    return sum + month * 12 * 0.17;
  }, 0);

  const addItem = useLedger((s) => s.addItem);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-medium text-muted-foreground">
          Where the money sits
        </h2>
        {data.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Add a live subscription to see the mix.
          </p>
        ) : (
          <div className="mt-3 h-64 rounded-3xl bg-card px-2 py-4 shadow-[var(--shadow-border)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={108}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-accent)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    color: "var(--color-foreground)",
                  }}
                  formatter={(value: number | string) => [
                    formatMoney(Number(value), currency),
                    "Monthly",
                  ]}
                />
                <Bar dataKey="monthly" radius={[0, 6, 6, 0]} barSize={12}>
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <ByCard items={items} currency={currency} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Reading</h2>
        <Note>
          Top categories carry {Math.round(stats.topShare * 100)}% of the live
          run-rate.
        </Note>
        {annualIfYearly > 0 ? (
          <Note>
            A typical 17% yearly-plan discount on monthly bills would free about{" "}
            {formatMoney(annualIfYearly, currency)} a year. Check each vendor —
            this is a ceiling, not a promise.
          </Note>
        ) : null}
        {stats.pausedCount > 0 ? (
          <Note>
            {stats.pausedCount} paused{" "}
            {stats.pausedCount === 1 ? "service is" : "services are"} still on
            file. Resume or cancel so the ledger stays honest.
          </Note>
        ) : null}
        {stats.trialsEnding[0] ? (
          <Note>
            {stats.trialsEnding[0].sub.name}{" "}
            {stats.trialsEnding[0].days <= 0
              ? "has left the trial window."
              : `leaves trial in ${stats.trialsEnding[0].days} day${stats.trialsEnding[0].days === 1 ? "" : "s"}.`}
          </Note>
        ) : null}
      </section>

      {missing.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">
            Often missing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Common services not on this ledger. Tap to add, then edit the amount.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {missing.map((s) => (
              <li
                key={s.name}
                className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(s.amount, s.currency)} · {s.cycle}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    addItem({
                      id: newId(),
                      name: s.name,
                      amount: s.amount,
                      currency: s.currency,
                      cycle: s.cycle,
                      status: "active",
                      category: s.category,
                      nextBillingDate: toIsoDate(new Date()),
                      startedAt: toIsoDate(new Date()),
                      url: s.url,
                    });
                    toast(`Added ${s.name}`);
                  }}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-card px-4 py-3 text-sm leading-relaxed shadow-[var(--shadow-border)]">
      {children}
    </p>
  );
}

function ByCard({
  items,
  currency,
}: {
  items: Subscription[];
  currency: Currency;
}) {
  const cards = useLedger((s) => s.cards);
  const rows = useMemo(() => {
    const live = items.filter(isLive);
    if (cards.length === 0) {
      const groups = new Map<string, number>();
      for (const item of live) {
        const key = item.paymentVia?.last4
          ? cardLabel(
              item.paymentVia.network,
              item.paymentVia.last4,
              item.paymentVia.issuer,
            )
          : "No last 4";
        groups.set(key, (groups.get(key) ?? 0) + monthlyEquivalent(item, currency));
      }
      return [...groups.entries()]
        .map(([label, monthly]) => ({ label, monthly }))
        .sort((a, b) => b.monthly - a.monthly);
    }
    return [
      ...cards.map((card) => ({
        label: savedCardLabel(card),
        monthly: live
          .filter((item) => matchesSavedCard(item.paymentVia, card))
          .reduce((sum, item) => sum + monthlyEquivalent(item, currency), 0),
      })),
      {
        label: "No last 4",
        monthly: live
          .filter(
            (item) =>
              !cards.some((card) => matchesSavedCard(item.paymentVia, card)),
          )
          .reduce((sum, item) => sum + monthlyEquivalent(item, currency), 0),
      },
    ].filter((row) => row.monthly > 0);
  }, [items, cards, currency]);

  if (rows.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground">By card</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
          >
            <span className="truncate text-sm font-medium">{row.label}</span>
            <span className="shrink-0 text-sm tabular-nums">
              {formatMoney(row.monthly, currency)}/mo
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
