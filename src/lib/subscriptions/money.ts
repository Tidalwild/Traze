import type { BillingCycle, Currency, Subscription } from "./types";

/** Approximate mid-market rates, quoted against HKD. Display-only. */
export const FX_TO_HKD: Record<Currency, number> = {
  HKD: 1,
  USD: 7.8,
  EUR: 8.5,
  GBP: 10.2,
  SGD: 5.8,
  CNY: 1.08,
  JPY: 0.053,
  AUD: 5.1,
};

export const MONTHS_PER_CYCLE: Record<BillingCycle, number> = {
  weekly: 12 / 52,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export function convert(amount: number, from: Currency, to: Currency): number {
  return (amount * FX_TO_HKD[from]) / FX_TO_HKD[to];
}

export function monthlyEquivalent(sub: Subscription, display: Currency): number {
  const months = MONTHS_PER_CYCLE[sub.cycle];
  return convert(sub.amount, sub.currency, display) / months;
}

export function yearlyEquivalent(sub: Subscription, display: Currency): number {
  return monthlyEquivalent(sub, display) * 12;
}

export function isLive(sub: Subscription): boolean {
  return sub.status === "active" || sub.status === "trial";
}

export function formatMoney(amount: number, currency: Currency): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Math.abs(rounded - Math.round(rounded)) < 0.005;
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(rounded);
}

export function usesForeignCurrency(
  items: Subscription[],
  display: Currency,
): boolean {
  return items.some((item) => item.currency !== display);
}
