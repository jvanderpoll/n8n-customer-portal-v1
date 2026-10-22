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

export function portalHead(title: string, description: string) {
  const fullTitle = `${title} · n8n Customer Portal v0`;
  return { meta: [
    { title: fullTitle }, { name: "description", content: description },
    { property: "og:title", content: fullTitle }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] };
}