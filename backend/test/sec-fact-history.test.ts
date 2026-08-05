// TS: 2026-08-05 09:13 ET

import assert from "node:assert/strict";
import test from "node:test";
import { parseSecFactHistory } from "../src/sec/fact-history.js";

test("SEC fact history preserves periods and prefers the latest amendment per context", () => {
  const parsed = parseSecFactHistory(
    {
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            label: "Revenue",
            description: "Revenue from contracts with customers.",
            units: {
              USD: [
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  val: 1_000,
                  accn: "0000000001-26-000001",
                  fy: 2025,
                  fp: "FY",
                  form: "10-K",
                  filed: "2026-02-01",
                },
                {
                  start: "2025-01-01",
                  end: "2025-12-31",
                  val: 1_050,
                  accn: "0000000001-26-000002",
                  fy: 2025,
                  fp: "FY",
                  form: "10-K/A",
                  filed: "2026-02-15",
                },
                {
                  start: "2026-01-01",
                  end: "2026-03-31",
                  val: 300,
                  accn: "0000000001-26-000003",
                  fy: 2026,
                  fp: "Q1",
                  form: "10-Q",
                  filed: "2026-05-01",
                },
              ],
            },
          },
          Revenues: {
            label: "Legacy Revenue",
            units: {
              USD: [
                {
                  start: "2024-01-01",
                  end: "2024-12-31",
                  val: 800,
                  accn: "0000000001-25-000001",
                  fy: 2024,
                  fp: "FY",
                  form: "10-K",
                  filed: "2025-02-01",
                },
              ],
            },
          },
        },
      },
    },
    1,
  );

  assert.equal(parsed.latest.revenue?.value, 300);
  assert.equal(parsed.history.revenue?.length, 3);
  const annual2025 = parsed.history.revenue?.find(
    (fact) => fact.periodEnd === "2025-12-31",
  );
  assert.equal(annual2025?.value, 1_050);
  assert.equal(annual2025?.form, "10-K/A");
  assert.match(annual2025?.sourceUrl ?? "", /000000000126000002/);
  assert.equal(
    parsed.history.revenue?.some((fact) => fact.periodEnd === "2024-12-31"),
    true,
  );
});

test("SEC fact history rejects malformed and non-periodic evidence", () => {
  const parsed = parseSecFactHistory(
    {
      facts: {
        "us-gaap": {
          Assets: {
            units: {
              USD: [
                {
                  end: "not-a-date",
                  val: 100,
                  accn: "bad",
                  form: "10-K",
                  filed: "2026-02-01",
                },
                {
                  end: "2025-12-31",
                  val: 100,
                  accn: "press-release",
                  form: "8-K",
                  filed: "2026-01-15",
                },
              ],
            },
          },
        },
      },
    },
    1,
  );

  assert.equal(parsed.latest.assets, undefined);
  assert.equal(parsed.history.assets, undefined);
});
