import { format } from "date-fns";
import { Check, ExternalLink, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORY_DOT, statusVariant } from "@/components/trace/category";
import type { ChargeEvent } from "@/lib/subscriptions/calc";
import { convert, formatMoney } from "@/lib/subscriptions/money";
import { useLedger } from "@/lib/subscriptions/store";
import {
  CATEGORY_LABELS,
  CYCLE_LABELS,
  STATUS_LABELS,
  type Currency,
  type Subscription,
} from "@/lib/subscriptions/types";
import { cn } from "@/lib/utils";

type RowProps = {
  item: Subscription;
  currency: Currency;
  onEdit: (item: Subscription) => void;
  charge?: ChargeEvent;
  showMark?: boolean;
};

export function SubscriptionRow({
  item,
  currency,
  onEdit,
  charge,
  showMark,
}: RowProps) {
  const markCharged = useLedger((s) => s.markCharged);
  const setStatus = useLedger((s) => s.setStatus);
  const removeItem = useLedger((s) => s.removeItem);
  const amount = charge
    ? charge.amount
    : convert(item.amount, item.currency, currency);
  const dateLabel = charge
    ? format(charge.date, "d MMM")
    : format(new Date(`${item.nextBillingDate}T00:00:00`), "d MMM");

  return (
    <article
      className={cn(
        "rounded-3xl bg-card p-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150",
        charge?.overdue && "shadow-[0_0_0_1px_var(--color-warn)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-2 size-2 shrink-0 rounded-full",
            CATEGORY_DOT[item.category],
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => onEdit(item)}
            >
              <p className="truncate font-medium">{item.name}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {CATEGORY_LABELS[item.category]} · {CYCLE_LABELS[item.cycle]}
              </p>
            </button>
            <div className="text-right">
              <p className="font-medium tabular-nums">
                {formatMoney(amount, currency)}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {charge?.overdue ? "Overdue · " : ""}
                {dateLabel}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(item.status)}>
              {STATUS_LABELS[item.status]}
            </Badge>
            {item.currency !== currency ? (
              <Badge variant="outline">
                {formatMoney(item.amount, item.currency)} billed
              </Badge>
            ) : null}
            {item.paymentVia ? (
              <Badge variant="outline">{item.paymentVia.label}</Badge>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {showMark &&
              item.status !== "cancelled" &&
              item.status !== "paused" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    markCharged(item.id);
                    toast(`${item.name} marked charged`);
                  }}
                >
                  <Check className="size-3.5" />
                  Charged
                </Button>
              ) : null}
              {item.url ? (
                <Button variant="ghost" size="icon" className="size-9" asChild>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" />
                    <span className="sr-only">Open {item.name}</span>
                  </a>
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(item)}>
                    Edit
                  </DropdownMenuItem>
                  {item.status === "active" || item.status === "trial" ? (
                    <DropdownMenuItem
                      onClick={() => setStatus(item.id, "paused")}
                    >
                      Pause
                    </DropdownMenuItem>
                  ) : null}
                  {item.status === "paused" ? (
                    <DropdownMenuItem
                      onClick={() => setStatus(item.id, "active")}
                    >
                      Resume
                    </DropdownMenuItem>
                  ) : null}
                  {item.status !== "cancelled" ? (
                    <DropdownMenuItem
                      onClick={() => setStatus(item.id, "cancelled")}
                    >
                      Mark cancelled
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => setStatus(item.id, "active")}
                    >
                      Restore
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      removeItem(item.id);
                      toast(`Removed ${item.name}`);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
