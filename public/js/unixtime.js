function toUnixTimes(dateStr) {
  // dateStr is like "2024-01-20 17:45:00.000"
  // Treat it as UTC.

  // Step 1: normalize to ISO 8601 style: "2024-01-20T17:45:00.000Z"
  const iso = dateStr.replace(' ', 'T') + 'Z';

  // Step 2: make a Date
  const d = new Date(iso);

  // Step 3: get ms + s since Unix epoch
  const unixMs = d.getTime();              // milliseconds since 1970-01-01 UTC
  const unixSec = Math.floor(unixMs / 1000); // seconds since 1970-01-01 UTC

  return { unixSec };
}

// example:
console.log(toUnixTimes("2024-01-20 17:45:00.000"));
// { unixMs: 1705772700000, unixSec: 1705772700 }