---
name: r
description: R is a free language and environment for statistical computing, data analysis, and graphics, with packages distributed via CRAN; consult when writing R, installing packages, using vectors/data frames, the tidyverse, ggplot2, or producing statistical models, plots, and reproducible analyses.
domain: language
category: language
tags: [r, statistics, data-analysis, cran, tidyverse, ggplot2, vectorized]
official_sources:
  - https://www.r-project.org/
  - https://cran.r-project.org/
  - https://cran.r-project.org/manuals.html
verified: 2026-06-17
---

# R

## Overview
R is a free software environment and language for statistical computing, data analysis, and graphics, maintained by the R Foundation with packages distributed through CRAN. It is vectorized by design and excels at statistical modeling, data manipulation, and visualization. Read this when writing R, installing/using packages, working with data frames and the tidyverse, or producing plots and reproducible analyses.

## Official sources
- Docs: https://www.r-project.org/
- Repo: https://svn.r-project.org/R/ (official SVN; GitHub mirror at https://github.com/r-devel/r-svn)
- Install: https://cran.r-project.org/

## Install / setup
```r
# After installing R from CRAN, install packages from within R:
install.packages("tidyverse")
library(tidyverse)
```
Download R per https://cran.r-project.org/ ; `install.packages` is the official package-install function (https://cran.r-project.org/manuals.html).

## Core concepts
- **Vectors & vectorization** — the atomic vector is the base type; operations apply element-wise without explicit loops.
- **Data frames / tibbles** — tabular data with typed columns; the core structure for analysis.
- **Factors** — categorical variables with defined levels, important for modeling.
- **Functions & lazy/promise args** — first-class functions; arguments evaluated lazily when used.
- **The `<-` assignment** — idiomatic assignment operator (vs `=`), plus `%>%`/`|>` pipes for chaining.
- **CRAN & packages** — `install.packages()` / `library()` pull from the Comprehensive R Archive Network.
- **Recycling rule** — shorter vectors recycle to match longer ones in arithmetic; a common gotcha.
- **Formula objects** — `y ~ x` notation drives `lm`, `glm`, and many modeling functions.

## Best practices
- Organize work as projects with `renv` for reproducible package versions (https://cran.r-project.org/web/packages/renv/).
- Prefer vectorized operations and `apply`/`purrr::map` over explicit `for` loops (https://cran.r-project.org/doc/manuals/r-release/R-intro.html).
- Use the tidyverse (`dplyr`, `ggplot2`, `tidyr`) for readable data pipelines (https://www.tidyverse.org/).
- Document analyses in R Markdown / Quarto for reproducibility (https://cran.r-project.org/doc/manuals/r-release/R-exts.html).

## Common pitfalls
- Silent vector recycling producing wrong results → ensure operands have compatible lengths.
- `stringsAsFactors` and unexpected factor coercion → set explicitly or use `read.csv(..., stringsAsFactors = FALSE)` (default FALSE since R 4.0).
- Using `=` where `<-` is expected (or vice versa) in calls → use `<-` for assignment, `=` for named arguments.

## Examples
```r
library(dplyr)

mtcars |>
  group_by(cyl) |>
  summarise(mean_mpg = mean(mpg), n = n()) |>
  arrange(desc(mean_mpg))
```

## Further reading
- https://cran.r-project.org/manuals.html — official R manuals (Intro, Language Definition, Writing Extensions)
- https://cran.r-project.org/doc/manuals/r-release/R-intro.html — An Introduction to R
- https://www.tidyverse.org/ — the tidyverse package collection

## Related skills
- ../clojure — another data-oriented functional language
- ../haskell — statically typed functional language for comparison
