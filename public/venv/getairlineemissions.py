import polars as pl
import json

def getAirlineEmissions(depapt, arrapt, year, month, day, schedules, emissions):
    # copy these files local if needed and update the paths
    schedule_file = str(schedules) + f"{year:04d}/{month:02d}/{day:02d}.csv"
    emissions_file = str(emissions)
    
    # schedule_file = "./2024_01_20.csv"
    # emissions_file = "./emissions.csv"

    # read CSVs as *lazy* frames (scan_csv = lazy, good for big data)
    schedules_lazy = pl.scan_csv(schedule_file, infer_schema_length=10000)
    emissions_lazy = pl.scan_csv(emissions_file, infer_schema_length=10000)
    
    # turn them into real DataFrames so we can treat them like normal tables
    schedules = schedules_lazy.collect()
    emissions = emissions_lazy.collect()

    # OPTIONAL: if you want to see columns just to debug
    # print(schedules.columns)
    # print(emissions.columns)

    # filter for flights from London (LHR) to Mumbai (BOM)
    london_to_mumbai_flights = schedules.filter(
        (pl.col("DEPAPT") == str(depapt)) & (pl.col("ARRAPT") == str(arrapt))
    )

    # join with the emissions data on carrier and flight number,
    # sort by emissions, select key columns
    joined = (
        london_to_mumbai_flights.join(
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
    getAirlineEmissions("LHR", "BOM", 2024, 1, 20, "/shared/challenge_data/schedules/", "/shared/challenge_data/emissions.csv")
