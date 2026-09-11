import { useCallback, useMemo, useState } from "react";
import { ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { CardsPanel } from "@/components/trace/cards-panel";
import { MailboxesPanel } from "@/components/trace/mailboxes-panel";
import { StatementsPanel } from "@/components/trace/statements-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/subscriptions/money";
import {
  discoveryToSubscription,
  matchesLedger,
  type Discovery,
} from "@/lib/subscriptions/parse-receipts";
import { scanInbox, type ScanResponse } from "@/lib/subscriptions/scan";
import { newId, useLedger } from "@/lib/subscriptions/store";
import { CYCLE_LABELS, STATUS_LABELS } from "@/lib/subscriptions/types";

type Props = { onAdded?: () => void };

export function ScanPanel({ onAdded }: Props) {
  const items = useLedger((s) => s.items);
  const cards = useLedger((s) => s.cards);
  const mailboxes = useLedger((s) => s.mailboxes);
  const addItem = useLedger((s) => s.addItem);
  const dismissed = useLedger((s) => s.dismissedKeys);
  const dismissDiscovery = useLedger((s) => s.dismissDiscovery);
  const lastScanAt = useLedger((s) => s.lastScanAt);
  const setLastScanAt = useLedger((s) => s.setLastScanAt);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});

  const runScan = useCallback(async () => {
    setBusy(true);
    try {
      const imap = mailboxes
        .map((box) => ({
          host: box.host,
          port: box.port,
          user: box.user,
          email: box.user,
          pass: passwords[box.id] ?? "",
        }))
        .filter((box) => box.pass);
      const next = await scanInbox({
        data: { last4s: cards.map((c) => c.last4), imap },
      });
      setResult(next);
      if (next.ok) setLastScanAt(new Date().toISOString());
    } catch (error) {
      setResult({
        ok: false,
        kind: "error",
        message: error instanceof Error ? error.message : "Scan failed.",
      });
    } finally {
      setBusy(false);
    }
  }, [cards, mailboxes, passwords, setLastScanAt]);

  const visible = useMemo(() => {
    if (!result?.ok) return [];
    return result.discoveries.filter((d) => !dismissed.includes(d.merchantKey));
  }, [result, dismissed]);

  function addOne(discovery: Discovery) {
    if (items.some((item) => matchesLedger(item, discovery))) {
      toast(`${discovery.name} is already on the ledger`);
      return;
    }
    addItem(discoveryToSubscription(discovery, newId()));
    toast(`Added ${discovery.name}`);
    onAdded?.();
  }

  return (
    <div className="flex flex-col gap-8">
      <CardsPanel />
      <MailboxesPanel
        passwords={passwords}
        onPassword={(id, pass) => setPasswords((prev) => ({ ...prev, [id]: pass }))}
      />
      <StatementsPanel
        onImported={(discoveries) => {
          setResult({
            ok: true,
            discoveries,
            scanned: discoveries.length,
            fetched: 0,
            inboxes: [],
            appleIds: [],
            cards: [],
            sources: ["Statement"],
            warnings: [],
          });
          setLastScanAt(new Date().toISOString());
        }}
      />

      <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <h2 className="font-display text-2xl font-medium tracking-tight">Scan inbox</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              On this Mac, Grok Gmail is not attached. Add IMAP (app password) or drop a bank CSV. Gmail through Grok only works in the Grok preview.
            </p>
          </div>
          <Button onClick={() => void runScan()} disabled={busy}>
            <ScanSearch className="size-4" />
            {busy ? "Scanning…" : "Scan mail"}
          </Button>
        </div>
        {lastScanAt && !(result && !result.ok) ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Last scan {new Date(lastScanAt).toLocaleString("en-HK")}
          </p>
        ) : null}
      </section>

      {result && !result.ok ? (
        <div className="rounded-3xl bg-card px-5 py-8 text-center shadow-[var(--shadow-border)]">
          <p className="font-medium">{result.message}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Local run cannot use Grok Gmail. Add an IMAP mailbox with an app password, or drop a statement CSV above.
          </p>
          <Button className="mt-5" variant="secondary" onClick={() => void runScan()}>
            Try again
          </Button>
        </div>
      ) : null}

      {result?.ok ? (
        <ul className="flex flex-col gap-3">
          {visible.length === 0 ? (
            <p className="rounded-3xl bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
              No repeating charges in that scan. Add by hand, or drop a statement CSV.
            </p>
          ) : (
            visible.map((d) => (
              <li key={d.merchantKey} className="rounded-3xl bg-card p-4 shadow-[var(--shadow-border)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {CYCLE_LABELS[d.cycle]} · {d.chargeCount} hit{d.chargeCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-medium tabular-nums">
                    {d.amount > 0 ? formatMoney(d.amount, d.currency) : "—"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{STATUS_LABELS[d.status]}</Badge>
                  <Badge variant="outline">{d.paymentVia.label}</Badge>
                  {items.some((item) => matchesLedger(item, d)) ? (
                    <span className="text-sm text-muted-foreground">On ledger</span>
                  ) : (
                    <Button size="sm" onClick={() => addOne(d)} disabled={d.amount <= 0}>
                      Add
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => dismissDiscovery(d.merchantKey)}>
                    Hide
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
