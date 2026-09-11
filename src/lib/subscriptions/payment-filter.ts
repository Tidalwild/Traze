/** Receipt vs marketing scorer. Inspired by Subflo (MIT) + inboxscan (MIT). */

export type PaymentScore = {
  score: number;
  isPayment: boolean;
  signals: string[];
};

const PROCESSORS =
  /no_reply@email\.apple\.com|payments-noreply@google\.com|googleplay-noreply|receipts\+acct_|@stripe\.com|service@paypal\.com|msbill@microsoft\.com|HSBC_CNP@|notification\.hsbc|billing3@three\.com\.hk/i;

const BILLING_FROM =
  /^(noreply|no-reply|billing|receipts?|invoice|payments?|orders?|account|auto-confirm)@/i;

const MARKETING_FROM =
  /newsletter@|marketing@|promo@|offers@|deals@|hello@|news@|digest@|@mailchimp\.|@sendgrid\.|@klaviyo\./i;

const PAYMENT_SUBJECT =
  /your (payment|receipt|invoice|order|purchase)|payment (of|for|received|successful|confirmed)|receipt (for|from)|invoice (for|from|#)|charged|subscription (renewed|receipt|confirmation)|renewal|billing (statement|receipt)|thank you for your (payment|purchase)|google play order|transaction (alert|notification)|debit alert/i;

const PROMO_SUBJECT =
  /try (our|the)|get started|\d+%\s*off|free trial|limited time|welcome to|thanks for (signing|joining)|introducing|newsletter|we miss you|save (up to|on)/i;

const PAYMENT_BODY =
  /(?:HK\$|US\$|HKD|USD|EUR|GBP|SGD|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?|ending (?:in |with )?\d{4}|\*{4}\s*\d{4}|transaction (?:id|number)|order (?:id|number|#)|has been (?:charged|debited)|amount (?:charged|paid|debited)|next (?:billing|renewal)/i;

const MARKETING_BODY =
  /subscribe now|start.{0,12}trial|buy now|shop now|unsubscribe from this (email|newsletter)|manage.{0,20}preferences/i;

export function scorePaymentLikelihood(
  subject: string,
  from: string,
  body: string,
): PaymentScore {
  let score = 0;
  const signals: string[] = [];

  if (PROCESSORS.test(from)) {
    score += 35;
    signals.push("processor");
  } else if (BILLING_FROM.test(from)) {
    score += 12;
    signals.push("billing-from");
  }
  if (MARKETING_FROM.test(from)) {
    score -= 30;
    signals.push("marketing-from");
  }
  if (PAYMENT_SUBJECT.test(subject)) {
    score += 22;
    signals.push("payment-subject");
  }
  if (PROMO_SUBJECT.test(subject)) {
    score -= 25;
    signals.push("promo-subject");
  }
  if (PAYMENT_BODY.test(body)) {
    score += 18;
    signals.push("payment-body");
  }
  if (MARKETING_BODY.test(body) && !PAYMENT_BODY.test(body)) {
    score -= 20;
    signals.push("marketing-body");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, isPayment: score >= 22, signals };
}
