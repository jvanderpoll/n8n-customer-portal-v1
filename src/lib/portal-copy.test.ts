import { describe, expect, it } from "vitest";
import {
  contactRenewalTopicLabel,
  licenseKeyCopyLabel,
  licenseReferenceLabel,
  planEndMetricLabel,
  planEndSubtext,
  quotaResetsLabel,
  subscriptionLeadDate,
} from "./portal-copy";
import type { Subscription } from "./portal-data";

const sub: Subscription = {
  id: "s1",
  name: "Enterprise",
  plan: "Self-hosted Enterprise",
  quota: 1,
  start: "2026-04-10",
  end: "2027-04-09",
  renewal: "2027-04-10",
  quotaResetsAtRenewal: true,
};

describe("prototype copy", () => {
  it("keeps Old renewal wording and switches New to plan-end wording", () => {
    expect(subscriptionLeadDate(sub, "Running", "old")).toMatch(/^Renews /);
    expect(subscriptionLeadDate(sub, "Running", "new")).toMatch(/^Ends /);
    expect(planEndMetricLabel("old")).toBe("Renewal date");
    expect(planEndMetricLabel("new")).toBe("Plan end date");
    expect(planEndSubtext("today", "old")).toBe("Renews today");
    expect(planEndSubtext("today", "new")).toBe("Ends today");
    expect(quotaResetsLabel("new")).toBe("Quota resets when the plan renews");
    expect(contactRenewalTopicLabel("new")).toBe("Plan renewal");
    expect(licenseKeyCopyLabel(false, "new")).toBe("Copy license key");
    expect(licenseReferenceLabel("new")).toBe("Key reference");
  });
});
