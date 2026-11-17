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

export function contactRenewalTopicLabel(_mode: PrototypeMode): string {
  return "Plan";
}

export function licenseKeyCopyLabel(copied: boolean, _mode: PrototypeMode): string {
  return copied ? "License key copied" : "Copy license key";
}

export function licenseReferenceLabel(_mode: PrototypeMode): string {
  return "License key";
}

export function overviewRenewalColumnHeader(mode: PrototypeMode): string {
  return mode === "new" ? "Plan end" : "Renewal";
}
