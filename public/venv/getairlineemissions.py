import polars as pl
import json
import sys

def getAirlineEmissions(depapt, arrapt, year, month, day, schedules_dir, emissions_file):
    # Build the path to the schedule CSV for that date
    # schedules_dir should look like "/shared/challenge_data/schedules/"
    schedule_file = f"{str(schedules_dir).rstrip('/')}/{year:04d}/{month:02d}/{day:02d}.csv"

    # Read CSVs lazily (good for big data); collect() makes them real DataFrames
    schedules = pl.scan_csv(schedule_file, infer_schema_length=20000).collect()
    emissions = pl.scan_csv(emissions_file, infer_schema_length=20000).collect()

    # Filter schedules based on depapt/arrapt
    if depapt == "AllAirports" and arrapt == "AllAirports":
        filtered_flights = schedules
    elif depapt == "AllAirports" and arrapt != "AllAirports":
        filtered_flights = schedules.filter(pl.col("ARRAPT") == arrapt)
    elif depapt != "AllAirports" and arrapt == "AllAirports":
        filtered_flights = schedules.filter(pl.col("DEPAPT") == depapt)
    else:
        filtered_flights = schedules.filter(
            (pl.col("DEPAPT") == depapt) & (pl.col("ARRAPT") == arrapt)
        )

    # Join with emissions. Adjust join keys if your CSV headers differ.
    joined = filtered_flights.join(
        emissions,
        left_on=["CARRIER", "FLTNO"],
        right_on=["CARRIER_CODE", "FLIGHT_NUMBER"],
        how="inner",
    )

    # Keep only the columns we actually care about
    # You can tweak this list to whatever the frontend needs.
    cols_we_need = [
        "CARRIER",
        "FLTNO",
        "DEPAPT",
        "ARRAPT",
        "SCHEDULED_DEPARTURE_DATE_TIME_UTC",
        "SCHEDULED_ARRIVAL_DATE_TIME_UTC",
        "ELPTIM",
        "ESTIMATED_CO2_TOTAL_TONNES",
    ]

    # Some of those columns might not exist in emissions after join (e.g. ESTIMATED_CO2_TOTAL_TONNES might be named differently)
    # We'll intersect with actual columns to avoid KeyError.
    cols_to_keep = [c for c in cols_we_need if c in joined.columns]

    reduced = joined.select(cols_to_keep)

    # OPTIONAL: drop duplicate same-flight entries (same carrier + flight no + dep/arr)
    # this helps stop explosions for repeating rows that are basically the same leg
    dedup_keys = [c for c in ["CARRIER", "FLTNO", "DEPAPT", "ARRAPT"] if c in reduced.columns]
    if dedup_keys:
        reduced = reduced.unique(subset=dedup_keys)

    # Sort by emissions if we have that column, lowest first
    if "ESTIMATED_CO2_TOTAL_TONNES" in reduced.columns:
        reduced = reduced.sort("ESTIMATED_CO2_TOTAL_TONNES")

    # HARD LIMIT: only return the first N rows so Node doesn't die
    # Tune N based on how chunky each row is
    N = 500
    limited = reduced.head(N)

    # Convert to plain Python list[dict]
    result_list = limited.to_dicts()

    # Also send some metadata so frontend can tell what's going on
    summary = {
        "meta": {
            "depapt": depapt,
            "arrapt": arrapt,
            "date": f"{year:04d}-{month:02d}-{day:02d}",
            "rows_total_before_limit": reduced.height,
            "rows_returned": len(result_list),
        },
        "flights": result_list,
    }

    return summary


if __name__ == "__main__":
    # CLI mode: python getairlineemissions.py DEPAPT ARRAPT YEAR MONTH DAY SCHEDULES_DIR EMISSIONS_FILE
    if len(sys.argv) != 8:
        sys.stderr.write(
            "Usage: python getairlineemissions.py DEPAPT ARRAPT YEAR MONTH DAY SCHEDULES_DIR EMISSIONS_FILE\n"
        )
        sys.stderr.write(
            "Example: python getairlineemissions.py LHR BOM 2024 1 20 /shared/challenge_data/schedules/ /shared/challenge_data/emissions.csv\n"
        )
        sys.exit(1)

    depapt        = sys.argv[1]
    arrapt        = sys.argv[2]
    year          = int(sys.argv[3])
    month         = int(sys.argv[4])
    day           = int(sys.argv[5])
    schedules_dir = sys.argv[6]
    emissions_csv = sys.argv[7]

    summary = getAirlineEmissions(
        depapt,
        arrapt,
        year,
        month,
        day,
        schedules_dir,
        emissions_csv
    )

    # Print ONLY the summary JSON to stdout (this is what Node will parse)
    print(json.dumps(summary))