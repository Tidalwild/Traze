import { createServerFn } from "@tanstack/react-start";
import {
  classifyCallToolError,
  ConnectorType,
  type CallToolErrorKind,
} from "@/lib/app-data";
import { fetchImapMailbox } from "./imap";
import { sanitizeImapList } from "./mail-accounts";
import {
  collectScanMeta,
  flattenGmailSearch,
  needsFullBody,
  normalizeMessage,
  parseEmail,
  toDiscoveries,
  type Discovery,
  type EmailStub,
  type ReceiptHit,
} from "./parse-receipts";
import { last4SearchQuery, sanitizeLast4List } from "./types";

export type ScanOk = {
  ok: true;
  discoveries: Discovery[];
  scanned: number;
  fetched: number;
  inboxes: string[];
  appleIds: string[];
  cards: string[];
  sources: string[];
  warnings: string[];
};

export type ScanErr = {
  ok: false;
  kind: CallToolErrorKind;
  message: string;
  detail?: string;
  loginUrl?: string;
  loginRequired?: boolean;
  pending?: boolean;
};

export type ScanResponse = ScanOk | ScanErr;

const SEARCHES: { query: string; max: number }[] = [
  { query: "from:email.apple.com (invoice OR purchases OR subscription OR receipt) newer_than:2y", max: 20 },
  { query: "from:stripe.com (receipt OR invoice) newer_than:1y", max: 20 },
];

function fail(result: {
  errorMessage?: string;
  loginUrl?: string;
  loginRequired?: boolean;
  pending?: boolean;
  ok: boolean;
  data: unknown;
}): ScanErr {
  const classified = classifyCallToolError(result);
  return {
    ok: false,
    kind: classified?.kind ?? "error",
    message: classified?.message ?? "Could not read mail.",
    detail: classified?.detail,
    loginUrl: result.loginUrl,
    loginRequired: result.loginRequired,
    pending: result.pending,
  };
}

function mergeStubs(byId: Map<string, EmailStub>, stubs: EmailStub[]) {
  for (const stub of stubs) {
    const existing = byId.get(stub.messageId);
    if (!existing) byId.set(stub.messageId, stub);
    else if (stub.body && !existing.body) byId.set(stub.messageId, stub);
  }
}

async function scanConnector(options: {
  connectorType: typeof ConnectorType.Gmail | typeof ConnectorType.Outlook;
  searchTool: string;
  getTool: string;
  searches: { query: string; max: number }[];
  last4s: string[];
  byId: Map<string, EmailStub>;
}): Promise<{ fetched: number; error?: ScanErr; skipped?: string }> {
  const { callTool } = await import("@/lib/app-data/client.server");
  const searches = [
    ...options.searches,
    ...options.last4s.map((last4) => ({ query: last4SearchQuery(last4), max: 12 })),
  ];
  const result = await callTool(
    options.searchTool,
    { query: searches[0]?.query, max_results: searches[0]?.max ?? 10 },
    { connectorType: options.connectorType },
  );
  if (!result.ok) {
    const classified = classifyCallToolError(result);
    if (classified?.kind === "not_connected" || classified?.kind === "scope_denied") {
      return { fetched: 0, skipped: classified.message };
    }
    if (result.loginRequired || result.pending) return { fetched: 0, error: fail(result) };
    return { fetched: 0, skipped: `${options.connectorType} is not available here.` };
  }
  mergeStubs(options.byId, flattenGmailSearch(result.data));
  return { fetched: 0 };
}

export const scanInbox = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const rec = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const inner =
      rec.imap !== undefined || rec.last4s !== undefined
        ? rec
        : rec.data && typeof rec.data === "object"
          ? (rec.data as Record<string, unknown>)
          : rec;
    return {
      last4s: sanitizeLast4List(inner.last4s),
      imap: sanitizeImapList(inner.imap),
    };
  })
  .handler(async ({ data }): Promise<ScanResponse> => {
    const byId = new Map<string, EmailStub>();
    const warnings: string[] = [];
    const sources: string[] = [];
    let fetched = 0;

    const gmail = await scanConnector({
      connectorType: ConnectorType.Gmail,
      searchTool: "gmail_search",
      getTool: "gmail_get_message",
      searches: SEARCHES,
      last4s: data.last4s,
      byId,
    });
    if (gmail.skipped) warnings.push("Gmail: not connected in Grok.");
    else if (!gmail.error) {
      sources.push("Gmail");
      fetched += gmail.fetched;
    }

    for (const account of data.imap) {
      const next = await fetchImapMailbox(account);
      mergeStubs(byId, next.stubs);
      if (next.error) warnings.push(`${account.email ?? account.user}: ${next.error}`);
      else sources.push(account.email ?? account.user);
    }

    if (byId.size === 0 && sources.length === 0) {
      const imapFail = warnings.find((w) =>
        /IMAP|mailbox|login|app password|credentials|imapflow|library/i.test(w),
      );
      return {
        ok: false,
        kind: imapFail ? "error" : "not_connected",
        message:
          imapFail ??
          "On this Mac, add an IMAP mailbox or drop a statement CSV. Grok Gmail only works in the Grok preview.",
        detail: warnings.join(" "),
      };
    }

    const hits: ReceiptHit[] = [];
    for (const msg of byId.values()) hits.push(...parseEmail(msg));
    return {
      ok: true,
      discoveries: toDiscoveries(hits),
      scanned: byId.size,
      fetched,
      sources,
      warnings,
      ...collectScanMeta(hits),
    };
  });
