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
  console.log(filtered);
}
