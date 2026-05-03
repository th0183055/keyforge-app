const spacedVin = "1V2 WR2CA9 RC560139";
const dashedVin = "1V2-WR2CA9-RC560139";
const cleanVin = "1V2WR2CA9RC560139";
const vinPattern = /[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\s-]{15,35}[A-HJ-NPR-Z0-9]/gi;

function validateVin(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

function normalizeVinCandidate(value) {
  const candidate = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return validateVin(candidate) ? candidate : "";
}

for (const input of [spacedVin, dashedVin, cleanVin, " 1v2 wr2ca9 rc560139 "]) {
  const normalized = normalizeVinCandidate(input);
  if (normalized !== cleanVin) {
    throw new Error(`Expected ${input} to normalize to ${cleanVin}, got ${normalized}`);
  }
}

for (const input of ["1V2 WR2CA9 RC56013", "1V2 WR2CAO RC560139", "1V2 WR2CAQ RC560139"]) {
  const normalized = normalizeVinCandidate(input);
  if (normalized) {
    throw new Error(`Expected ${input} to be rejected, got ${normalized}`);
  }
}

const extracted = [...`VIN from note: ${spacedVin}`.matchAll(vinPattern)]
  .map((match) => normalizeVinCandidate(match[0]))
  .filter(Boolean);

if (!extracted.includes(cleanVin)) {
  throw new Error(`Expected split VIN note to extract ${cleanVin}, got ${extracted.join(", ") || "none"}`);
}

console.log("VIN normalization checks passed.");
