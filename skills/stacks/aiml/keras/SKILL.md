---
name: keras
description: Keras is a high-level, multi-backend deep learning API (Keras 3) that runs on JAX, TensorFlow, or PyTorch, offering Sequential/Functional/subclassed models with a clean compile/fit/evaluate workflow. Consult this when building neural networks quickly, defining layers and custom models, configuring optimizers/losses/metrics and callbacks, choosing or switching the KERAS_BACKEND, saving/loading .keras models, or porting code across JAX/TF/PyTorch backends.
domain: stack
category: aiml
tags: [keras, deep-learning, neural-networks, tensorflow, jax, pytorch, python]
official_sources:
  - https://keras.io/
  - https://github.com/keras-team/keras
  - https://keras.io/getting_started/
verified: 2026-06-17
---

# Keras

## Overview
Keras is a deep learning API written in Python, focused on enabling fast experimentation with a clean, layered model-building interface. Keras 3 is multi-backend: the same model code runs on JAX, TensorFlow, or PyTorch, selected via the `KERAS_BACKEND` environment variable. Read this when building/training neural networks at a high level, choosing a backend, or saving and loading models.

## Official sources
- Docs: https://keras.io/
- Repo: https://github.com/keras-team/keras
- Install: https://keras.io/getting_started/

## Install / setup
```bash
pip install --upgrade keras
# then install a backend (one of), e.g.:
pip install tensorflow   # or: pip install jax  /  pip install torch
export KERAS_BACKEND="jax"
```
Commands from the official getting-started guide: https://keras.io/getting_started/

## Core concepts
- **Backend** — JAX, TensorFlow, or PyTorch; set `KERAS_BACKEND` (or `~/.keras/keras.json`) before `import keras`; cannot change after import.
- **Sequential API** — linear stack of layers for simple feed-forward models.
- **Functional API** — build arbitrary DAGs of layers via tensor calls; the recommended general-purpose API.
- **Subclassing** — subclass `keras.Model`/`keras.layers.Layer` and implement `call()` for full control.
- **compile / fit / evaluate / predict** — declare optimizer, loss, and metrics, then train and run inference.
- **Callbacks** — hooks like `ModelCheckpoint`, `EarlyStopping`, `TensorBoard` during training.
- **.keras format** — the modern single-file model serialization format (`model.save("m.keras")`).

## Best practices
- Set `KERAS_BACKEND` before importing Keras; it cannot be switched afterward (https://keras.io/getting_started/).
- Prefer the Functional API for multi-input/output or branching models over deep subclassing (https://keras.io/guides/functional_api/).
- Use `EarlyStopping` + `ModelCheckpoint` callbacks rather than fixed epoch counts (https://keras.io/api/callbacks/).
- Save in the native `.keras` format for full architecture+weights portability (https://keras.io/guides/serialization_and_saving/).

## Common pitfalls
- Importing Keras before setting `KERAS_BACKEND` → backend locks to the default; set the env var first.
- Confusing standalone `keras` (Keras 3) with `tf.keras` bundled in TensorFlow → pick one import path consistently.
- Loading legacy `.h5`/SavedModel into Keras 3 without matching custom objects → register them or re-export to `.keras`.

## Examples
```python
import os
os.environ["KERAS_BACKEND"] = "jax"  # before importing keras
import keras
from keras import layers

model = keras.Sequential([
    layers.Dense(128, activation="relu"),
    layers.Dense(10, activation="softmax"),
])
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
# model.fit(x_train, y_train, epochs=3, validation_split=0.1)
model.save("model.keras")
```

## Further reading
- https://keras.io/guides/ — developer guides (Functional API, custom training, serialization)
- https://keras.io/api/ — full layers/models/callbacks API reference
- https://keras.io/examples/ — code examples across vision, NLP, and more

## Related skills
- ../tensorflow — a Keras backend; `tf.keras` ships with TensorFlow
- ../pytorch — a supported Keras 3 backend
- ../numpy — array inputs to Keras models
