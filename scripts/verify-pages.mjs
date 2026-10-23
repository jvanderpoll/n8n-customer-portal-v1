import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A successful server build alone is insufficient: Pages needs real HTML files.
const output = "dist/client";
const base = "/n8n-customer-portal-v1/";
for (const route of ["", "subscriptions", "instances", "users", "contact"]) {
  const file = join(output, route, "index.html");
  assert.ok(existsSync(file), `Missing static page: ${file}`);
  const html = readFileSync(file, "utf8");
  assert.ok(html.includes("Customer Portal"), `Missing portal content: ${file}`);
  assert.ok(!html.includes("Welcome to your Lovable project"));
  for (const [, url] of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
    if (!url.startsWith("/")) continue;
    assert.ok(url.startsWith(base), `URL escapes the Pages folder: ${url}`);
    const path = join(output, url.slice(base.length));
    assert.ok(existsSync(path) || existsSync(join(path, "index.html")), `Missing file: ${url}`);
  }
}
console.log("Verified all 5 static portal pages and their local asset/link paths.");
