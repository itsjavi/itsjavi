// Regenerates the project grid in README.md from the catalog published by itsjavi.com.
// Usage: node scripts/update-readme.mjs [catalog URL or local path]
// Only the block between the projects:start/end markers is rewritten; the rest of the README is hand-written.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = process.argv[2] ?? process.env.CATALOG_URL ?? "https://itsjavi.com/catalog.json";
const README = "README.md";
const ICONS = "assets/icons";
const COLUMNS = 4;
const START = "<!-- projects:start -->";
const END = "<!-- projects:end -->";

const isUrl = (value) => /^https?:\/\//.test(value);

async function load(location, as) {
  if (!isUrl(location)) return as === "json" ? JSON.parse(await readFile(location, "utf8")) : readFile(location);
  const res = await fetch(location, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${location}`);
  return as === "json" ? res.json() : Buffer.from(await res.arrayBuffer());
}

// A local catalog (e.g. dist/catalog.json) has production icon URLs; read the icons next to it instead.
function iconLocation(url) {
  if (isUrl(source)) return url;
  return new URL(new URL(url).pathname.slice(1), new URL(source, `file://${process.cwd()}/`)).pathname;
}

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function cell({ href, icon, name, tagline }) {
  return `<td align="center" valign="top" width="${100 / COLUMNS}%"><a href="${href}"><img src="${icon}" width="64" height="64" alt=""><br><b>${escape(name)}</b></a><br><sub>${escape(tagline)}</sub></td>`;
}

const catalog = await load(source, "json");
const tiles = catalog.projects
  .filter((p) => p.readme && p.icon)
  .map((p) => ({ id: p.id, href: p.homepage, iconUrl: p.icon, name: p.name, tagline: p.readmeTagline }));

if (catalog.libraries?.count > 0) {
  tiles.push({
    id: "libraries",
    href: catalog.libraries.url,
    iconUrl: catalog.libraries.icon,
    name: "Libraries",
    tagline: `${catalog.libraries.count} small packages`,
  });
}

await mkdir(ICONS, { recursive: true });
for (const tile of tiles) {
  tile.icon = `${ICONS}/${tile.id}.png`;
  await writeFile(tile.icon, await load(iconLocation(tile.iconUrl), "binary"));
}

const rows = [];
for (let i = 0; i < tiles.length; i += COLUMNS) {
  rows.push(`  <tr>\n${tiles.slice(i, i + COLUMNS).map((t) => `    ${cell(t)}`).join("\n")}\n  </tr>`);
}
const block = `${START}\n<table>\n${rows.join("\n")}\n</table>\n${END}`;

const readme = await readFile(README, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1) throw new Error(`README.md needs ${START} and ${END} markers`);
const next = readme.slice(0, start) + block + readme.slice(end + END.length);

if (next === readme) {
  console.log("README.md is up to date");
} else {
  await writeFile(README, next);
  console.log(`README.md updated with ${tiles.length} projects`);
}
