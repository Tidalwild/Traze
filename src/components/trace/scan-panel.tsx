import { useCallback, useMemo, useState } from "react";
import { ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  redirectToLoginIfRequired,
  useRefetchWhenConnectorReady,
} from "@/lib/app-data";
import { formatMoney } from "@/lib/subscriptions/money";
import {
  discoveryToSubscription,
  matchesLedger,
  type Discovery,
} from "@/lib/subscriptions/parse-receipts";
import { scanInbox, type ScanResponse } from "@/lib/subscriptions/scan";
import { newId, useLedger } from "@/lib/subscriptions/store";
import { CYCLE_LABELS, STATUS_LABELS } from "@/lib/subscriptions/types";
import { cn } from "@/lib/utils";

type Props = {
  onAdded?: () => void;
};

export function ScanPanel({ onAdded }: Props) {
  const items = useLedger((s) => s.items);
  const addItem = useLedger((s) => s.addItem);
  const dismissed = useLedger((s) => s.dismissedKeys);
  const dismissDiscovery = useLedger((s) => s.dismissDiscovery);
  const lastScanAt = useLedger((s) => s.lastScanAt);
  const setLastScanAt = useLedger((s) => s.setLastScanAt);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);

  const runScan = useCallback(async () => {
    setBusy(true);
    try {
      const next = await scanInbox();
      setResult(next);
      if (next.ok) {
        setLastScanAt(new Date().toISOString());
      } else if (next.loginRequired) {
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: next.loginUrl,
        });
      }
    } catch (error) {
      setResult({
        ok: false,
        kind: "error",
        message: error instanceof Error ? error.message : "Scan failed.",
      });
    } finally {
      setBusy(false);
    }
  }, [setLastScanAt]);

  const waiting = Boolean(result && !result.ok && result.kind === "pending");
  const waitStatus = useRefetchWhenConnectorReady(waiting, runScan);

  const visible = useMemo(() => {
    if (!result?.ok) return [];
    return result.discoveries.filter(
      (d) => !dismissed.includes(d.merchantKey),
    );
  }, [result, dismissed]);

  const recurring = visible.filter((d) => d.kind === "recurring");
  const usage = visible.filter((d) => d.kind === "usage");
  const rest = visible.filter((d) => d.kind === "one_off");

  function addOne(discovery: Discovery) {
    if (items.some((item) => matchesLedger(item, discovery))) {
      toast(`${discovery.name} is already on the ledger`);
      return;
    }
    addItem(discoveryToSubscription(discovery, newId()));
    toast(`Added ${discovery.name}`);
    onAdded?.();
  }

  function addRecurring() {
    const fresh = recurring.filter(
      (d) =>
        d.status !== "cancelled" &&
        !items.some((item) => matchesLedger(item, d)),
    );
    if (!fresh.length) {
      toast("Nothing new to add");
      return;
    }
    for (const d of fresh) addItem(discoveryToSubscription(d, newId()));
    toast(`Added ${fresh.length} subscription${fresh.length === 1 ? "" : "s"}`);
    onAdded?.();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Scan inbox
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Traze reads receipts in the Gmail connected to Grok — Apple invoices,
              Stripe, 3 Hong Kong, GitHub, PayPal, and card alerts from Visa,
              Mastercard, American Express, UnionPay, JCB, Discover, and issuers
              such as HSBC. There is no bank or Apple ID login. Those show up when
              they email this inbox (including aliases and CCs).
            </p>
          </div>
          <Button onClick={() => void runScan()} disabled={busy}>
            <ScanSearch className="size-4" />
            {busy ? "Scanning…" : "Scan Gmail"}
          </Button>
        </div>
        {lastScanAt && !(result && !result.ok) ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Last scan {new Date(lastScanAt).toLocaleString("en-HK")}
          </p>
        ) : null}
      </section>

      {busy ? (
        <p className="rounded-3xl bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Reading receipts. Card alerts need the full message — this stays on the
          server and never sends a full card number.
        </p>
      ) : null}

      {result && !result.ok ? (
        <ErrorState
          result={result}
          waitStatus={waitStatus}
          onRetry={() => void runScan()}
        />
      ) : null}

      {result?.ok ? (
        <div className="flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Likely subscriptions
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.scanned} messages · {recurring.length} recurring
                {usage.length ? ` · ${usage.length} pay-as-you-go` : ""}
              </p>
            </div>
            {recurring.some((d) => d.status !== "cancelled") ? (
              <Button variant="secondary" size="sm" onClick={addRecurring}>
                Add all live
              </Button>
            ) : null}
          </div>

          {recurring.length === 0 ? (
            <p className="rounded-3xl bg-card px-5 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
              No recurring charges matched in this inbox. One-off card spend is
              ignored. Add missing services by hand, or forward receipts here.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {recurring.map((d) => (
                <DiscoveryRow
                  key={d.merchantKey}
                  discovery={d}
                  onLedger={items.some((item) => matchesLedger(item, d))}
                  onAdd={() => addOne(d)}
                  onDismiss={() => dismissDiscovery(d.merchantKey)}
                />
              ))}
            </ul>
          )}

          {usage.length > 0 ? (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground">
                Pay-as-you-go
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Repeat charges that are not a fixed cycle — credits, usage, top-ups.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {usage.map((d) => (
                  <DiscoveryRow
                    key={d.merchantKey}
                    discovery={d}
                    onLedger={items.some((item) => matchesLedger(item, d))}
                    onAdd={() => addOne(d)}
                    onDismiss={() => dismissDiscovery(d.merchantKey)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground">
                Other receipts
              </h3>
              <ul className="mt-3 flex flex-col gap-3">
                {rest.map((d) => (
                  <DiscoveryRow
                    key={d.merchantKey}
                    discovery={d}
                    onLedger={items.some((item) => matchesLedger(item, d))}
                    onAdd={() => addOne(d)}
                    onDismiss={() => dismissDiscovery(d.merchantKey)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <SourceList result={result} />
    </div>
  );
}

function SourceList({ result }: { result: ScanResponse | null }) {
  const cards = result?.ok ? result.cards : [];
  const appleIds = result?.ok ? result.appleIds : [];
  const inboxes = result?.ok ? result.inboxes : [];
  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground">What Traze can see</h3>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SourceCard
          title="Gmail"
          body={
            inboxes.length
              ? inboxes.join(", ")
              : "The Google inbox connected in Grok, including aliases that land there."
          }
        />
        <SourceCard
          title="Cards"
          body={
            cards.length
              ? `Alerts for ${cards.join(", ")}. No bank login — only email notifications.`
              : "Visa, Mastercard, American Express, UnionPay, JCB, Discover — issuer alerts in Gmail. No bank login."
          }
        />
        <SourceCard
          title="Apple IDs"
          body={
            appleIds.length
              ? appleIds.join(", ")
              : "App Store invoices emailed to this inbox. Apple IDs cannot be signed in here."
          }
        />
        <SourceCard
          title="Other Google / Hotmail"
          body="Connect that account in Grok, or forward receipts to the connected inbox. Extra Google accounts are not scanned until they are the connected one."
        />
      </ul>
    </section>
  );
}

function SourceCard({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-3xl bg-card px-4 py-4 shadow-[var(--shadow-border)]">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}

function ErrorState({
  result,
  waitStatus,
  onRetry,
}: {
  result: Extract<ScanResponse, { ok: false }>;
  waitStatus: string;
  onRetry: () => void;
}) {
  const copy =
    result.kind === "pending"
      ? waitStatus === "not_embedded"
        ? "Open Traze from Grok to attach Gmail."
        : waitStatus === "timed_out"
          ? "Still waiting on Gmail. Try Scan again."
          : "Connecting to Gmail…"
      : result.message;
  return (
    <div className="rounded-3xl bg-card px-5 py-8 text-center shadow-[var(--shadow-border)]">
      <p className="font-medium">{copy}</p>
      {result.kind === "not_connected" ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Connect Gmail in Grok, then scan again. Hotmail and extra Google
          accounts are not included until their mail lands here.
        </p>
      ) : null}
      {result.kind !== "pending" ? (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

function DiscoveryRow({
  discovery,
  onLedger,
  onAdd,
  onDismiss,
}: {
  discovery: Discovery;
  onLedger: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}) {
  return (
    <li className="rounded-3xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{discovery.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {CYCLE_LABELS[discovery.cycle]}
            {discovery.kind === "usage" ? " · usage" : ""}
            {` · ${discovery.chargeCount} receipt${discovery.chargeCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums">
            {discovery.amount > 0
              ? formatMoney(discovery.amount, discovery.currency)
              : "Amount unknown"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {discovery.status === "cancelled"
              ? "Looks ended"
              : `Next ${discovery.nextBillingDate}`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={discovery.status === "cancelled" ? "cancelled" : "outline"}>
          {discovery.status === "cancelled"
            ? STATUS_LABELS.cancelled
            : discovery.paymentVia.label}
        </Badge>
        {discovery.confidence === "low" ? (
          <Badge variant="outline">Low confidence</Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {onLedger ? (
            <span className="px-2 text-sm text-muted-foreground">On ledger</span>
          ) : (
            <Button size="sm" onClick={onAdd} disabled={discovery.amount <= 0}>
              Add
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={cn("text-muted-foreground")}
            onClick={onDismiss}
          >
            Hide
          </Button>
        </div>
      </div>
    </li>
  );
}
