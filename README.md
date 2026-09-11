# Traze

Personal subscription ledger. Scan the Gmail connected to Grok for Apple receipts, Stripe invoices, 3 Hong Kong bills, GitHub, PayPal, and **card alerts across Visa, Mastercard, American Express, UnionPay, JCB, Discover, and Diners Club**.

Banks do not have a direct login here. Card networks show up when the issuer emails this inbox (HSBC CNP alerts, Amex purchase notices, PayPal, and similar). Last-4 only — never a full PAN.

## What it does

- Monthly / yearly run-rate in HKD (or another display currency)
- Ledger with pause, cancel, mark charged
- Calendar of upcoming charges
- Inbox scan → add discoveries (recurring vs pay-as-you-go)
- Manual add with card network + last 4 (Visa, Mastercard, Amex, UnionPay, JCB, Discover, Diners Club)

## Networks

Visa · Mastercard · American Express · UnionPay · JCB · Discover · Diners Club

## How scan works

Traze reads the one Gmail attached to Grok. Aliases and CCs in that inbox are included. There is no Plaid, Visa/Mastercard network login, or Apple ID API — those charges appear when Apple, Stripe, PayPal, or the card issuer mail a receipt or transaction alert.

Full card numbers in email bodies are redacted before parse. Only last-4 is kept.

## Stack

TanStack Start, React 19, Tailwind v4, Zustand (`localStorage`). Gmail is read through Grok’s connector gate — never from the browser. Auth and the database stay off.

## License

MIT
