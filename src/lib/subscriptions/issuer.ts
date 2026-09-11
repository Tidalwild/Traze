const KNOWN: [RegExp, string][] = [
  [/apple\.com/i, "Apple"],
  [/icloud\.com/i, "Apple"],
  [/netflix/i, "Netflix"],
  [/spotify/i, "Spotify"],
  [/stripe\.com/i, "Stripe"],
  [/paypal\.com/i, "PayPal"],
  [/github\.com/i, "GitHub"],
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/googleplay|google\.com|googlemail/i, "Google"],
  [/microsoft\.com|office365/i, "Microsoft"],
  [/adobe\.com/i, "Adobe"],
  [/openai\.com/i, "OpenAI"],
  [/anthropic/i, "Anthropic"],
  [/x\.ai|xai\.com/i, "xAI"],
  [/hsbc/i, "HSBC"],
  [/hangseng|hang-seng/i, "Hang Seng"],
  [/three\.com\.hk/i, "3 Hong Kong"],
  [/amazon\./i, "Amazon"],
  [/dropbox/i, "Dropbox"],
  [/notion\.so/i, "Notion"],
  [/figma\.com/i, "Figma"],
  [/zoom\.us/i, "Zoom"],
];

export function emailFromHeader(from: string): string {
  const angle = from.match(/<([^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  const bare = from.match(/[^\s<>]+@[^\s<>]+/);
  return (bare?.[0] ?? from).trim().toLowerCase();
}

export function issuerFromAddress(from: string): { issuer: string; email: string } {
  const email = emailFromHeader(from);
  const host = (email.split("@")[1] ?? "")
    .replace(/^(mail|email|noreply|no-reply|billing|notify|notifications|support|account|info|payments?|receipts?)\./i, "")
    .toLowerCase();
  for (const [re, name] of KNOWN) {
    if (re.test(email) || re.test(host)) return { issuer: name, email };
  }
  const brand = host.split(".")[0] ?? "";
  const issuer = brand
    ? brand.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : fromHeaderDisplay(from);
  return { issuer, email };
}

function fromHeaderDisplay(from: string): string {
  const angle = from.match(/^(.*?)\s*<.*>$/);
  const raw = (angle ? angle[1] : from).replace(/"/g, "").trim();
  return raw.replace(/@.*$/, "").trim() || raw || "Inbox";
}

export function formatScanDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-HK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
