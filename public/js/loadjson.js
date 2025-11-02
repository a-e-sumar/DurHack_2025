const { json } = require("body-parser");
const { allowedNodeEnvironmentFlags } = require("process");
const { start } = require("repl");

function loadJSON() {
  const raw = document.getElementById("jsonInput").value;

  try {
    const parsed = JSON.parse(raw); // <-- converts text to usable JS object
    console.log("Valid JSON:", parsed);
    return parsed;
  } catch (err) {
    console.error("Invalid JSON!", err);
    alert("Invalid JSON! Please correct the input.");
    return null;
  }
}

async function JSONButton() {
    const data = loadJSON();
    if (!data) {
        return;
    }
    let attendeesOut;
    let availability_windowOut;
    let event_durationOut;
    let json_commentsOut;
    try {
      const attendees = data.attendees;
      attendeesOut = Object.entries(attendees)        // → [ ['a',1], ['b',2], ['c',3] ]
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

      const availability_window = data.availability_window;
      availability_windowOut = Object.entries(availability_window)        // → [ ['a',1], ['b',2], ['c',3] ]
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

      const event_duration = data.event_duration;
      event_durationOut = Object.entries(event_duration)        // → [ ['a',1], ['b',2], ['c',3] ]
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    } catch (err) {
      console.error("Error processing JSON data:", err);
      alert("Error processing JSON data. Please check the console for details.");
    }

      const json_comments = data._comment;
      if (json_comments) {
        json_commentsOut = json_comments;
      }
      const attendeesElement = document.getElementById("attendees");
      const availability_windowElement = document.getElementById("availability_window");
      const event_durationElement = document.getElementById("event_duration");
      const json_commentsElement = document.getElementById("json_comments");
      const processing_statusElement = document.getElementById("processing_status");
      if (data) {
          attendeesElement.textContent = attendeesOut;
          availability_windowElement.textContent = availability_windowOut;
          event_durationElement.textContent = event_durationOut;
          processing_statusElement.textContent = "Please wait...";
      } else {
          attendeesElement.textContent = "No valid data loaded.";
          availability_windowElement.textContent = "";
          event_durationElement.textContent = "";
      }

      if (json_comments) {
        json_commentsElement.textContent = json_commentsOut;
      } else {
        json_commentsElement.textContent = "No comments found";
      }

      if (availability_window) {
        const datesToQuery = buildDateListFromWindow(
          data.availability_window.start,
          data.availability_window.end
        );
        console.log("Dates to query:", datesToQuery);
      
      let allFlights = [];
      let distilledFlights = [];
      for (const { year, month, day } of datesToQuery) {
        const legs = await filterFlights("AllAirports", "AllAirports", year, month, day); // legs is an array
        allFlights.push(...legs); // <- spread pushes all elements, not the array itself
      } 

      distilledFlights = distillFlights(allFlights);
      console.log("Distilled flights:", distilledFlights);

      let allowedDepAirports = [];

      if (attendees) {

        const CITY_TO_AIRPORT = {
          "Mumbai":    "BOM",
          "Shanghai":  "PVG",
          "Hong Kong": "HKG",
          "Singapore": "SIN",
          "Sydney":    "SYD",
          "Paris":     "CDG",
          "London":    "LHR",
          "Dubai":     "DXB",
          "Zurich":    "ZRH",
          "Geneva":    "GVA",
          "Aarhus":    "AAR",
          "Wroclaw":   "WRO",
          "Budapest":  "BUD"
        };

        for (const [cityName, headcount] of Object.entries(data.attendees)) {
          allowedDepAirports.push(CITY_TO_AIRPORT[cityName]);
        }
        const allowedDepFlights = allowDepFlightsOnly(distilledFlights, allowedDepAirports);
        console.log("Allowed departure flights:", allowedDepFlights);

        const arrivalsCount = allowedDepFlights.reduce((acc, flight) => {
          const arr = flight.ARRAPT; // destination airport code

          if (!acc[arr]) {
            acc[arr] = 0;
          }

          acc[arr] += 1;
          return acc;
        }, {});
        console.log("Arrivals count:", arrivalsCount);

        let co2Array = [];
        let totalCo2 = 0;

        for (const [airport, count] of Object.entries(arrivalsCount)) {
          if (count === allowedDepAirports.length) {
            console.log(`All attendees can arrive at ${airport}`);
            totalCo2 = 0;
            for (const [cityName, headcount] of Object.entries(data.attendees)) {
              let match = allowedDepFlights.filter(flight => flight.ARRAPT === airport && flight.DEPAPT === CITY_TO_AIRPORT[cityName]);
              totalCo2 += (headcount * match[0].ESTIMATED_CO2_TOTAL_TONNES);
            }
            co2Array.push({ airport, totalCo2 });
          }
        }
        const co2Sorted = co2Array.slice().sort((a, b) => a.totalCo2 - b.totalCo2);
        const lowCarbonAnswer = co2Sorted[0];

      const results_element = document.getElementById("results");
      const bestLocation_element = document.getElementById("bestLocation");
      const co2_element = document.getElementById("co2Result");
      processing_statusElement.textContent = "Done!";
      results_element.classList.remove("hidden");
      bestLocation_element.textContent = lowCarbonAnswer.airport;
      co2_element.textContent = lowCarbonAnswer.totalCo2.toFixed(2) + " tonnes CO2";
    }
  }
}

function buildDateListFromWindow(startISO, endISO) {
  const windowStartMs = Date.parse(startISO);
  const windowEndMs   = Date.parse(endISO);

  const DAY_MS = 24 * 60 * 60 * 1000;

  // add buffer of 1 day before/after
  const startBuffered = windowStartMs - DAY_MS;
  const endBuffered   = windowEndMs   + DAY_MS;

  const dates = [];

  for (
    let t = startOfDayUtc(startBuffered);
    t <= startOfDayUtc(endBuffered);
    t += DAY_MS
  ) {
    dates.push( ymdFromEpochMs(t) );
  }

  return dates;
}

async function loadFlights(depapt_in, arrapt_in, year_in, month_in, day_in) {
  const params = new URLSearchParams({
    depapt: depapt_in,
    arrapt: arrapt_in,
    year: year_in,
    month: month_in,
    day: day_in,
  });
  console.log(params)

  const res = await fetch("/emissions?" + params.toString());
  const data = await res.json();

  return JSON.stringify(data, null, 2);
}

async function filterFlights(depapt_in, arrapt_in, year_in, month_in, day_in) {
  flights = await loadFlights(depapt_in, arrapt_in, year_in, month_in, day_in)
  flightsJson = JSON.parse(flights);
  const filtered = flightsJson
  .filter(row => row.ESTIMATED_CO2_TOTAL_TONNES != null && row.ESTIMATED_CO2_TOTAL_TONNES !== "")
  .map(row => ({
    FLTNO: row.FLTNO,
    DEPAPT: row.DEPAPT,
    ARRAPT: row.ARRAPT,
    ELPTIM: row.ELPTIM,
    SCHEDULED_DEPARTURE_UNIXTIME: toUnixTimes(row.SCHEDULED_DEPARTURE_DATE_TIME_UTC),
    SCHEDULED_ARRIVAL_UNIXTIME: toUnixTimes(row.SCHEDULED_ARRIVAL_DATE_TIME_UTC),
    ESTIMATED_CO2_TOTAL_TONNES: row.ESTIMATED_CO2_TOTAL_TONNES
  }));
  return filtered;
}

// snap a timestamp (ms) to midnight UTC of that same day
function startOfDayUtc(msUtc) {
  const d = new Date(msUtc);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

// convert timestamp -> { year, month, day } in UTC
function ymdFromEpochMs(msUtc) {
  const d = new Date(msUtc);
  return {
    year:  d.getUTCFullYear(),
    month: d.getUTCMonth() + 1, // JS months are 0-based
    day:   d.getUTCDate()
  };
}

function toUnixTimes(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    return null;
  }

  let isoGuess = dateStr.trim();

  if (isoGuess.includes(" ") && !isoGuess.includes("T")) {
    isoGuess = isoGuess.replace(" ", "T");
  }

  const hasExplicitTZ =
    /[zZ]$/.test(isoGuess) || /[\+\-]\d\d:\d\d$/.test(isoGuess);

  if (!hasExplicitTZ) {
    isoGuess = isoGuess + "Z";
  }

  const ms = new Date(isoGuess).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function distillFlights(flightsArr) {
  const bestByRoute = new Map();

  for (const f of flightsArr) {
    const routeKey = `${f.DEPAPT}->${f.ARRAPT}`;

    const thisCO2 = Number(f.ESTIMATED_CO2_TOTAL_TONNES);

    if (!bestByRoute.has(routeKey)) {
      // first time we see this route
      bestByRoute.set(routeKey, f);
    } else {
      const currentBest = bestByRoute.get(routeKey);
      const currentCO2 = Number(currentBest.ESTIMATED_CO2_TOTAL_TONNES);

      if (thisCO2 < currentCO2) {
        // found a cleaner flight for the same route
        bestByRoute.set(routeKey, f);
      }
    }
  }

  // return just the "winners"
  return Array.from(bestByRoute.values());
}

function allowDepFlightsOnly(flightsArr, allowedDepAirports) {
  const allowedDepFlights = flightsArr.filter(flight =>
  allowedDepAirports.includes(flight.DEPAPT)
  );
  return allowedDepFlights;
}