import type {
  BillingCycle,
  Category,
  Currency,
  PaymentVia,
  Status,
  Subscription,
} from "./types.ts";

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
  { match: /nordvpn/i, name: "NordVPN", category: "software", cycle: "yearly" },
  { match: /icloud/i, name: "iCloud+", category: "cloud", cycle: "monthly" },
  { match: /apple\s*one/i, name: "Apple One", category: "entertainment", cycle: "monthly" },
  { match: /apple\s*tv/i, name: "Apple TV+", category: "entertainment" },
  { match: /apple\s*music/i, name: "Apple Music", category: "entertainment" },
  { match: /app store|invoice from apple|email\.apple\.com/i, name: "App Store", category: "entertainment", cycle: "monthly" },
  { match: /netflix/i, name: "Netflix", category: "entertainment", cycle: "monthly", url: "https://www.netflix.com" },
  { match: /spotify/i, name: "Spotify", category: "entertainment", url: "https://www.spotify.com" },
  { match: /youtube\s*premium/i, name: "YouTube Premium", category: "entertainment" },
  { match: /github/i, name: "GitHub", category: "software", url: "https://github.com" },
  { match: /workspace/i, name: "Google Workspace", category: "cloud", cycle: "monthly" },
  { match: /google\s*one/i, name: "Google One", category: "cloud", cycle: "monthly" },
  { match: /openai|chatgpt/i, name: "ChatGPT", category: "software", cycle: "monthly" },
  { match: /\bgrok\b|xai/i, name: "Grok xAI", category: "software" },
  { match: /microsoft 365|office 365/i, name: "Microsoft 365", category: "software", cycle: "monthly" },
  { match: /adobe/i, name: "Adobe", category: "software", cycle: "monthly" },
  { match: /three\.com\.hk|3 hong kong/i, name: "3 Hong Kong", category: "utilities", cycle: "monthly" },
];

export function catalogMatch(text: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.match.test(text));
}

export function merchantKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseDateToIso(input: string, fallback?: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return fallback;
}

function toAmount(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

export function parseMoney(blob: string): { amount: number; currency: Currency } | null {
  const hk = blob.match(/HK\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (hk) return { amount: toAmount(hk[1]), currency: "HKD" };
  const us = blob.match(/US\$\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (us) return { amount: toAmount(us[1]), currency: "USD" };
  const code = blob.match(/\b(HKD|USD|EUR|GBP|SGD|CNY|JPY|AUD)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (code) return { amount: toAmount(code[2]), currency: code[1].toUpperCase() as Currency };
  const dollar = blob.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  if (dollar) return { amount: toAmount(dollar[1]), currency: "USD" };
  return null;
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

export function parseEmail(msg: EmailStub): ReceiptHit[] {
  const blob = `${msg.from}\n${msg.subject}\n${msg.snippet}\n${msg.body ?? ""}`;
  const catalog = catalogMatch(blob);
  const money = parseMoney(blob);
  if (!catalog && !money) return [];
  const cleaned = msg.subject
    .replace(/your |invoice from |receipt|subscription|payment/gi, "")
    .trim()
    .slice(0, 48);
  const name = catalog?.name ?? (cleaned || "Charge");
  return [
    {
      merchant: name,
      amount: money?.amount ?? 0,
      currency: money?.currency ?? "HKD",
      date: parseDateToIso(msg.date) ?? new Date().toISOString().slice(0, 10),
      cycle: catalog?.cycle ?? "monthly",
      category: catalog?.category ?? "other",
      channel: /apple/.test(msg.from) ? "apple" : "generic",
      paymentVia: { kind: "other", label: catalog ? name : "Inbox" },
      kind: catalog ? "recurring" : "one_off",
      messageId: msg.messageId,
      url: catalog?.url,
      inboxEmail: msg.to[0],
    },
  ];
}

export function toDiscoveries(hits: ReceiptHit[]): Discovery[] {
  const groups = new Map<string, ReceiptHit[]>();
  for (const hit of hits) {
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
    const oneOff = latest.kind === "one_off" && list.length < 2;
    const usage = latest.kind === "usage";
    out.push({
      merchantKey: merchantKey(latest.merchant),
      name: latest.merchant,
      amount: latest.amount,
      currency: latest.currency,
      cycle: latest.cycle ?? "monthly",
      category: latest.category,
      status: "active",
      nextBillingDate: latest.date,
      startedAt: latest.date,
      url: latest.url,
      paymentVia: latest.paymentVia,
      inboxEmail: latest.inboxEmail,
      kind: usage ? "usage" : oneOff ? "one_off" : "recurring",
      chargeCount: list.length,
      lastCharged: latest.date,
      accounts: [],
      confidence: list.length >= 2 || catalogMatch(latest.merchant) ? "medium" : "low",
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function collectScanMeta(hits: ReceiptHit[]) {
  return {
    inboxes: [...new Set(hits.map((h) => h.inboxEmail).filter(Boolean))] as string[],
    appleIds: [...new Set(hits.map((h) => h.appleAccount).filter(Boolean))] as string[],
    cards: [...new Set(hits.map((h) => h.paymentVia.last4).filter(Boolean))] as string[],
  };
}

export function discoveryToSubscription(discovery: Discovery, id: string): Subscription {
  return {
    id,
    name: discovery.name,
    amount: discovery.amount,
    currency: discovery.currency,
    cycle: discovery.cycle,
    status: discovery.status,
    category: discovery.category,
    nextBillingDate: discovery.nextBillingDate,
    startedAt: discovery.startedAt,
    notes: discovery.notes,
    url: discovery.url,
    source: "gmail",
    paymentVia: discovery.paymentVia,
    merchantKey: discovery.merchantKey,
    inboxEmail: discovery.inboxEmail,
  };
}

export function matchesLedger(item: Subscription, discovery: Discovery): boolean {
  if (item.merchantKey && item.merchantKey === discovery.merchantKey) return true;
  return merchantKey(item.name) === discovery.merchantKey;
}
