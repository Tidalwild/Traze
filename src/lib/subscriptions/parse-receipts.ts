import type {
  BillingCycle,
  CardNetwork,
  Category,
  Currency,
  PaymentVia,
  Status,
} from "./types.ts";
import { cardLabel } from "./types.ts";

export type EmailStub = {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  body?: string;
};

export type HitKind = "recurring" | "usage" | "one_off" | "expired";

export type ReceiptHit = {
  merchant: string;
  amount: number;
  currency: Currency;
  date: string;
  cycle?: BillingCycle;
  category: Category;
  channel: "apple" | "stripe" | "three_hk" | "github" | "google" | "card" | "paypal" | "generic";
  paymentVia: PaymentVia;
  appleAccount?: string;
  inboxEmail?: string;
  renewsOn?: string;
  kind: HitKind;
  messageId: string;
  url?: string;
};

export type Discovery = {
  merchantKey: string;
  name: string;
  amount: number;
  currency: Currency;
  cycle: BillingCycle;
  category: Category;
  status: Status;
  nextBillingDate: string;
  startedAt: string;
  notes?: string;
  url?: string;
  paymentVia: PaymentVia;
  inboxEmail?: string;
  kind: Exclude<HitKind, "expired"> | "recurring";
  chargeCount: number;
  lastCharged: string;
  accounts: string[];
  confidence: "high" | "medium" | "low";
};

type CatalogEntry = {
  match: RegExp;
  name: string;
  category: Category;
  kind?: HitKind;
  cycle?: BillingCycle;
  url?: string;
};

const CATALOG: CatalogEntry[] = [
  { match: /netflix/i, name: "Netflix", category: "entertainment", cycle: "monthly", url: "https://www.netflix.com" },
  { match: /spotify/i, name: "Spotify", category: "entertainment", url: "https://www.spotify.com" },
  { match: /icloud/i, name: "iCloud+", category: "cloud", cycle: "monthly" },
  { match: /apple\s*one/i, name: "Apple One", category: "entertainment", cycle: "monthly" },
  { match: /github/i, name: "GitHub", category: "software", url: "https://github.com" },
  { match: /nordvpn/i, name: "NordVPN", category: "software", cycle: "yearly" },
  { match: /workspace/i, name: "Google Workspace", category: "cloud", cycle: "monthly" },
  { match: /youtube\s*premium/i, name: "YouTube Premium", category: "entertainment" },
];

const CURRENCY_SET = new Set(["HKD", "USD", "EUR", "GBP", "SGD", "CNY", "JPY", "AUD"]);

export function catalogMatch(text: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.match.test(text));
}

export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseDateToIso(input: string, fallback?: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const iso = `${year}-${String(Number(slash[2])).padStart(2, "0")}-${String(Number(slash[1])).padStart(2, "0")}`;
    if (!Number.isNaN(Date.parse(iso))) return iso;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return fallback;
}

export function parseMoney(blob: string): { amount: number; currency: Currency } | null {
  const m =
    blob.match(/HK\$\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    blob.match(/\b(HKD|USD|EUR|GBP|SGD|CNY|JPY|AUD)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    blob.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  if (/HK\$/.test(m[0]) || m[1] === "HKD") return { amount: Number((m[2] ?? m[1]).replace(/,/g, "")), currency: "HKD" };
  if (CURRENCY_SET.has((m[1] ?? "").toUpperCase())) {
    return { amount: Number(m[2].replace(/,/g, "")), currency: m[1].toUpperCase() as Currency };
  }
  return { amount: Number((m[1] ?? m[2]).replace(/,/g, "")), currency: "USD" };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function flattenGmailSearch(data: unknown): EmailStub[] {
  const root = asRecord(data) ?? {};
  const threads = Array.isArray(root.threads)
    ? root.threads
    : Array.isArray(data)
      ? data
      : Array.isArray(root.messages)
        ? [{ messages: root.messages }]
        : [];
  const out: EmailStub[] = [];
  for (const thread of threads) {
    const rec = asRecord(thread);
    const messages = rec && Array.isArray(rec.messages) ? rec.messages : rec ? [rec] : [];
    for (const raw of messages) {
      const stub = normalizeMessage(raw);
      if (stub) out.push(stub);
    }
  }
  return out;
}

export function normalizeMessage(raw: unknown): EmailStub | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const messageId = asString(rec.message_id ?? rec.messageId ?? rec.id);
  if (!messageId) return null;
  return {
    messageId,
    subject: asString(rec.subject),
    from: asString(rec.from),
    to: Array.isArray(rec.to) ? rec.to.map((item) => asString(item)).filter(Boolean) : [],
    date: asString(rec.date),
    snippet: asString(rec.snippet ?? rec.body_preview),
    body: asString(rec.body_text ?? rec.body) || undefined,
  };
}

export function needsFullBody(msg: EmailStub): boolean {
  const blob = `${msg.from} ${msg.subject} ${msg.snippet}`;
  return /transaction|invoice|receipt|subscription/i.test(blob) && !parseMoney(blob);
}

function last4From(text: string): string | undefined {
  const m = text.match(/(?:ending with|ending in|ending|last\s*4|\u2022{2,}|\*{2,})\s*(\d{4})/i);
  return m?.[1];
}

function detectNetwork(text: string): CardNetwork | undefined {
  const blob = text.toLowerCase();
  if (/amex|american express/.test(blob)) return "amex";
  if (/master\s?card/.test(blob)) return "mastercard";
  if (/visa/.test(blob)) return "visa";
  if (/union\s?pay|\u94f6\u8054|\u9280\u806f/.test(blob)) return "unionpay";
  if (/jcb/.test(blob)) return "jcb";
  if (/discover/.test(blob)) return "discover";
  if (/diners/.test(blob)) return "diners";
  return undefined;
}

export function parseEmail(msg: EmailStub): ReceiptHit[] {
  const blob = `${msg.subject}\n${msg.snippet}\n${msg.body ?? ""}`;
  const catalog = catalogMatch(blob) ?? catalogMatch(msg.subject);
  const money = parseMoney(blob);
  if (!money) return [];
  const last4 = last4From(blob);
  const network = detectNetwork(blob);
  const date = parseDateToIso(msg.date) ?? new Date().toISOString().slice(0, 10);
  const name = catalog?.name ?? (msg.subject.replace(/receipt|invoice|subscription/gi, "").trim() || "Charge");
  return [
    {
      merchant: name,
      amount: money.amount,
      currency: money.currency,
      date,
      cycle: catalog?.cycle ?? "monthly",
      category: catalog?.category ?? "other",
      channel: /apple/.test(msg.from) ? "apple" : last4 ? "card" : "generic",
      paymentVia: last4
        ? { kind: "card", label: cardLabel(network, last4), last4, network }
        : { kind: "other", label: "Inbox" },
      kind: catalog ? "recurring" : "one_off",
      messageId: msg.messageId,
      url: catalog?.url,
    },
  ];
}

export function toDiscoveries(hits: ReceiptHit[], _now = new Date()): Discovery[] {
  const groups = new Map<string, ReceiptHit[]>();
  for (const hit of hits) {
    if (hit.kind === "expired") continue;
    const key = merchantKey(hit.merchant);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(hit);
    groups.set(key, list);
  }
  const out: Discovery[] = [];
  for (const [, list] of groups) {
    const latest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) continue;
    out.push({
      merchantKey: merchantKey(latest.merchant),
      name: latest.merchant,
      amount: latest.amount,
      currency: latest.currency,
      cycle: latest.cycle ?? (list.length >= 2 ? "monthly" : "monthly"),
      category: latest.category,
      status: "active",
      nextBillingDate: latest.renewsOn ?? latest.date,
      startedAt: [...list].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? latest.date,
      url: latest.url,
      paymentVia: latest.paymentVia,
      inboxEmail: latest.inboxEmail,
      kind: latest.kind === "usage" ? "usage" : list.length >= 2 ? "recurring" : latest.kind === "one_off" ? "one_off" : "recurring",
      chargeCount: list.length,
      lastCharged: latest.date,
      accounts: [],
      confidence: list.length >= 2 ? "high" : catalogMatch(latest.merchant) ? "medium" : "low",
    });
  }
  return out;
}

export function collectScanMeta(hits: ReceiptHit[]) {
  const inboxes = [...new Set(hits.map((h) => h.inboxEmail).filter(Boolean))] as string[];
  const appleIds = [...new Set(hits.map((h) => h.appleAccount).filter(Boolean))] as string[];
  const cards = [...new Set(hits.map((h) => h.paymentVia.last4).filter(Boolean))] as string[];
  return { inboxes, appleIds, cards };
}
