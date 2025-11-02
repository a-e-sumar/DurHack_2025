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
        processing_statusElement.textContent = "Selecting flight data...";
        console.log("Dates to query:", datesToQuery);
      
      let allFlights = [];
      let distilledFlights = [];
      for (const { year, month, day } of datesToQuery) {
        const legs = await filterFlights("AllAirports", "AllAirports", year, month, day); // legs is an array
        allFlights = allFlights.concat(legs);
        processing_statusElement.textContent = "Gathering outbound flight data...";
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
        processing_statusElement.textContent = "Parsing attendee information...";
        for (const [cityName, headcount] of Object.entries(data.attendees)) {
          allowedDepAirports.push(CITY_TO_AIRPORT[cityName]);
        }
        const allowedDepFlights = allowDepFlightsOnly(distilledFlights, allowedDepAirports);
        console.log("Allowed departure flights:", allowedDepFlights);
        processing_statusElement.textContent = "Selecting outbound flights...";
        const arrivalsCount = allowedDepFlights.reduce((acc, flight) => {
          const arr = flight.ARRAPT; // destination airport code

          if (!acc[arr]) {
            acc[arr] = 0;
          }

          acc[arr] += 1;
          return acc;
        }, {});
        console.log("Arrivals count:", arrivalsCount);


        let outboundDestinations = [];

        processing_statusElement.textContent = "Finding outbound flight candidates...";
        for (const [airport, count] of Object.entries(arrivalsCount)) {
          if (count === allowedDepAirports.length) {
            console.log(`All attendees can arrive at ${airport}`);
            outboundDestinations.push(airport);
          }
        }
        processing_statusElement.textContent = "Selecting inbound flights...";
        const allReturnFlights = allowArrFlightsOnly(allFlights, allowedDepAirports);
        let returnFlights = [];
        for (const returnFlight of allReturnFlights) {
          let match = allowedDepFlights.filter(flight => flight.ARRAPT === returnFlight.DEPAPT && flight.DEPAPT === returnFlight.ARRAPT);
          if (match.length === 0) {
            continue;
          }
          if (match && (match[0].SCHEDULED_ARRIVAL_UNIXTIME + (data.event_duration.hours * 3600 * 1000) + (data.event_duration.days * 24 * 3600 * 1000) < returnFlight.SCHEDULED_ARRIVAL_UNIXTIME)) {
            returnFlights.push(returnFlight);
          }
        }

        processing_statusElement.textContent = "Finding inbound flight candidates...";
        console.log("Allowed return flights:", returnFlights);
        let inboundDestinations = [];
        inboundDestinations = findSuperHubs(returnFlights, allowedDepAirports);
        console.log("Airports that can reach ALL attendee origins:", inboundDestinations);

        let validReturnFlights = allowDepFlightsOnly(returnFlights, inboundDestinations);
        console.log("Valid return flights:", validReturnFlights);

        let distilledReturnFlights = distillFlights(validReturnFlights);
        console.log("Distilled return flights:", distilledReturnFlights);

        validMeetings = intersection(outboundDestinations, inboundDestinations);

        if (validMeetings.length === 0) {
          alert("No meeting locations found that all attendees can reach within the given time window.");
          processing_statusElement.textContent = "No meeting locations found.";
          return;
        } else {
          console.log("Possible meeting locations:", validMeetings);
        }

        finalOutboundFlights = allowArrFlightsOnly(allowedDepFlights, validMeetings);
        finalInboundFlights = allowDepFlightsOnly(distilledReturnFlights, validMeetings);

        let co2Array = [];
        let fairnessArrayOutbound = [];
        let fairnessArrayInbound = [];
        let fairnessOutbound = 0;
        let fairnessInbound = 0;
        let totalCo2Outbound = 0;
        let totalCo2Inbound = 0;
        let arrivalOutboundMax = "";
        let departureInboundMax = "";
        let arrivalOutboundMin = "";
        let departureInboundMin = "";
        let averageTravel = 0;
        let medianTravel = 0;
        let maxTravel = 0;
        let minTravel = 0;
        let attendeeTravel = [];
        let counter = 0;
        let travelSubtotal = 0;
        let cities = [];

        for (const airport of validMeetings) {
          totalCo2 = 0;
          totalCo2Inbound = 0;
          totalCo2Outbound = 0;
          fairnessArrayOutbound = [];
          fairnessArrayInbound = [];
          fairnessOutbound = 0;
          fairnessInbound = 0;
          arrivalArrayOutbound = [];
          departureArrayInbound = [];
          arrivalOutboundMax = "";
          departureInboundMax = "";
          arrivalOutboundMin = "";
          departureInboundMin = "";
          averageTravel = 0;
          medianTravel = 0;
          maxTravel = 0;
          minTravel = 0;
          attendeeTravel = [];
          counter = 0;
          travelSubtotal = 0;
          cities = [];

          for (const [cityName, count] of Object.entries(data.attendees)) {
            let match = finalOutboundFlights.filter(flight => flight.ARRAPT === airport && flight.DEPAPT === CITY_TO_AIRPORT[cityName]);
            totalCo2Outbound += (match[0].ESTIMATED_CO2_TOTAL_TONNES);
            travelSubtotal += match[0].ELPTIM;
            averageTravel += (match[0].ELPTIM * count);
            counter += count;
            fairnessArrayOutbound.push(match[0].ELPTIM);
            arrivalArrayOutbound.push(match[0].SCHEDULED_ARRIVAL_UNIXTIME);

            match = finalInboundFlights.filter(flight => flight.DEPAPT === airport && flight.ARRAPT === CITY_TO_AIRPORT[cityName]);
            totalCo2Inbound += (match[0].ESTIMATED_CO2_TOTAL_TONNES);
            travelSubtotal += match[0].ELPTIM;
            averageTravel += (match[0].ELPTIM * count);
            fairnessArrayInbound.push(match[0].ELPTIM);
            departureArrayInbound.push(match[0].SCHEDULED_DEPARTURE_UNIXTIME);
            for (let i = 0; i < count; i++) {
              attendeeTravel.push(travelSubtotal);
              cities.push(cityName);
            }
            travelSubtotal = 0;
          }
          averageTravel /= counter;
          attendeeTravel.sort((a, b) => a - b);
          maxTravel = attendeeTravel[attendeeTravel.length - 1];
          minTravel = attendeeTravel[0];
          medianTravel = (attendeeTravel.length % 2 === 0) ?
            (attendeeTravel[attendeeTravel.length / 2 - 1] + attendeeTravel[attendeeTravel.length / 2]) / 2 :
            attendeeTravel[Math.floor(attendeeTravel.length / 2)];
          fairnessOutbound = Math.max(...fairnessArrayOutbound) - Math.min(...fairnessArrayOutbound);
          fairnessInbound = Math.max(...fairnessArrayInbound) - Math.min(...fairnessArrayInbound);
          arrivalOutboundMax = unixMsToIso(Math.max(...arrivalArrayOutbound));
          departureInboundMax = unixMsToIso(Math.max(...departureArrayInbound));
          arrivalOutboundMin = unixMsToIso(Math.min(...arrivalArrayOutbound));
          departureInboundMin = unixMsToIso(Math.min(...departureArrayInbound));
          co2Array.push({airport, totalCo2Outbound, totalCo2Inbound, fairnessOutbound, fairnessInbound, arrivalOutboundMax, departureInboundMax, arrivalOutboundMin, departureInboundMin, averageTravel, medianTravel, maxTravel, minTravel, attendeeTravel, cities});
        }

        co2Array.sort((a, b) => (a.totalCo2Outbound + a.totalCo2Inbound) - (b.totalCo2Outbound + b.totalCo2Inbound));
        console.log("CO2 array sorted:", co2Array);
        
        const lowCarbonAnswer = co2Array[0];

        let attendee_travel_hours = {};
        
        for (let i = 0; i < cities.length; i++) {
          const city = lowCarbonAnswer.cities[i];
          const hours = lowCarbonAnswer.attendeeTravel[i];
          attendee_travel_hours[city] = (hours / 60).toFixed(2);
        }

        let arrayLC = {
          event_location: lowCarbonAnswer.airport,
          event_dates: {
            start: lowCarbonAnswer.arrivalOutboundMax, 
            end: lowCarbonAnswer.departureInboundMin
          },
          event_span: {
            start: lowCarbonAnswer.arrivalOutboundMin, 
            end: lowCarbonAnswer.departureInboundMax
          },
          total_co2: lowCarbonAnswer.totalCo2Outbound + lowCarbonAnswer.totalCo2Inbound,
          average_travel_hours: (lowCarbonAnswer.averageTravel / 60).toFixed(2),
          median_travel_hours: (lowCarbonAnswer.medianTravel / 60).toFixed(2),
          max_travel_hours: (lowCarbonAnswer.maxTravel / 60).toFixed(2),
          min_travel_hours: (lowCarbonAnswer.minTravel / 60).toFixed(2),
          attendee_travel_hours: attendee_travel_hours

        };

        console.log(JSON.stringify(arrayLC, null, 2));


      const results_section_element = document.getElementById("results");
      results_section_element.classList.remove("hidden");

      const results_lc_element = document.getElementById("results_lowcarbon");
      results_lc_element.classList.remove("hidden");
      const bestLocation_lc_element = document.getElementById("bestLocationLC");
      const co2_lc_element = document.getElementById("co2ResultLC");
      const fairness_lc_element = document.getElementById("fairnessResultLC");
      processing_statusElement.textContent = "Done!";
      bestLocation_lc_element.textContent = lowCarbonAnswer.airport;
      co2_lc_element.textContent = `${(lowCarbonAnswer.totalCo2Outbound.toFixed(4) * 1000)} kg outbound, ${(lowCarbonAnswer.totalCo2Inbound.toFixed(4) * 1000)} kg inbound`;
      fairness_lc_element.textContent = `${(lowCarbonAnswer.fairnessOutbound / 60).toFixed(2)} hrs outbound, ${(lowCarbonAnswer.fairnessInbound / 60).toFixed(2)} hrs inbound`;
      const json_lc_element = document.getElementById("jsonLC");
      json_lc_element.textContent = JSON.stringify(arrayLC, null, 2);


        co2Array.sort((a, b) => (a.fairnessOutbound + a.fairnessInbound) - (b.fairnessOutbound + b.fairnessInbound));
        console.log("Fairness array sorted:", co2Array);

        const fairnessAnswer = co2Array[0];

        attendee_travel_hours = {};
        
        for (let i = 0; i < cities.length; i++) {
          const city = fairnessAnswer.cities[i];
          const hours = fairnessAnswer.attendeeTravel[i];
          attendee_travel_hours[city] = (hours / 60).toFixed(2);
        }

        let arrayFN = {
          event_location: fairnessAnswer.airport,
          event_dates: {
            start: fairnessAnswer.arrivalOutboundMax, 
            end: fairnessAnswer.departureInboundMin
          },
          event_span: {
            start: fairnessAnswer.arrivalOutboundMin, 
            end: fairnessAnswer.departureInboundMax
          },
          total_co2: fairnessAnswer.totalCo2Outbound + fairnessAnswer.totalCo2Inbound,
          average_travel_hours: (fairnessAnswer.averageTravel / 60).toFixed(2),
          median_travel_hours: (fairnessAnswer.medianTravel / 60).toFixed(2),
          max_travel_hours: (fairnessAnswer.maxTravel / 60).toFixed(2),
          min_travel_hours: (fairnessAnswer.minTravel / 60).toFixed(2),
          attendee_travel_hours: attendee_travel_hours

        };

        console.log(JSON.stringify(arrayFN, null, 2));

        let balancedRating = [];

        for (const { airport, totalCo2Outbound, totalCo2Inbound, fairnessOutbound, fairnessInbound } of co2Array) {
          const co2OutMul = 25 * lowCarbonAnswer.totalCo2Outbound
          const co2InMul = 25 * lowCarbonAnswer.totalCo2Inbound
          const fairnessOutMul = 25 * fairnessAnswer.fairnessOutbound
          const fairnessInMul = 25 * fairnessAnswer.fairnessInbound
          const rating = ( (co2OutMul / totalCo2Outbound) + (co2InMul / totalCo2Inbound) + (fairnessOutMul / fairnessOutbound) + (fairnessInMul / fairnessInbound) );
          balancedRating.push({ airport, rating });
        }

        balancedRating.sort((a, b) => b.rating - a.rating);
        console.log("Balanced rating sorted:", balancedRating);

        const balancedAnswer = balancedRating[0];

        let balancedCo2 = co2Array.find(({ airport }) => airport === balancedRating[0].airport);

        attendee_travel_hours = {};
        
        for (let i = 0; i < cities.length; i++) {
          const city = balancedCo2.cities[i];
          const hours = balancedCo2.attendeeTravel[i];
          attendee_travel_hours[city] = (hours / 60).toFixed(2);
        }

        let arrayBA = {
          event_location: balancedCo2.airport,
          event_dates: {
            start: balancedCo2.arrivalOutboundMax, 
            end: balancedCo2.departureInboundMin
          },
          event_span: {
            start: balancedCo2.arrivalOutboundMin, 
            end: balancedCo2.departureInboundMax
          },
          total_co2: balancedCo2.totalCo2Outbound + balancedCo2.totalCo2Inbound,
          average_travel_hours: (balancedCo2.averageTravel / 60).toFixed(2),
          median_travel_hours: (balancedCo2.medianTravel / 60).toFixed(2),
          max_travel_hours: (balancedCo2.maxTravel / 60).toFixed(2),
          min_travel_hours: (balancedCo2.minTravel / 60).toFixed(2),
          attendee_travel_hours: attendee_travel_hours

        };

        console.log(JSON.stringify(arrayBA, null, 2));

      const results_ba_element = document.getElementById("results_balanced");
      results_ba_element.classList.remove("hidden"); 
      const bestLocation_ba_element = document.getElementById("bestLocationBA");
      const co2_ba_element = document.getElementById("co2ResultBA");
      const fairness_ba_element = document.getElementById("fairnessResultBA");
      processing_statusElement.textContent = "Done!";
      bestLocation_ba_element.textContent = balancedAnswer.airport;
      co2_ba_element.textContent = `${(balancedCo2.totalCo2Outbound.toFixed(4) * 1000)} kg outbound, ${(balancedCo2.totalCo2Inbound.toFixed(4) * 1000)} kg inbound`;
      fairness_ba_element.textContent = `${(balancedCo2.fairnessOutbound / 60).toFixed(2)} hrs outbound, ${(balancedCo2.fairnessInbound / 60).toFixed(2)} hrs inbound`;
      const json_ba_element = document.getElementById("jsonBA");
      json_ba_element.textContent = JSON.stringify(arrayBA, null, 2);


      const results_fn_element = document.getElementById("results_fairness");
      results_fn_element.classList.remove("hidden"); 
      const bestLocation_fn_element = document.getElementById("bestLocationFN");
      const co2_fn_element = document.getElementById("co2ResultFN");
      const fairness_fn_element = document.getElementById("fairnessResultFN");
      processing_statusElement.textContent = "Done!";
      bestLocation_fn_element.textContent = fairnessAnswer.airport;
      co2_fn_element.textContent = `${(fairnessAnswer.totalCo2Outbound.toFixed(4) * 1000)} kg outbound, ${(fairnessAnswer.totalCo2Inbound.toFixed(4) * 1000)} kg inbound`;
      fairness_fn_element.textContent = `${(fairnessAnswer.fairnessOutbound / 60).toFixed(2)} hrs outbound, ${(fairnessAnswer.fairnessInbound / 60).toFixed(2)} hrs inbound`;
      const json_fn_element = document.getElementById("jsonFN");
      json_fn_element.textContent = JSON.stringify(arrayFN, null, 2);
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
  const url = "/emissions?" + params.toString();

  try {
    const res = await fetch(url);

    // If it's an HTTP error (like 500, 404, etc), skip this date
    if (!res.ok) {
      console.warn("Skipping date due to HTTP error:", url, res.status);
      return [];
    }

    // Try to get the body text first, then decide how to parse it.
    const rawText = await res.text();

    if (!rawText || rawText.trim() === "") {
      console.warn("Empty body from server, treating as no flights:", url);
      return [];
    }

    // Now try to parse as JSON.
    try {
      const data = JSON.parse(rawText);

      if (!Array.isArray(data)) {
        console.warn("Server returned non-array JSON, treating as no flights:", url, data);
        return [];
      }

      return JSON.stringify(data, null, 2);
    } catch (jsonErr) {
      console.warn("Bad JSON from server, treating as no flights:", url, jsonErr, rawText);
      return [];
    }

  } catch (networkErr) {
    // This catches fetch failing entirely (server down etc)
    console.warn("Network failure for", url, networkErr);
    return [];
  }
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

function timeLimitedFlights(flightsArr, lowerLimit, upperLimit) {
  const timeLimited = flightsArr.filter(flight =>
    flight.SCHEDULED_ARRIVAL_UNIXTIME >= lowerLimit &&
    flight.SCHEDULED_DEPARTURE_UNIXTIME <= upperLimit
  );
  return timeLimited;
}

function allowDepFlightsOnly(flightsArr, allowedDepAirports) {
  const allowedDepFlights = flightsArr.filter(flight =>
  allowedDepAirports.includes(flight.DEPAPT)
  );
  return allowedDepFlights;
}

function allowArrFlightsOnly(flightsArr, allowedArrAirports) {
  const allowedArrFlights = flightsArr.filter(flight =>
  allowedArrAirports.includes(flight.ARRAPT)
  );
  return allowedArrFlights;
}

function intersection(arr1, arr2) {
  const set2 = new Set(arr2);
  return arr1.filter(x => set2.has(x));
}

function buildReachableMap(flights) {
  const map = new Map(); // key: origin airport, value: Set of destinations

  for (const flight of flights) {
    const from = flight.DEPAPT;
    const to = flight.ARRAPT;

    if (!map.has(from)) {
      map.set(from, new Set());
    }

    map.get(from).add(to);
  }

  return map;
}

function canReachAllTargets(originAirport, reachableMap, allowedDepAirports) {
  const reachableSet = reachableMap.get(originAirport);
  if (!reachableSet) {
    return false; // no outgoing flights at all
  }

  for (const target of allowedDepAirports) {
    // we usually don't require an airport to "reach itself" unless you want to
    if (target === originAirport) continue;

    if (!reachableSet.has(target)) {
      return false;
    }
  }

  return true;
}

function findSuperHubs(flights, allowedDepAirports) {
  const reachableMap = buildReachableMap(flights);
  const superHubs = [];

  // Check every origin airport in the data
  for (const originAirport of reachableMap.keys()) {
    if (canReachAllTargets(originAirport, reachableMap, allowedDepAirports)) {
      superHubs.push(originAirport);
    }
  }

  return superHubs;
}

function unixMsToIso(unixMs) {
  const d = new Date(unixMs);   // make a Date from ms-since-epoch
  return d.toISOString();       // returns ISO 8601 in UTC
}