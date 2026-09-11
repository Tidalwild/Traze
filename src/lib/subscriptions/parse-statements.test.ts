import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStatementCsv, statementToDiscoveries } from "./parse-statements.ts";

describe("statement CSV", () => {
  it("reads a Date, Description, Amount export and groups Netflix", () => {
    const csv = `Date,Description,Amount
08/01/2026,NETFLIX.COM,98.00
08/02/2026,FOODPANDA HK,120.50
09/01/2026,NETFLIX.COM,98.00
09/03/2026,SPOTIFY P0ABC,58.00
`;
    const rows = parseStatementCsv(csv, "HKD");
    assert.equal(rows.length, 4);
    const found = statementToDiscoveries(rows, {
      id: "c1",
      network: "visa",
      last4: "4242",
      nickname: "HSBC",
    }, new Date("2026-09-11T00:00:00Z"));
    const netflix = found.find((d) => /netflix/i.test(d.name));
    assert.ok(netflix);
    assert.equal(netflix?.paymentVia.last4, "4242");
    assert.ok(!found.some((d) => /foodpanda/i.test(d.name)));
  });
});
