import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarMonth } from "@/components/trace/calendar-month";
import { TraceHeader } from "@/components/trace/header";
import { TraceHero } from "@/components/trace/hero";
import { HomePanel } from "@/components/trace/home-panel";
import { InsightsPanel } from "@/components/trace/insights-panel";
import { LedgerList } from "@/components/trace/ledger-list";
import { ScanPanel } from "@/components/trace/scan-panel";
import { SubscriptionSheet } from "@/components/trace/subscription-sheet";
import { computeStats } from "@/lib/subscriptions/calc";
import { usesForeignCurrency } from "@/lib/subscriptions/money";
import { rehydrateLedger, useLedger } from "@/lib/subscriptions/store";
import type { Subscription } from "@/lib/subscriptions/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const TABS = [
  { id: "home", label: "Home" },
  { id: "ledger", label: "Ledger" },
  { id: "calendar", label: "Calendar" },
  { id: "insights", label: "Insights" },
] as const;

type TabId = (typeof TABS)[number]["id"] | "scan";

function Home() {
  useEffect(() => {
    rehydrateLedger();
  }, []);

  return <TraceApp />;
}

function TraceApp() {
  const items = useLedger((s) => s.items);
  const currency = useLedger((s) => s.displayCurrency);
  const [tab, setTab] = useState<TabId>("home");
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const stats = useMemo(
    () => computeStats(items, currency),
    [items, currency],
  );
  const mixedFx = usesForeignCurrency(items, currency);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(item: Subscription) {
    setEditing(item);
    setSheetOpen(true);
  }

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <TraceHeader
        onAdd={openNew}
        onScan={() => setTab("scan")}
        scanActive={tab === "scan"}
      />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
        {tab !== "scan" ? (
          <TraceHero
            stats={stats}
            currency={currency}
            period={period}
            onPeriod={setPeriod}
            mixedFx={mixedFx}
          />
        ) : null}

        <nav
          className="grid grid-cols-4 gap-1 rounded-full bg-secondary p-1"
          aria-label="Sections"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "h-10 rounded-full text-sm font-medium transition-colors duration-150",
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "home" ? (
          <HomePanel
            stats={stats}
            currency={currency}
            onEdit={openEdit}
            onScan={() => setTab("scan")}
          />
        ) : null}
        {tab === "ledger" ? (
          <LedgerList
            items={items}
            currency={currency}
            onEdit={openEdit}
            onAdd={openNew}
          />
        ) : null}
        {tab === "scan" ? (
          <ScanPanel onAdded={() => setTab("ledger")} />
        ) : null}
        {tab === "calendar" ? (
          <CalendarMonth items={items} currency={currency} onEdit={openEdit} />
        ) : null}
        {tab === "insights" ? (
          <InsightsPanel items={items} stats={stats} currency={currency} />
        ) : null}
      </main>
      <SubscriptionSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}
