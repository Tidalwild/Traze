import {
  catalogMatch,
  merchantKey,
  parseDateToIso,
  parseMoney,
  toDiscoveries,
  type Discovery,
  type ReceiptHit,
} from "./parse-receipts.ts";
import {
  takeLast4,
  type CardNetwork,
  type Currency,
  type SavedCard,
} from "./types.ts";
import { cardLabel } from "./types.ts";

const SPEND_SKIP =
  /\b(supermarket|grocery|7-eleven|7 eleven|wellcome|park n shop|foodpanda|deliveroo|uber eats|mtr|octopus|taxi|atm|withdrawal|fps|payme)\b/i;

export type StatementRow = {
  date: string;
  description: string;
  amount: number;
  currency: Currency;
};

export function parseStatementCsv(
  text: string,
  fallbackCurrency: Currency = "HKD",
): StatementRow[] {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const lines = splitCsvLines(raw);
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0] ?? "").map((h) => h.toLowerCase().trim());
  const dateIdx = header.findIndex((h) => /date|\u4ea4\u6613\u65e5\u671f|\u904e\u5e33/.test(h));
  const descIdx = header.findIndex((h) =>
    /desc|merchant|\u8a73\u60c5|\u6458\u8981|narrative|particular/.test(h),
  );
  const amountIdx = header.findIndex((h) =>
    /amount|debit|spend|\u652f\u51fa|\u91d1\u984d|hkd|usd/.test(h) && !/credit|balance|\u9918\u984d/.test(h),
  );
  const creditIdx = header.findIndex((h) => /credit|\u5b58\u5165/.test(h));
  if (dateIdx < 0 || descIdx < 0) return [];
  const rows: StatementRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvRow(line);
    const date = parseDateToIso(cols[dateIdx] ?? "");
    const description = (cols[descIdx] ?? "").replace(/\s+/g, " ").trim();
    if (!date || !description) continue;
    const debit = parseAmountCell(cols[amountIdx >= 0 ? amountIdx : descIdx] ?? "");
    const credit = creditIdx >= 0 ? parseAmountCell(cols[creditIdx] ?? "") : null;
    let amount = 0;
    let currency: Currency = fallbackCurrency;
    if (debit && debit.amount > 0) {
      amount = debit.amount;
      currency = debit.currency ?? fallbackCurrency;
    } else if (credit && credit.amount < 0) {
      amount = Math.abs(credit.amount);
      currency = credit.currency ?? fallbackCurrency;
    } else {
      const money = parseMoney(description) ?? parseMoney(cols.join(" "));
      if (!money) continue;
      amount = money.amount;
      currency = money.currency;
    }
    if (amount <= 0) continue;
    rows.push({ date, description, amount, currency });
  }
  return rows;
}

export function statementToDiscoveries(
  rows: StatementRow[],
  card?: SavedCard,
  now = new Date(),
): Discovery[] {
  const hits: ReceiptHit[] = [];
  for (const row of rows) {
    if (SPEND_SKIP.test(row.description)) continue;
    const catalog = catalogMatch(row.description);
    const name = catalog?.name ?? tidyMerchant(row.description);
    if (!name) continue;
    hits.push({
      merchant: name,
      amount: row.amount,
      currency: row.currency,
      date: row.date,
      cycle: catalog?.cycle,
      category: catalog?.category ?? "other",
      channel: "card",
      paymentVia: {
        kind: "card",
        label: card
          ? cardLabel(card.network, card.last4, card.nickname)
          : "Statement",
        last4: card?.last4,
        network: card?.network,
        issuer: card?.nickname,
      },
      kind: catalog?.kind ?? "one_off",
      messageId: `stmt-${row.date}-${merchantKey(name)}-${row.amount}`,
    });
  }
  return toDiscoveries(hits, now).map((d) => ({
    ...d,
    notes: `${d.chargeCount} line${d.chargeCount === 1 ? "" : "s"} on statement`,
  }));
}

function tidyMerchant(description: string): string {
  let text = description
    .replace(/\s+/g, " ")
    .replace(/\b(visa|mastercard|amex|pos|contactless|hk|hong kong)\b/gi, " ")
    .replace(/[0-9]{4,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const catalog = catalogMatch(text);
  if (catalog) return catalog.name;
  if (text.length > 42) text = text.slice(0, 42).trim();
  return text;
}

function parseAmountCell(
  cell: string,
): { amount: number; currency?: Currency } | null {
  const cleaned = cell.replace(/[()]/g, "-").trim();
  if (!cleaned) return null;
  const money = parseMoney(cleaned);
  if (money) return money;
  const n = Number(cleaned.replace(/,/g, ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return { amount: Math.abs(n) };
}

function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (current.trim()) lines.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function splitCsvRow(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === "," || ch === ";" || ch === "\t") && !inQuotes) {
      cols.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current.trim());
  return cols;
}

export function guessNetworkFromFilename(name: string): CardNetwork | undefined {
  const n = name.toLowerCase();
  if (/amex|american/.test(n)) return "amex";
  if (/master/.test(n)) return "mastercard";
  if (/union|\u94f6\u8054|\u9280\u806f/.test(n)) return "unionpay";
  if (/visa/.test(n)) return "visa";
  return undefined;
}

export function last4FromFilename(name: string): string | undefined {
  const m = name.match(/(?:ending|last4|x{2,}|·{2,})(\d{4})/i) ?? name.match(/(\d{4})(?=\.[a-z]+$)/i);
  if (!m) return undefined;
  const last4 = takeLast4(m[1] ?? "");
  return last4.length === 4 ? last4 : undefined;
}
