import polars as pl
import json

def getAirlineEmissions(depapt, arrapt, year, month, day, schedules, emissions):
    # copy these files local if needed and update the paths
    schedule_file = str(schedules) + f"{year:04d}/{month:02d}/{day:02d}.csv"
    emissions_file = str(emissions)

    # read CSVs as *lazy* frames (scan_csv = lazy, good for big data)
    schedules_lazy = pl.scan_csv(schedule_file, infer_schema_length=10000)
    emissions_lazy = pl.scan_csv(emissions_file, infer_schema_length=10000)
    
    # turn them into real DataFrames so we can treat them like normal tables
    schedules = schedules_lazy.collect()
    emissions = emissions_lazy.collect()

    # OPTIONAL: if you want to see columns just to debug
    # print(schedules.columns)
    # print(emissions.columns)

    # filter for flights from a departure airport to an arrival airport

    if arrapt == "AllAirports" and depapt == "AllAirports":
        filtered_flights = schedules
    elif arrapt == "AllAirports" and depapt != "AllAirports":
        filtered_flights = schedules.filter(
            (pl.col("DEPAPT") == str(depapt))
        )
    elif arrapt != "AllAirports" and depapt == "AllAirports":
        filtered_flights = schedules.filter(
            (pl.col("ARRAPT") == str(arrapt))
        )
    else:
        filtered_flights = schedules.filter(
            (pl.col("DEPAPT") == str(depapt)) & (pl.col("ARRAPT") == str(arrapt))
        )

    # join with the emissions data on carrier and flight number,
    # sort by emissions, select key columns
    joined = (
        filtered_flights.join(
            emissions,
            left_on=["CARRIER", "FLTNO"],
            right_on=["CARRIER_CODE", "FLIGHT_NUMBER"],
            how="inner",
        )
    )

    # again: convert to plain Python so you don't get the Polars table box
    result_list = joined.to_dicts()
    json_dump = json.dumps(result_list, indent=4)
    print(json_dump)

if __name__ == "__main__":
    # Expecting:
    #   depapt arrapt year month day schedulesDir emissionsFile
    #
    # example:
    #   python getairlineemissions.py LHR BOM 2024 1 20 /shared/challenge_data/schedules/ /shared/challenge_data/emissions.csv

    if len(sys.argv) != 8:
        # Not enough args, complain in stderr and exit nonzero
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

    getAirlineEmissions(
        depapt,
        arrapt,
        year,
        month,
        day,
        schedules_dir,
        emissions_csv
    )