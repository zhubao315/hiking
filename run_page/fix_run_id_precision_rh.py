#!/usr/bin/env python3
"""Repair run_ids that lost precision to a float64 round trip.

hiking's published JSON carried 84 ids that do not exist in `run_page/data.db`:
7000000000006376250 had become 7000000000006376000, 9223370529588380167 had
become 9223370529588380000. Any id above 2^53 is beyond the exact range of an
IEEE double, so a single trip through `JSON.parse` in Node — the 3D baking and
geo scripts read and rewrite this file — silently rewrites the low digits. The
DB keeps the value the watch reported, so it is the authority here.

This matters because `run_id` is the join key: between `activities.json` and the
DB, between the hiking dataset and the duplicate manifest the running site
reads, and between a record and its baked 3D scene. A rounded id is a record
that exists in one place and not another.

Repair is only applied when the match is unambiguous: exactly one DB id rounds
to the JSON id, and that DB row agrees on start time, distance and name. Anything
else is reported and left alone.

Usage:
    python run_page/fix_run_id_precision_rh.py                 # report
    python run_page/fix_run_id_precision_rh.py --execute       # write
"""

import argparse
import json
import sqlite3
import sys

DEFAULT_JSON = "src/static/activities.json"
DEFAULT_DB = "run_page/data.db"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", default=DEFAULT_JSON)
    parser.add_argument("--db", default=DEFAULT_DB)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    with open(args.json, encoding="utf-8") as handle:
        records = json.load(handle)
    connection = sqlite3.connect(args.db)
    rows = {
        row[0]: row
        for row in connection.execute(
            "select run_id, start_date_local, distance, name from activities"
        )
    }
    connection.close()

    json_ids = {record["run_id"] for record in records}
    repairs = {}
    ambiguous = []
    rejected = []
    # The corruption is a double round trip, so the two sides are equal as
    # doubles even though the decimal text differs: 7000000000006376250 was
    # written out as its shortest round-trip form 7000000000006376000.
    by_double = {}
    for run_id in rows:
        by_double.setdefault(float(run_id), []).append(run_id)
    for run_id, row in rows.items():
        if run_id in json_ids:
            continue
        candidates = [
            other for other in by_double[float(run_id)] if other not in json_ids
        ]
        rounded = [
            other
            for other in json_ids
            if float(other) == float(run_id) and other != run_id
        ]
        if len(candidates) != 1 or len(rounded) != 1:
            ambiguous.append((run_id, len(candidates), len(rounded)))
            continue
        target = rounded[0]
        if row[1] is None:
            rejected.append((target, run_id))
            continue
        agrees = any(
            record["run_id"] == target
            and str(record.get("start_date_local"))[:19] == str(row[1])[:19]
            and abs(float(record["distance"]) - float(row[2])) < 0.01
            and record.get("name") == row[3]
            for record in records
        )
        if not agrees:
            rejected.append((target, run_id))
            continue
        repairs[target] = run_id

    beyond = sum(1 for record in records if record["run_id"] > 2**53)
    print(
        f"json records: {len(records)} | db rows: {len(rows)} | "
        f"ids above 2^53: {beyond}"
    )
    print(
        f"repairable: {len(repairs)} | ambiguous (two ids round alike): "
        f"{len(ambiguous)} | refused (row does not agree): {len(rejected)}"
    )
    for rounded, exact in sorted(repairs.items()):
        print(f"   {rounded} -> {exact}")
    for entry in ambiguous[:5]:
        print("   AMBIGUOUS", entry)
    for entry in rejected[:5]:
        print("   REFUSED", entry)

    still_missing = json_ids - set(rows) - set(repairs)
    if still_missing:
        print(f"json ids still absent from the DB: {len(still_missing)}")

    if not repairs:
        print("nothing to repair")
        return 0
    if not args.execute:
        print("DRY RUN: pass --execute to write")
        return 0

    for record in records:
        if record["run_id"] in repairs:
            record["run_id"] = repairs[record["run_id"]]
    with open(args.json, "w", encoding="utf-8") as handle:
        json.dump(records, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"restored {len(repairs)} exact id(s) in {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
