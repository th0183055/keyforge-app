import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const inputPath = path.join(workspace, "calendar-import", "Tim Work_tim@wekeycars.com.ics");
const outputDir = path.join(workspace, "data");
const outputPath = path.join(outputDir, "calendar-analysis.json");

function unfoldIcs(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
}

function parseIcsDate(value) {
  if (!value) return null;
  const compact = value.replace("Z", "");
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  );
}

function cleanText(value = "") {
  return value
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseProperties(block) {
  const props = {};
  for (const line of block.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const rawKey = line.slice(0, index);
    const key = rawKey.split(";")[0].toUpperCase();
    const value = cleanText(line.slice(index + 1));
    if (!props[key]) props[key] = [];
    props[key].push(value);
  }
  return props;
}

function detectJobCode(summary) {
  const first = (summary.split(/\s+/)[0] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{1,4}$/.test(first)) return first;
  return "OTHER";
}

function detectPayment(text) {
  const match = text.match(/\[(cr|ch|cash|n30|no30|cc|venmo|zelle)\]/i);
  return match ? match[1].toLowerCase() : "unknown";
}

function extractMoney(text) {
  const amounts = [...text.matchAll(/\$ ?(\d+(?:\.\d{2})?)/g)].map((match) => Number(match[1]));
  return amounts.length ? Math.max(...amounts) : null;
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function tally(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = typeof key === "function" ? key(item) : item[key];
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
}

const ics = unfoldIcs(await readFile(inputPath, "utf8"));
const eventBlocks = [...ics.matchAll(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/g)].map((match) => match[1]);
const events = eventBlocks.map((block) => {
  const props = parseProperties(block);
  const summary = props.SUMMARY?.[0] || "Untitled";
  const description = props.DESCRIPTION?.[0] || "";
  const location = props.LOCATION?.[0] || "";
  const start = parseIcsDate(props.DTSTART?.[0]);
  const end = parseIcsDate(props.DTEND?.[0]);
  const text = `${summary}\n${description}`;

  return {
    summary,
    description,
    location,
    start: start?.toISOString() || null,
    end: end?.toISOString() || null,
    durationMinutes: minutesBetween(start, end),
    jobCode: detectJobCode(summary),
    payment: detectPayment(text),
    amount: extractMoney(text),
  };
});

const datedEvents = events.filter((event) => event.start);
const amounts = events.map((event) => event.amount).filter((amount) => amount !== null);
const durations = events.map((event) => event.durationMinutes).filter((duration) => duration !== null && duration <= 480);
const sortedDates = datedEvents.map((event) => event.start).sort();
const dealershipHints = ["auto", "chevrolet", "ford", "toyota", "honda", "kia", "nissan", "hyundai", "mazda", "jeep", "dodge"];
const likelyDealers = events.filter((event) =>
  dealershipHints.some((hint) => `${event.summary} ${event.location} ${event.description}`.toLowerCase().includes(hint)),
);

const analysis = {
  generatedAt: new Date().toISOString(),
  sourceFile: "Tim Work_tim@wekeycars.com.ics",
  totalEvents: events.length,
  datedEvents: datedEvents.length,
  dateRange: {
    start: sortedDates[0] || null,
    end: sortedDates.at(-1) || null,
  },
  revenueSignals: {
    eventsWithAmounts: amounts.length,
    visibleTotal: Number(amounts.reduce((sum, amount) => sum + amount, 0).toFixed(2)),
    averageVisibleTicket: amounts.length
      ? Number((amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length).toFixed(2))
      : 0,
  },
  timeSignals: {
    eventsWithDuration: durations.length,
    averageDurationMinutes: durations.length
      ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
      : 0,
  },
  jobCodes: tally(events, "jobCode").slice(0, 20),
  paymentMethods: tally(events, "payment").slice(0, 20),
  likelyDealerOrFleetEvents: likelyDealers.length,
  sampleSellableFeatures: [
    "Calendar import that turns shorthand appointments into structured jobs",
    "Job-code analytics for DK, AKL, PCP, AU, CU, RLP, and other locksmith workflows",
    "Price, payment, invoice, VIN, key-code, tool, and mileage extraction",
    "Repeat customer and dealer/fleet account detection",
    "AI closeout summaries and quote templates from completed job history",
  ],
};

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);
console.log(JSON.stringify(analysis, null, 2));
