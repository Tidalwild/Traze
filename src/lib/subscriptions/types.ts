export const CURRENCIES = [
  "HKD",
  "USD",
  "EUR",
  "GBP",
  "SGD",
  "CNY",
  "JPY",
  "AUD",
] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CYCLES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type BillingCycle = (typeof CYCLES)[number];

export const STATUSES = ["active", "trial", "paused", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export const CATEGORIES = [
  "entertainment",
  "software",
  "cloud",
  "health",
  "utilities",
  "news",
  "education",
  "finance",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PAYMENT_KINDS = [
  "card",
  "apple",
  "google",
  "paypal",
  "bank",
  "other",
] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const CARD_NETWORKS = [
  "visa",
  "mastercard",
  "amex",
  "unionpay",
  "jcb",
  "discover",
  "diners",
] as const;
export type CardNetwork = (typeof CARD_NETWORKS)[number];

export const MAX_SAVED_CARDS = 8;

export type PaymentVia = {
  kind: PaymentKind;
  label: string;
  last4?: string;
  network?: CardNetwork;
  issuer?: string;
};

export type SavedCard = {
  id: string;
  network: CardNetwork;
  last4: string;
  nickname?: string;
};

export type SubscriptionSource = "manual" | "gmail" | "sample" | "statement" | "imap";

export const MAX_MAILBOXES = 4;

export type SavedMailbox = {
  id: string;
  label: string;
  host: string;
  port: number;
  user: string;
};

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  cycle: BillingCycle;
  status: Status;
  category: Category;
  nextBillingDate: string;
  startedAt: string;
  trialEndsAt?: string;
  notes?: string;
  url?: string;
  source?: SubscriptionSource;
  paymentVia?: PaymentVia;
  merchantKey?: string;
  inboxEmail?: string;
};

export const CATEGORY_LABELS: Record<Category, string> = {
  entertainment: "Entertainment",
  software: "Software",
  cloud: "Cloud & storage",
  health: "Health & fitness",
  utilities: "Utilities",
  news: "News",
  education: "Education",
  finance: "Finance",
  other: "Other",
};

export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  trial: "Trial",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  HKD: "Hong Kong dollar",
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  SGD: "Singapore dollar",
  CNY: "Chinese yuan",
  JPY: "Japanese yen",
  AUD: "Australian dollar",
};

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  unionpay: "UnionPay",
  jcb: "JCB",
  discover: "Discover",
  diners: "Diners Club",
};

export function cardLabel(
  network?: CardNetwork,
  last4?: string,
  issuer?: string,
): string {
  const head =
    (network ? CARD_NETWORK_LABELS[network] : undefined) ?? issuer ?? "Card";
  return last4 ? `${head} ··${last4}` : head;
}

export function savedCardLabel(card: SavedCard): string {
  return card.nickname
    ? `${cardLabel(card.network, card.last4)} · ${card.nickname}`
    : cardLabel(card.network, card.last4);
}

/** Digits only; if a full PAN is pasted, keep the last 4 and drop the rest. */
export function takeLast4(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return digits.slice(-4);
}

export function isLast4(value: string): boolean {
  return /^\d{4}$/.test(value);
}

export function sanitizeLast4List(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const last4 = takeLast4(String(value));
    if (!isLast4(last4) || out.includes(last4)) continue;
    out.push(last4);
    if (out.length >= MAX_SAVED_CARDS) break;
  }
  return out;
}

export function matchesSavedCard(
  via: PaymentVia | undefined,
  card: SavedCard,
): boolean {
  if (!via?.last4 || via.last4 !== card.last4) return false;
  if (via.network && via.network !== card.network) return false;
  return true;
}

/** Gmail query for issuer alerts that mention this last-4. Never pass a PAN. */
export function last4SearchQuery(last4: string): string {
  if (!isLast4(last4)) {
    throw new Error("last4SearchQuery requires exactly four digits");
  }
  return `("ending with ${last4}" OR "card ending in ${last4}" OR "ending ${last4}" OR "•••• ${last4}") newer_than:2y`;
}
