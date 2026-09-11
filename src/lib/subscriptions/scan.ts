import { createServerFn } from "@tanstack/react-start";
import {
  classifyCallToolError,
  ConnectorType,
  type CallToolErrorKind,
} from "@/lib/app-data";
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

export type ScanOk = {
  ok: true;
  discoveries: Discovery[];
  scanned: number;
  fetched: number;
  inboxes: string[];
  appleIds: string[];
  cards: string[];
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
  {
    query:
      "from:email.apple.com (invoice OR purchases OR subscription OR receipt) newer_than:2y",
    max: 20,
  },
  {
    query: "from:stripe.com (receipt OR invoice) newer_than:1y",
    max: 20,
  },
  {
    query: "from:billing3@three.com.hk newer_than:2y",
    max: 8,
  },
  {
    query: 'from:github.com subject:"Payment Receipt" newer_than:2y',
    max: 6,
  },
  {
    query:
      "from:HSBC_CNP@notification.hsbc.com.hk newer_than:6m",
    max: 16,
  },
  {
    query:
      '(from:americanexpress.com OR from:amex.com OR from:paypal.com OR from:visa.com OR from:mastercard.com OR from:unionpay.com OR from:jcb.co.jp OR from:discover.com OR from:dinersclub.com OR from:hangseng.com OR from:citibank.com OR from:dbs.com) (receipt OR transaction OR alert OR statement OR subscription OR purchase) newer_than:1y',
    max: 20,
  },
  {
    query:
      '(subject:"transaction notification" OR subject:"card transaction" OR subject:"credit card" OR subject:"American Express" OR subject:"Visa" OR subject:"Mastercard" OR subject:"UnionPay" OR subject:"銀聯" OR subject:"JCB" OR subject:"Discover" OR subject:"Diners") newer_than:6m -from:hsbc.communications -from:message.hsbc.com.hk',
    max: 16,
  },
  {
    query:
      "(from:google.com OR from:workspace-noreply@google.com) (subscription OR billing OR invoice OR workspace) newer_than:2y",
    max: 8,
  },
];

const GET_MESSAGE_CAP = 16;

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
    message: classified?.message ?? "Could not read Gmail.",
    detail: classified?.detail,
    loginUrl: result.loginUrl,
    loginRequired: result.loginRequired,
    pending: result.pending,
  };
}

export const scanInbox = createServerFn({ method: "POST" }).handler(
  async (): Promise<ScanResponse> => {
    const { callTool } = await import("@/lib/app-data/client.server");
    const byId = new Map<string, EmailStub>();

    for (const search of SEARCHES) {
      const result = await callTool(
        "gmail_search",
        { query: search.query, max_results: search.max },
        { connectorType: ConnectorType.Gmail },
      );
      if (!result.ok) return fail(result);
      for (const stub of flattenGmailSearch(result.data)) {
        const existing = byId.get(stub.messageId);
        if (!existing) {
          byId.set(stub.messageId, stub);
        } else if (stub.body && !existing.body) {
          byId.set(stub.messageId, stub);
        }
      }
    }

    const pendingFetch = [...byId.values()].filter(
      (msg) => !msg.body && needsFullBody(msg),
    );
    let fetched = 0;
    for (const msg of pendingFetch.slice(0, GET_MESSAGE_CAP)) {
      const result = await callTool(
        "gmail_get_message",
        { message_id: msg.messageId },
        { connectorType: ConnectorType.Gmail },
      );
      if (!result.ok) {
        if (result.loginRequired || result.pending) return fail(result);
        continue;
      }
      const full = normalizeMessage(result.data);
      if (full) byId.set(full.messageId, { ...msg, ...full, snippet: full.snippet || msg.snippet });
      fetched += 1;
    }

    const hits: ReceiptHit[] = [];
    for (const msg of byId.values()) {
      hits.push(...parseEmail(msg));
    }
    const discoveries = toDiscoveries(hits);
    const meta = collectScanMeta(hits);
    return {
      ok: true,
      discoveries,
      scanned: byId.size,
      fetched,
      ...meta,
    };
  },
);
