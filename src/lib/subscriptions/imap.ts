import { createServerFn } from "@tanstack/react-start";
import { parseEmail, type EmailStub } from "./parse-receipts";
import { sanitizeImapList, type ImapAccountInput } from "./mail-accounts";
import { scorePaymentLikelihood } from "./payment-filter";

export type { ImapAccountInput } from "./mail-accounts";
export { IMAP_PRESETS, sanitizeImapAccount, sanitizeImapList } from "./mail-accounts";

const SUBJECT_QUERIES = [
  "receipt",
  "invoice",
  "subscription",
  "payment",
  "renewal",
  "billing",
  "charged",
  "your order",
  "your purchase",
  "transaction alert",
];

export async function fetchImapMailbox(
  account: ImapAccountInput,
): Promise<{ stubs: EmailStub[]; error?: string }> {
  try {
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.port === 993,
      auth: { user: account.user, pass: account.pass.replace(/\s+/g, "") },
      logger: false,
    });
    const timer = setTimeout(() => {
      void client.close();
    }, 45_000);
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const stubs: EmailStub[] = [];
    const seen = new Set<string>();
    try {
      const since = new Date();
      since.setMonth(since.getMonth() - 12);
      for (const query of SUBJECT_QUERIES) {
        if (stubs.length >= 120) break;
        let uids: unknown;
        try {
          uids = await client.search({ since, subject: query }, { uid: true });
        } catch {
          continue;
        }
        const list = (Array.isArray(uids) ? uids : []).slice(-24);
        if (!list.length) continue;
        for await (const msg of client.fetch(
          list,
          { envelope: true, source: true, uid: true },
          { uid: true },
        )) {
          const uid = String(msg.uid ?? "");
          if (!uid || seen.has(uid) || stubs.length >= 120) continue;
          seen.add(uid);
          const env = msg.envelope;
          const from = formatImapAddr(env?.from?.[0]);
          const to = (env?.to ?? []).map(formatImapAddr).filter(Boolean);
          const subject = env?.subject ?? "";
          const dateRaw = env?.date;
          const date =
            dateRaw instanceof Date ? dateRaw.toUTCString() : dateRaw ? String(dateRaw) : "";
          let body = "";
          if (msg.source) {
            const raw = Buffer.isBuffer(msg.source) ? msg.source : Buffer.from(msg.source);
            try {
              const { simpleParser } = await import("mailparser");
              const parsed = await simpleParser(raw);
              const html = parsed.html ? String(parsed.html) : "";
              body = [parsed.text, html.replace(/<[^>]+>/g, " ")]
                .filter(Boolean)
                .join("\n")
                .replace(/\s+/g, " ")
                .slice(0, 8_000);
            } catch {
              body = stripImapSource(raw.toString("utf8").slice(0, 12_000));
            }
          }
          const scored = scorePaymentLikelihood(subject, from, body);
          if (!scored.isPayment) continue;
          stubs.push({
            messageId: `imap-${account.user}-${uid}`,
            subject,
            from,
            to: to.length ? to : [account.email ?? account.user],
            date,
            snippet: subject,
            body,
          });
        }
      }
    } finally {
      lock.release();
      clearTimeout(timer);
      await client.logout().catch(() => undefined);
    }
    return { stubs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAP failed";
    return { stubs: [], error: tidyImapError(message) };
  }
}

function formatImapAddr(addr?: { name?: string; address?: string }): string {
  if (!addr) return "";
  if (addr.name && addr.address) return `${addr.name} <${addr.address}>`;
  return addr.address ?? addr.name ?? "";
}

function stripImapSource(source: string): string {
  const match = source.match(/\r?\n\r?\n([\s\S]*)$/);
  const body = match?.[1] ?? source;
  return body
    .replace(/<[^>]+>/g, " ")
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\s+/g, " ")
    .slice(0, 8_000);
}

function tidyImapError(message: string): string {
  if (/cannot find module|imapflow|mailparser/i.test(message)) {
    return "IMAP library missing. In the Traze folder run npm install, then Scan mail again.";
  }
  if (/authentication|invalid credentials|login|alert/i.test(message)) {
    return "IMAP login failed. Paste the app password on the mailbox row and enable IMAP in Gmail.";
  }
  if (/timeout|timed out|enotfound|econn/i.test(message)) {
    return "Could not reach that IMAP server from here.";
  }
  return `Could not read that mailbox (${message.slice(0, 80)})`;
}

export const scanImapMailboxes = createServerFn({ method: "POST" })
  .validator((input: { accounts?: unknown } | undefined) => ({
    accounts: sanitizeImapList(input?.accounts),
  }))
  .handler(async ({ data }) => {
    const stubs: EmailStub[] = [];
    const errors: string[] = [];
    for (const account of data.accounts) {
      const next = await fetchImapMailbox(account);
      stubs.push(...next.stubs);
      if (next.error) errors.push(`${account.email ?? account.user}: ${next.error}`);
    }
    return { stubs, errors, hits: stubs.flatMap((msg) => parseEmail(msg)) };
  });
