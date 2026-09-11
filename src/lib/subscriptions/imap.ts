import { createServerFn } from "@tanstack/react-start";
import {
  parseEmail,
  type EmailStub,
} from "./parse-receipts";
import {
  sanitizeImapList,
  type ImapAccountInput,
} from "./mail-accounts";

export type { ImapAccountInput } from "./mail-accounts";
export { IMAP_PRESETS, sanitizeImapAccount, sanitizeImapList } from "./mail-accounts";

export async function fetchImapMailbox(
  account: ImapAccountInput,
): Promise<{ stubs: EmailStub[]; error?: string }> {
  try {
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.port === 993,
      auth: { user: account.user, pass: account.pass },
      logger: false,
    });
    const timer = setTimeout(() => {
      void client.close();
    }, 12_000);
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const stubs: EmailStub[] = [];
    try {
      const since = new Date();
      since.setMonth(since.getMonth() - 18);
      const uids = await client.search({ since }, { uid: true });
      const list = (Array.isArray(uids) ? uids : []).slice(-80);
      if (list.length) {
        for await (const msg of client.fetch(
          list,
          { envelope: true, source: true, uid: true },
          { uid: true },
        )) {
          const env = msg.envelope;
          const from = formatImapAddr(env?.from?.[0]);
          const to = (env?.to ?? []).map(formatImapAddr).filter(Boolean);
          const subject = env?.subject ?? "";
          const dateRaw = env?.date;
          const date =
            dateRaw instanceof Date
              ? dateRaw.toUTCString()
              : dateRaw
                ? String(dateRaw)
                : "";
          let body = "";
          if (msg.source) {
            body = msg.source.toString("utf8").slice(0, 20_000);
          }
          const blob = `${subject}\n${body}`;
          if (
            !/receipt|invoice|subscription|transaction|renew|billing|apple|stripe|paypal|github|hsbc|amex|visa|mastercard/i.test(
              blob,
            )
          ) {
            continue;
          }
          const id = String(msg.uid ?? env?.messageId ?? `${account.user}-${stubs.length}`);
          stubs.push({
            messageId: `imap-${account.user}-${id}`,
            subject,
            from,
            to: to.length ? to : [account.email ?? account.user],
            date,
            snippet: subject,
            body: stripImapSource(body),
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

function formatImapAddr(addr?: {
  name?: string;
  address?: string;
}): string {
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
  if (/authentication|invalid credentials|login/i.test(message)) {
    return "IMAP login failed. Use an app password, not the mailbox password.";
  }
  if (/timeout|timed out|enotfound|econn/i.test(message)) {
    return "Could not reach that IMAP server from here.";
  }
  return "Could not read that mailbox.";
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
      if (next.error) {
        errors.push(`${account.email ?? account.user}: ${next.error}`);
      }
    }
    return {
      stubs,
      errors,
      hits: stubs.flatMap((msg) => parseEmail(msg)),
    };
  });
