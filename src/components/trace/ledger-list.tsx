import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SubscriptionRow } from "@/components/trace/charge-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseDate } from "@/lib/subscriptions/calc";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Category,
  type Currency,
  type Status,
  type Subscription,
} from "@/lib/subscriptions/types";
import { cn } from "@/lib/utils";

type Props = {
  items: Subscription[];
  currency: Currency;
  onEdit: (item: Subscription) => void;
  onAdd: () => void;
};

type StatusFilter = "all" | Status;
type CategoryFilter = "all" | Category;

export function LedgerList({ items, currency, onEdit, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => (status === "all" ? true : item.status === status))
      .filter((item) =>
        category === "all" ? true : item.category === category,
      )
      .filter((item) =>
        q
          ? item.name.toLowerCase().includes(q) ||
            CATEGORY_LABELS[item.category].toLowerCase().includes(q)
          : true,
      )
      .sort(
        (a, b) =>
          parseDate(a.nextBillingDate).getTime() -
          parseDate(b.nextBillingDate).getTime(),
      );
  }, [items, query, status, category]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subscriptions"
          className="pl-10"
          aria-label="Search subscriptions"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", ...STATUSES] as StatusFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition-colors duration-150",
              status === value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "all" ? "All" : STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      <Select
        value={category}
        onValueChange={(v) => setCategory(v as CategoryFilter)}
      >
        <SelectTrigger aria-label="Filter by category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Every category</SelectItem>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtered.length === 0 ? (
        <EmptyLedger onAdd={onAdd} hasItems={items.length > 0} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <SubscriptionRow
              key={item.id}
              item={item}
              currency={currency}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyLedger({
  onAdd,
  hasItems,
}: {
  onAdd: () => void;
  hasItems: boolean;
}) {
  return (
    <div className="rounded-3xl bg-card px-6 py-12 text-center shadow-[var(--shadow-border)]">
      <p className="font-display text-xl font-medium">
        {hasItems ? "Nothing matches" : "No subscriptions yet"}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {hasItems
          ? "Try a different filter or search."
          : "Add the services that bill you on a cycle. Traze keeps the run-rate, the next charge, and the quiet leaks in one ledger."}
      </p>
      {!hasItems ? (
        <Button className="mt-6" onClick={onAdd}>
          Add a subscription
        </Button>
      ) : null}
    </div>
  );
}
