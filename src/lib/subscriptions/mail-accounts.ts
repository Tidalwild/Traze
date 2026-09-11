export type ImapAccountInput = {
  host: string;
  port: number;
  user: string;
  pass: string;
  email?: string;
};

export const IMAP_PRESETS: {
  id: string;
  label: string;
  host: string;
  port: number;
}[] = [
  { id: "gmail", label: "Gmail", host: "imap.gmail.com", port: 993 },
  { id: "outlook", label: "Outlook / Hotmail", host: "outlook.office365.com", port: 993 },
  { id: "icloud", label: "iCloud", host: "imap.mail.me.com", port: 993 },
  { id: "yahoo", label: "Yahoo", host: "imap.mail.yahoo.com", port: 993 },
  { id: "custom", label: "Other IMAP", host: "", port: 993 },
];

const HOST_OK = /^[a-z0-9.-]+$/i;
const USER_MAX = 120;
const PASS_MAX = 128;

export function sanitizeImapAccount(raw: unknown): ImapAccountInput | null {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!rec) return null;
  const host = String(rec.host ?? "").trim().toLowerCase();
  const user = String(rec.user ?? rec.email ?? "").trim();
  const pass = String(rec.pass ?? "").replace(/\s+/g, "");
  const port = Number(rec.port ?? 993);
  if (!HOST_OK.test(host) || host.length > 80) return null;
  if (!user || user.length > USER_MAX || user.includes("\n")) return null;
  if (!pass || pass.length > PASS_MAX) return null;
  if (port !== 993 && port !== 143) return null;
  const email = String(rec.email ?? user).trim();
  return { host, port, user, pass, email };
}

export function sanitizeImapList(raw: unknown): ImapAccountInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ImapAccountInput[] = [];
  for (const item of raw) {
    const next = sanitizeImapAccount(item);
    if (next) out.push(next);
    if (out.length >= 4) break;
  }
  return out;
}
