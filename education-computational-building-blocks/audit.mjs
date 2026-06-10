// Internal editorial audit for the atlas dataset.
// Usage: node audit.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"), "utf8");
const m = html.match(/<script id="shared-code">([\s\S]*?)<\/script>/);
if (!m) {
  console.error("shared-code block not found");
  process.exit(1);
}

const ELEMENTS = new Function(`${m[1]}; return ELEMENTS;`)();
const symbols = new Set(ELEMENTS.map((e) => e.symbol));

const PRIMARY_PATTERNS = [
  /arxiv\.org/i,
  /doi\.org/i,
  /rfc-editor\.org/i,
  /nist\.gov/i,
  /ietf\.org/i,
  /w3\.org/i,
  /tc39\.es/i,
  /kernel\.org/i,
  /github\.com\/[^/]+\/[^/]+/i,
  /gitlab\.com\/[^/]+\/[^/]+/i,
  /bitcoin\.org\/bitcoin\.pdf/i,
  /lamport/i,
  /annals\.math\.princeton\.edu/i,
  /projecteuclid\.org/i,
  /acm\.org/i,
  /ieee\.org/i,
  /usenix\.org/i,
  /sigmod/i,
  /vldb/i,
  /jmlr/i,
  /openreview\.net/i,
  /eprint\.iacr\.org/i,
  /stanford\.edu\/~boyd/i,
  /raft\.github\.io/i,
  /reactive-streams\.org/i,
  /cpython/i,
  /docs\.dolt/i,
  /pmg\.csail\.mit\.edu/i,
  /pdos\.csail\.mit\.edu/i,
  /research\.google\/pubs/i,
  /static\.googleusercontent\.com/i,
  /cr\.yp\.to/i,
  /hal\.inria\.fr/i,
  /cs\.utexas\.edu\/~EWD/i,
];

const STRONG_SECONDARY_PATTERNS = [
  /cp-algorithms\.com/i,
  /roaringbitmap\.org/i,
  /ethereum\.org/i,
  /cloudflare\.com/i,
  /microsoft\.com/i,
  /ibm\.com/i,
  /openai\.com/i,
  /postgresql\.org/i,
  /sqlite\.org/i,
  /docs\./i,
  /textbook|monograph|survey|handbook/i,
];

function sourceTier(source) {
  const text = `${source.label || ""} ${source.url || ""}`;
  if (PRIMARY_PATTERNS.some((re) => re.test(text))) return "primary";
  if (STRONG_SECONDARY_PATTERNS.some((re) => re.test(text))) return "secondary-strong";
  return "secondary-basic";
}

function entryTier(entry) {
  const tiers = (entry.sources || []).map(sourceTier);
  if (tiers.includes("primary")) return "primary";
  if (tiers.includes("secondary-strong")) return "secondary-strong";
  return "secondary-basic";
}

function requiresPrimary(entry) {
  return ["modern", "research", "speculative"].includes(entry.maturity)
    || ["crypto", "systems", "ml"].includes(entry.category);
}

function countBy(items, fn) {
  return items.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

const linkProblems = [];
for (const entry of ELEMENTS) {
  for (const field of ["related", "prerequisites", "unlocks"]) {
    for (const symbol of entry[field] || []) {
      if (!symbols.has(symbol)) linkProblems.push(`${entry.symbol}.${field} -> ${symbol}`);
    }
  }
}

const tiers = ELEMENTS.map((entry) => ({ entry, tier: entryTier(entry) }));
const weakPriority = tiers
  .filter(({ entry, tier }) => requiresPrimary(entry) && tier === "secondary-basic")
  .map(({ entry }) => `${entry.symbol}\t${entry.name}\t${entry.category}\t${entry.maturity}\t${(entry.sources || []).map((s) => s.label).join(" | ")}`);

const wikipediaOnly = ELEMENTS
  .filter((entry) => (entry.sources || []).length > 0 && entry.sources.every((s) => /wikipedia\.org/i.test(s.url || "")))
  .map((entry) => `${entry.symbol}\t${entry.name}\t${entry.category}\t${entry.maturity}`);

const top50 = ELEMENTS
  .slice()
  .sort((a, b) => {
    const aLandmark = a.landmark ? 1 : 0;
    const bLandmark = b.landmark ? 1 : 0;
    if (aLandmark !== bLandmark) return bLandmark - aLandmark;
    const role = { foundation: 0, workhorse: 1, "case-study": 2, frontier: 3, toy: 4 };
    if ((role[a.pedagogicalRole] ?? 9) !== (role[b.pedagogicalRole] ?? 9)) {
      return (role[a.pedagogicalRole] ?? 9) - (role[b.pedagogicalRole] ?? 9);
    }
    return (a.rank ?? 9999) - (b.rank ?? 9999);
  })
  .slice(0, 50)
  .map((entry, i) => `${String(i + 1).padStart(2, "0")}. ${entry.symbol}\t${entry.name}\t${entry.category}\t${entry.pedagogicalRole}${entry.landmark ? "\tlandmark" : ""}`);

console.log("Atlas audit");
console.log("===========");
console.log(`Entries: ${ELEMENTS.length}`);
console.log(`Review status: ${JSON.stringify(countBy(ELEMENTS, (e) => e.reviewStatus))}`);
console.log(`Source tiers: ${JSON.stringify(countBy(tiers, (x) => x.tier))}`);
const tierCounts = countBy(tiers, (x) => x.tier);
console.log(`Primary/semi-primary: ${(tierCounts.primary || 0) + (tierCounts["secondary-strong"] || 0)}`);
console.log(`Wikipedia-only: ${wikipediaOnly.length}`);
console.log(`Priority weak sources: ${weakPriority.length}`);
console.log(`Symbol link problems: ${linkProblems.length}`);
console.log("");

if (linkProblems.length) {
  console.log("Symbol link problems");
  console.log("--------------------");
  console.log(linkProblems.join("\n"));
  console.log("");
}

if (weakPriority.length) {
  console.log("Priority weak sources");
  console.log("---------------------");
  console.log(weakPriority.join("\n"));
  console.log("");
}

if (wikipediaOnly.length) {
  console.log("Wikipedia-only entries");
  console.log("----------------------");
  console.log(wikipediaOnly.join("\n"));
  console.log("");
}

console.log("Top 50 quality-pass candidates");
console.log("------------------------------");
console.log(top50.join("\n"));
