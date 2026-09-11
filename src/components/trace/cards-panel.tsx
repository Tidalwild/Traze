import { useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLedger } from "@/lib/subscriptions/store";
import {
  CARD_NETWORKS,
  CARD_NETWORK_LABELS,
  MAX_SAVED_CARDS,
  isLast4,
  savedCardLabel,
  takeLast4,
  type CardNetwork,
} from "@/lib/subscriptions/types";

type Props = { onSaved?: () => void };

export function CardsPanel({ onSaved }: Props) {
  const cards = useLedger((s) => s.cards);
  const addCard = useLedger((s) => s.addCard);
  const removeCard = useLedger((s) => s.removeCard);
  const [network, setNetwork] = useState<CardNetwork>("visa");
  const [last4, setLast4] = useState("");
  const [nickname, setNickname] = useState("");

  function onLast4Change(raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 4) {
      setLast4(takeLast4(digits));
      toast("Only the last 4 digits are kept");
      return;
    }
    setLast4(digits);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = addCard({
      network,
      last4,
      nickname: nickname.trim() || undefined,
    });
    if (result === "ok") {
      toast(`Saved ${CARD_NETWORK_LABELS[network]} ··${takeLast4(last4)}`);
      setLast4("");
      setNickname("");
      onSaved?.();
      return;
    }
    if (result === "invalid") toast.error("Enter the last 4 digits");
    if (result === "duplicate") toast.error("That card is already listed");
    if (result === "full") toast.error(`Up to ${MAX_SAVED_CARDS} cards`);
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-2xl font-medium tracking-tight">Your cards</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Last 4 only. Visa, Mastercard, American Express, UnionPay, JCB, Discover, Diners Club. No full number, no bank login.
      </p>
      {cards.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.id} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-2">
              <span className="truncate text-sm font-medium">{savedCardLabel(card)}</span>
              <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Remove ${savedCardLabel(card)}`} onClick={() => removeCard(card.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">No cards yet.</p>
      )}
      <form className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" onSubmit={submit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-network">Network</Label>
          <Select value={network} onValueChange={(v) => setNetwork(v as CardNetwork)}>
            <SelectTrigger id="card-network"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CARD_NETWORKS.map((code) => (
                <SelectItem key={code} value={code}>{CARD_NETWORK_LABELS[code]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-last4">Last 4</Label>
          <Input id="card-last4" inputMode="numeric" autoComplete="off" maxLength={19} value={last4} onChange={(e) => onLast4Change(e.target.value)} placeholder="4242" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-nick">Bank</Label>
          <Input id="card-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="HSBC" maxLength={24} />
        </div>
        <div className="col-span-2 flex flex-col justify-end sm:col-span-1">
          <Button type="submit" disabled={!isLast4(last4)}>
            <Plus className="size-4" /> Add card
          </Button>
        </div>
      </form>
    </section>
  );
}
