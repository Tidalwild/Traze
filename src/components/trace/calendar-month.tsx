import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SubscriptionRow } from "@/components/trace/charge-row";
import { Button } from "@/components/ui/button";
import { listCharges } from "@/lib/subscriptions/calc";
import type { Currency, Subscription } from "@/lib/subscriptions/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  items: Subscription[];
  currency: Currency;
  onEdit: (item: Subscription) => void;
};

export function CalendarMonth({ items, currency, onEdit }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);

  const charges = useMemo(
    () => listCharges(items, startOfMonth(month), endOfMonth(month), currency),
    [items, month, currency],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof charges>();
    for (const ev of charges) {
      const key = format(ev.date, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [charges]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const selectedCharges = selectedKey ? (byDay.get(selectedKey) ?? []) : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-medium tracking-tight">
          {format(month, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => {
              setMonth((m) => subMonths(m, 1));
              setSelected(null);
            }}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => {
              setMonth((m) => addMonths(m, 1));
              setSelected(null);
            }}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, month);
            const dayCharges = inMonth ? (byDay.get(key) ?? []) : [];
            const isSelected = selected ? isSameDay(day, selected) : false;
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-xl py-1.5 text-sm transition-colors duration-150",
                  !inMonth && "text-muted-foreground/40",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                      ? "bg-secondary"
                      : "hover:bg-accent",
                )}
              >
                <span className="tabular-nums">{format(day, "d")}</span>
                {dayCharges.length > 0 ? (
                  <span
                    className={cn(
                      "mt-0.5 size-1 rounded-full",
                      isSelected ? "bg-primary-foreground" : "bg-cat-software",
                    )}
                  />
                ) : (
                  <span className="mt-0.5 size-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">
          {selected
            ? format(selected, "EEEE d MMMM")
            : `${charges.length} charge${charges.length === 1 ? "" : "s"} this month`}
        </h3>
        <div className="mt-3 flex flex-col gap-3">
          {(selected ? selectedCharges : charges).length === 0 ? (
            <p className="rounded-3xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
              {selected ? "Nothing bills this day." : "No live charges this month."}
            </p>
          ) : (
            (selected ? selectedCharges : charges).map((ev) => (
              <SubscriptionRow
                key={`${ev.sub.id}-${ev.date.toISOString()}`}
                item={ev.sub}
                currency={currency}
                onEdit={onEdit}
                charge={ev}
                showMark
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
