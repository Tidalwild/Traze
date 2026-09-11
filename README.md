# Traze

Personal subscription ledger. MIT.

Scan **Gmail and Outlook** (when opened in Grok), extra **IMAP** mailboxes (iCloud, Yahoo, another Gmail), and **issuer statement CSVs**. Match charges to saved cards by **last 4** only — never a full PAN. Banks do not log in from a card number.

## Run from this repo

You need **Node 22+** and git.

```bash
git clone https://github.com/Tidalwild/Traze.git
cd Traze
npm install
npm run dev
```

Then open **http://localhost:8080** in a browser. Leave the terminal running. Stop with Ctrl+C.

Check Node first: `node -v` should print `v22` or newer. On a Mac with Homebrew: `brew install node@22`.

Ledger, cards, and IMAP passwords stay in **this browser** (`localStorage`). They are not uploaded.

On your own host, Grok Gmail/Outlook connectors do not work. Use:

1. Extra IMAP mailboxes (app password)
2. Statement CSV from the bank / card app
3. Manual add

## What it does

- Monthly / yearly run-rate
- Ledger with pause, cancel, mark charged
- Calendar and insights (including by card)
- Mail scan → add discoveries
- Statement CSV → repeating merchants
- Manual add with network + last 4

## Networks

Visa · Mastercard · American Express · UnionPay · JCB · Discover · Diners Club

## How scan works

1. Save last 4 + network. Saving a card starts a scan.
2. Grok: Gmail and Outlook connectors. Extra inboxes: IMAP app password.
3. Drop a CSV from HSBC / Hang Seng / Amex / Chase / Citi for posted history.
4. Parser keeps last-4 from alerts. Full numbers in mail are redacted.

Open-banking / Plaid issuer login is **not** included.

## Stack

TanStack Start, React 19, Tailwind v4, Zustand (`localStorage`). Auth and the database stay off.

## License

MIT
