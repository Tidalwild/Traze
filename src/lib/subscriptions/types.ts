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

export type PaymentVia = {
  kind: PaymentKind;
  label: string;
  last4?: string;
  network?: CardNetwork;
  issuer?: string;
};

export type SubscriptionSource = "manual" | "gmail" | "sample";

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
