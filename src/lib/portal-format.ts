import { NOW_ISO } from "./portal-data";

export const fmt = (n: number) => n.toLocaleString("en-GB");
export const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function ago(iso: string) {
  const hours = Math.max(0, Math.round((Date.parse(NOW_ISO) - Date.parse(iso)) / 3600_000));
  if (hours < 1) return "under an hour ago";
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
export const timestamp = (iso: string) => `${date(iso)}, ${new Date(iso).toISOString().slice(11, 16)} UTC`;

function utcDateParts(iso: string) {
  const parsed = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth(), day: parsed.getUTCDate() };
}

/** Calendar time from `from` until `until`, such as "2 months and 29 days". */
export function monthsAndDaysUntil(until: string, from = NOW_ISO): string | null {
  const start = utcDateParts(from);
  const end = utcDateParts(until);
  if (!start || !end) return null;
  let years = end.year - start.year;
  let months = end.month - start.month;
  let days = end.day - start.day;
  if (years < 0 || (years === 0 && months < 0) || (years === 0 && months === 0 && days < 0)) return null;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(end.year, end.month, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts = [
    years ? `${years} year${years === 1 ? "" : "s"}` : "",
    months ? `${months} month${months === 1 ? "" : "s"}` : "",
    days ? `${days} day${days === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (!parts.length) return "today";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function portalHead(title: string, description: string) {
  const fullTitle = `${title} · n8n Admin Console v0`;
  return { meta: [
    { title: fullTitle }, { name: "description", content: description },
    { property: "og:title", content: fullTitle }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] };
}