---
name: pandas
description: pandas is the standard Python library for labeled tabular data analysis and manipulation, providing the DataFrame and Series structures for loading, cleaning, reshaping, grouping, joining, and aggregating data. Consult this when reading/writing CSV/Parquet/Excel/SQL, filtering and selecting rows/columns with loc/iloc, handling missing data, doing groupby aggregations, merging/joining tables, pivoting/melting, working with time series and datetime indexes, or understanding Copy-on-Write (the default in pandas 3.0) and why chained assignment never modifies the original.
domain: stack
category: aiml
tags: [pandas, dataframe, data-analysis, data-wrangling, etl, time-series, python]
official_sources:
  - https://pandas.pydata.org/docs/
  - https://github.com/pandas-dev/pandas
  - https://pandas.pydata.org/docs/getting_started/install.html
verified: 2026-06-17
---

# pandas

## Overview
pandas is a fast, flexible, and expressive Python library providing labeled data structures (`Series`, `DataFrame`) for working with relational and time-series data. It is the de facto tool for data loading, cleaning, transformation, and exploratory analysis, and feeds most ML and analytics workflows. Read this when wrangling tabular data, doing groupby/merge/pivot operations, or handling missing values and datetime indexes.

## Official sources
- Docs: https://pandas.pydata.org/docs/
- Repo: https://github.com/pandas-dev/pandas
- Install: https://pandas.pydata.org/docs/getting_started/install.html

## Install / setup
```bash
pip install pandas
```
Command from the official install guide: https://pandas.pydata.org/docs/getting_started/install.html

## Core concepts
- **DataFrame** — 2D labeled table with heterogeneous typed columns; the central data structure.
- **Series** — 1D labeled array; a single DataFrame column.
- **Index** — row/column labels enabling alignment; includes `DatetimeIndex` and `MultiIndex`.
- **Label vs position selection** — `.loc[]` selects by label, `.iloc[]` by integer position.
- **groupby** — split-apply-combine for aggregation and transformation over groups.
- **merge / join / concat** — SQL-style joins and stacking of DataFrames.
- **reshape** — `pivot`/`pivot_table`, `melt`, `stack`/`unstack` to move between wide and long forms.

## Best practices
- Assign via `.loc`/`.iloc` (`df.loc[mask, 'col'] = x`) rather than chained indexing (`df[a][b] = x`); under Copy-on-Write (default in pandas 3.0) chained assignment silently does nothing to the original (https://pandas.pydata.org/docs/user_guide/copy_on_write.html).
- Use vectorized operations and built-in methods instead of `.iterrows()` loops (https://pandas.pydata.org/docs/user_guide/enhancingperf.html).
- Parse dates explicitly (`pd.to_datetime`, `parse_dates=`) and set a `DatetimeIndex` for time-series work (https://pandas.pydata.org/docs/user_guide/timeseries.html).
- Prefer columnar formats like Parquet over CSV for large data round-trips (https://pandas.pydata.org/docs/user_guide/io.html).

## Common pitfalls
- Chained assignment (`df[mask]['col'] = x`) consistently never modifies the original under Copy-on-Write (default in pandas 3.0); no warning is raised (`SettingWithCopyWarning` was removed in 3.0) → use `df.loc[mask, 'col'] = x`.
- The `inplace=` keyword is being deprecated (PDEP-8) for methods where it is only syntactic sugar for reassignment → prefer reassigning the result. It is retained for value-mutating methods (`fillna`, `replace`, `ffill`, `bfill`, `interpolate`, `where`, `mask`, `clip`), which in pandas 3.0 now return `self` instead of `None`.
- Mixing label and position with `.ix` (removed) → use `.loc`/`.iloc`.

## Examples
```python
import pandas as pd

df = pd.read_csv("sales.csv", parse_dates=["date"])
df = df.dropna(subset=["amount"])
monthly = (
    df.assign(month=df["date"].dt.to_period("M"))
      .groupby(["month", "region"], as_index=False)["amount"]
      .sum()
)
print(monthly.head())
```

## Further reading
- https://pandas.pydata.org/docs/user_guide/index.html — full user guide
- https://pandas.pydata.org/docs/getting_started/intro_tutorials/index.html — getting-started tutorials
- https://pandas.pydata.org/docs/reference/index.html — API reference

## Related skills
- ../numpy — array engine underlying pandas
- ../scikit-learn — consumes DataFrames for ML
- ../jupyter — interactive notebooks for data exploration
