// loadcsv.js
import pl from "nodejs-polars";

// Update these to point at real local CSVs.
// Polars-in-Python can read s3:// directly if configured. Node version might not,
// so easiest hack is: download the CSVs first and then point to local paths.
const scheduleFile = "./2024_01_20.csv";        // was s3://.../schedules/2024/01/20.csv
const emissionsFile = "./emissions.csv"; // was s3://.../emissions.csv

// read in csv files using polars (lazy)
const schedules = pl.scanCSV(scheduleFile, {
  inferSchemaLength: 10_000,
});

const emissions = pl.scanCSV(emissionsFile, {
  inferSchemaLength: 10_000,
});

// print the lazy frames (in Python you'd just print the LazyFrame,
// in JS we show the plan so you can see it's set up)
console.log("schedules (lazy):");
console.log(schedules.describePlan());

console.log("emissions (lazy):");
console.log(emissions.describePlan());

// filter for flights from London (LHR) to Mumbai (BOM)
const londonToMumbaiFlights = schedules.filter(
  pl
    .col("DEPAPT")
    .eq("LHR")
    .and(pl.col("ARRAPT").eq("BOM"))
);

// collect so we can actually view rows
console.log("London to Mumbai Flights:");
const lhrToBomDf = await londonToMumbaiFlights.collect();
console.log(lhrToBomDf.toString());

// Join with the emissions data on carrier and flight number, sorting on emissions
const joinedAndSorted = londonToMumbaiFlights
  .join(emissions, {
    how: "inner",
    leftOn: ["CARRIER", "FLTNO"],
    rightOn: ["CARRIER_CODE", "FLIGHT_NUMBER"],
  })
  .sort("ESTIMATED_CO2_TOTAL_TONNES")
  .select([
    pl.col("FLTNO"),
    pl.col("DEPAPT"),
    pl.col("ARRAPT"),
    pl.col("ELPTIM"),
    pl.col("ESTIMATED_CO2_TOTAL_TONNES"),
  ]);

const result = await joinedAndSorted.collect();

console.log("London to Mumbai Flights By Emissions:");
console.log(result.toString());

// column docs (same as Python comments):
// https://knowledge.oag.com/docs/wdf-record-layout
// https://knowledge.oag.com/docs/emissions-schedules-data-fields-explained