import type { PrototypeMode, Subscription } from "./portal-data";
import { date } from "./portal-format";

/** Lead date on subscription cards and overview rows. */
export function subscriptionLeadDate(
  sub: Subscription,
  status: "Running" | "Expired",
  mode: PrototypeMode,
): string {
  if (status !== "Running") return `Ended ${date(sub.end)}`;
  if (mode === "new") {
    return `Ends ${date(sub.renewal ?? sub.end)}`;
  }
  return sub.renewal ? `Renews ${date(sub.renewal)}` : `Ends ${date(sub.end)}`;
}

export function planEndMetricLabel(mode: PrototypeMode): string {
  return mode === "new" ? "Plan end date" : "Renewal date";
}

export function planEndSubtext(renewalIn: string, mode: PrototypeMode): string {
  if (renewalIn === "today") {
    return mode === "new" ? "Ends today" : "Renews today";
  }
  return `${renewalIn} left`;
}

export function quotaResetsLabel(mode: PrototypeMode): string {
  return mode === "new" ? "Quota resets when the plan renews" : "Quota resets at renewal";
}

export function contactRenewalTopicLabel(mode: PrototypeMode): string {
  return mode === "new" ? "Plan renewal" : "Renewal";
}

export function licenseKeyCopyLabel(copied: boolean, mode: PrototypeMode): string {
  if (mode === "new") return copied ? "License key copied" : "Copy license key";
  return copied ? "License ID copied" : "Copy license ID";
}

export function licenseReferenceLabel(mode: PrototypeMode): string {
  return mode === "new" ? "Key reference" : "License reference";
}

export function overviewRenewalColumnHeader(mode: PrototypeMode): string {
  return mode === "new" ? "Plan end" : "Renewal";
}
