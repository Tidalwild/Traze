import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toIsoDate } from "@/lib/subscriptions/calc";
import { newId, useLedger } from "@/lib/subscriptions/store";
import {
  CARD_NETWORKS,
  CARD_NETWORK_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  CURRENCIES,
  CYCLE_LABELS,
  CYCLES,
  STATUS_LABELS,
  STATUSES,
  cardLabel,
  type BillingCycle,
  type CardNetwork,
  type Category,
  type Currency,
  type Status,
  type Subscription,
} from "@/lib/subscriptions/types";

type Draft = {
  name: string;
  amount: string;
  currency: Currency;
  cycle: BillingCycle;
  status: Status;
  category: Category;
  nextBillingDate: string;
  trialEndsAt: string;
  notes: string;
  url: string;
  cardNetwork: CardNetwork | "none";
  last4: string;
};

function emptyDraft(currency: Currency): Draft {
  return {
    name: "",
    amount: "",
    currency,
    cycle: "monthly",
    status: "active",
    category: "software",
    nextBillingDate: toIsoDate(new Date()),
    trialEndsAt: "",
    notes: "",
    url: "",
    cardNetwork: "none",
    last4: "",
  };
}

function fromItem(item: Subscription): Draft {
  return {
    name: item.name,
    amount: String(item.amount),
    currency: item.currency,
    cycle: item.cycle,
    status: item.status,
    category: item.category,
    nextBillingDate: item.nextBillingDate,
    trialEndsAt: item.trialEndsAt ?? "",
    notes: item.notes ?? "",
    url: item.url ?? "",
    cardNetwork: item.paymentVia?.network ?? "none",
    last4: item.paymentVia?.last4 ?? "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Subscription | null;
  preset?: Partial<Subscription> | null;
};

export function SubscriptionSheet({
  open,
  onOpenChange,
  editing,
  preset,
}: Props) {
  const displayCurrency = useLedger((s) => s.displayCurrency);
  const addItem = useLedger((s) => s.addItem);
  const updateItem = useLedger((s) => s.updateItem);
  const removeItem = useLedger((s) => s.removeItem);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(displayCurrency));
  const [side, setSide] = useState<"right" | "bottom">("right");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setSide(mq.matches ? "right" : "bottom");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft(fromItem(editing));
      return;
    }
    const base = emptyDraft(displayCurrency);
    if (preset) {
      setDraft({
        ...base,
        name: preset.name ?? "",
        amount: preset.amount != null ? String(preset.amount) : "",
        currency: preset.currency ?? base.currency,
        cycle: preset.cycle ?? base.cycle,
        category: preset.category ?? base.category,
        url: preset.url ?? "",
        cardNetwork: preset.paymentVia?.network ?? "none",
        last4: preset.paymentVia?.last4 ?? "",
      });
      return;
    }
    setDraft(base);
  }, [open, editing, preset, displayCurrency]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    const name = draft.name.trim();
    const amount = Number(draft.amount);
    if (!name) {
      toast.error("Give it a name");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!draft.nextBillingDate) {
      toast.error("Pick the next billing date");
      return;
    }
    const last4 = draft.last4.replace(/\D/g, "").slice(-4);
    const paymentVia =
      draft.cardNetwork === "none"
        ? draft.last4
          ? {
              kind: "card" as const,
              label: cardLabel(undefined, last4 || undefined, editing?.paymentVia?.issuer),
              last4: last4 || undefined,
              issuer: editing?.paymentVia?.issuer,
            }
          : editing?.paymentVia?.kind === "card"
            ? undefined
            : editing?.paymentVia
        : {
            kind: "card" as const,
            network: draft.cardNetwork,
            last4: last4 || undefined,
            issuer: editing?.paymentVia?.issuer,
            label: cardLabel(
              draft.cardNetwork,
              last4 || undefined,
              editing?.paymentVia?.issuer,
            ),
          };
    const payload: Subscription = {
      id: editing?.id ?? newId(),
      name,
      amount,
      currency: draft.currency,
      cycle: draft.cycle,
      status: draft.status,
      category: draft.category,
      nextBillingDate: draft.nextBillingDate,
      startedAt: editing?.startedAt ?? toIsoDate(new Date()),
      trialEndsAt: draft.status === "trial" && draft.trialEndsAt
        ? draft.trialEndsAt
        : undefined,
      notes: draft.notes.trim() || undefined,
      url: draft.url.trim() || undefined,
      source: editing?.source,
      paymentVia,
      merchantKey: editing?.merchantKey,
      inboxEmail: editing?.inboxEmail,
    };
    if (editing) {
      updateItem(editing.id, payload);
      toast(`Updated ${name}`);
    } else {
      addItem(payload);
      toast(`Added ${name}`);
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit subscription" : "Add subscription"}</SheetTitle>
          <SheetDescription>
            Amounts stay in their own currency. The ledger converts for totals.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4 px-6 pb-10"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Name" htmlFor="sub-name">
            <Input
              id="sub-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Netflix"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" htmlFor="sub-amount">
              <Input
                id="sub-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="98"
              />
            </Field>
            <Field label="Currency">
              <Select
                value={draft.currency}
                onValueChange={(v) => set("currency", v as Currency)}
              >
                <SelectTrigger aria-label="Currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cycle">
              <Select
                value={draft.cycle}
                onValueChange={(v) => set("cycle", v as BillingCycle)}
              >
                <SelectTrigger aria-label="Billing cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLES.map((cycle) => (
                    <SelectItem key={cycle} value={cycle}>
                      {CYCLE_LABELS[cycle]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Select
                value={draft.category}
                onValueChange={(v) => set("category", v as Category)}
              >
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={draft.status}
                onValueChange={(v) => set("status", v as Status)}
              >
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Next billing" htmlFor="sub-next">
              <Input
                id="sub-next"
                type="date"
                value={draft.nextBillingDate}
                onChange={(e) => set("nextBillingDate", e.target.value)}
              />
            </Field>
          </div>
          {draft.status === "trial" ? (
            <Field label="Trial ends" htmlFor="sub-trial">
              <Input
                id="sub-trial"
                type="date"
                value={draft.trialEndsAt}
                onChange={(e) => set("trialEndsAt", e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Website" htmlFor="sub-url">
            <Input
              id="sub-url"
              type="url"
              value={draft.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Card network">
              <Select
                value={draft.cardNetwork}
                onValueChange={(v) =>
                  set("cardNetwork", v as CardNetwork | "none")
                }
              >
                <SelectTrigger aria-label="Card network">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any / not a card</SelectItem>
                  {CARD_NETWORKS.map((network) => (
                    <SelectItem key={network} value={network}>
                      {CARD_NETWORK_LABELS[network]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Last 4" htmlFor="sub-last4">
              <Input
                id="sub-last4"
                inputMode="numeric"
                maxLength={4}
                value={draft.last4}
                onChange={(e) => set("last4", e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4242"
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="sub-notes">
            <Textarea
              id="sub-notes"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Plan, seats, reminder…"
            />
          </Field>
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit">{editing ? "Save changes" : "Add to ledger"}</Button>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  removeItem(editing.id);
                  toast(`Removed ${editing.name}`);
                  onOpenChange(false);
                }}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
