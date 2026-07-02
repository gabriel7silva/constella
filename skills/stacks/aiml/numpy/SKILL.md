---
name: numpy
description: NumPy is the foundational Python package for scientific and numerical computing, providing the n-dimensional ndarray plus fast vectorized math, broadcasting, linear algebra, FFT, and random number generation. Consult this when working with arrays and dtypes, vectorizing loops, using broadcasting and slicing/fancy indexing, doing matrix math or reductions along axes, generating random data with the Generator API, or interoperating with pandas, scikit-learn, PyTorch, and TensorFlow.
domain: stack
category: aiml
tags: [numpy, ndarray, scientific-computing, linear-algebra, vectorization, arrays, python]
official_sources:
  - https://numpy.org/doc/stable/
  - https://github.com/numpy/numpy
  - https://numpy.org/install/
verified: 2026-06-17
---

# NumPy

## Overview
NumPy is the fundamental package for scientific computing with Python, centered on a fast, memory-efficient n-dimensional array object (`ndarray`) and a large library of vectorized mathematical functions. It is the numerical bedrock that pandas, scikit-learn, SciPy, PyTorch, and TensorFlow build on or interoperate with. Read this when manipulating arrays, vectorizing computation, using broadcasting, or doing linear algebra and random sampling.

## Official sources
- Docs: https://numpy.org/doc/stable/
- Repo: https://github.com/numpy/numpy
- Install: https://numpy.org/install/

## Install / setup
```bash
pip install numpy
```
Command from the official install page: https://numpy.org/install/

## Core concepts
- **ndarray** — fixed-size, homogeneous n-dimensional array; the core data structure.
- **dtype** — explicit element type (e.g. `int64`, `float32`) controlling memory and precision.
- **Broadcasting** — rules that let arrays of different shapes combine elementwise without copies.
- **Vectorization** — elementwise ufuncs replace Python loops for C-speed computation.
- **Indexing** — basic slicing (views), plus boolean masks and fancy (integer-array) indexing (copies).
- **Axes & reductions** — operations like `sum`/`mean`/`max` reduce along a chosen `axis`.
- **Generator (random)** — modern RNG via `np.random.default_rng()` (preferred over legacy `np.random.*`).

## Best practices
- Replace Python loops with vectorized ufuncs and broadcasting for speed (https://numpy.org/doc/stable/user/basics.broadcasting.html).
- Use `np.random.default_rng()` instead of the legacy global random functions (https://numpy.org/doc/stable/reference/random/index.html).
- Be aware that basic slices return views (mutations propagate); copy with `.copy()` when needed (https://numpy.org/doc/stable/user/basics.copies.html).
- Pick the smallest sufficient dtype (e.g. `float32`) to cut memory for large arrays (https://numpy.org/doc/stable/reference/arrays.dtypes.html).

## Common pitfalls
- Mutating a slice view unexpectedly changes the parent array → use `.copy()` for independent data.
- Integer overflow with fixed-width dtypes wraps silently → cast to a wider dtype before large sums.
- Comparing floats with `==` fails due to precision → use `np.isclose`/`np.allclose`.

## Examples
```python
import numpy as np

rng = np.random.default_rng(0)
a = rng.standard_normal((1000, 3))          # 1000x3 array
norms = np.linalg.norm(a, axis=1)           # per-row L2 norm (vectorized)
unit = a / norms[:, None]                    # broadcasting to normalize rows
print(unit.shape, np.allclose(np.linalg.norm(unit, axis=1), 1.0))
```

## Further reading
- https://numpy.org/doc/stable/user/absolute_beginners.html — beginner's guide
- https://numpy.org/doc/stable/user/basics.broadcasting.html — broadcasting rules
- https://numpy.org/doc/stable/reference/ — full API reference

## Related skills
- ../pandas — built on top of NumPy arrays
- ../scikit-learn — consumes ndarrays as X/y
- ../pytorch — tensors convert to/from NumPy
