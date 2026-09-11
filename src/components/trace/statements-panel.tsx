import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Discovery } from "@/lib/subscriptions/parse-receipts";
import { parseStatementCsv, statementToDiscoveries } from "@/lib/subscriptions/parse-statements";
import { useLedger } from "@/lib/subscriptions/store";
import { savedCardLabel, type SavedCard } from "@/lib/subscriptions/types";

type Props = { onImported: (discoveries: Discovery[]) => void };

export function StatementsPanel({ onImported }: Props) {
  const cards = useLedger((s) => s.cards);
  const currency = useLedger((s) => s.displayCurrency);
  const [cardId, setCardId] = useState("none");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseStatementCsv(text, currency);
      if (!rows.length) {
        toast.error("No dated charges found. CSV needs Date, Description, Amount.");
        return;
      }
      const card: SavedCard | undefined =
        cardId === "none" ? undefined : cards.find((c) => c.id === cardId);
      const discoveries = statementToDiscoveries(rows, card);
      if (!discoveries.length) {
        toast.error("Nothing looked like a subscription on that statement.");
        return;
      }
      onImported(discoveries);
      toast(`Read ${rows.length} lines · ${discoveries.length} repeating or named charges`);
    } catch {
      toast.error("Could not read that file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-2xl font-medium tracking-tight">Issuer statement</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Export a CSV from HSBC, Hang Seng, Amex, Chase, Citi, or the issuer app. That is posted history. No bank login from a card number.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Select value={cardId} onValueChange={setCardId}>
            <SelectTrigger aria-label="Statement card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unknown card</SelectItem>
              {cards.map((card) => (
                <SelectItem key={card.id} value={card.id}>{savedCardLabel(card)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild variant="secondary" disabled={busy}>
          <label className="cursor-pointer">
            {busy ? "Reading…" : "Drop CSV"}
            <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </Button>
      </div>
    </section>
  );
}
