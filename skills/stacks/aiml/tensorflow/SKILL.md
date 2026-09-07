---
name: tensorflow
description: TensorFlow is Google's open-source end-to-end machine learning and deep learning framework for building, training, and deploying models across CPUs, GPUs, and TPUs. Consult this when working with tf.keras models, tf.data input pipelines, tf.function/autograph graph execution, SavedModel export, TensorFlow Serving/Lite/.js deployment, or distributed training (tf.distribute), and when debugging tensor shapes, eager vs graph mode, or GPU/CUDA setup.
domain: stack
category: aiml
tags: [tensorflow, deep-learning, machine-learning, keras, neural-networks, gpu, python]
official_sources:
  - https://www.tensorflow.org/learn
  - https://github.com/tensorflow/tensorflow
  - https://www.tensorflow.org/install/pip
verified: 2026-06-17
---

# TensorFlow

## Overview
TensorFlow is an end-to-end open-source platform for machine learning, with a comprehensive ecosystem of tools, libraries, and community resources. It centers on tensors flowing through computational graphs and ships the high-level `tf.keras` API for model building plus tooling for production deployment. Read this when building/training deep learning models, optimizing input pipelines, exporting SavedModels, or deploying with TF Serving, Lite, or .js.

## Official sources
- Docs: https://www.tensorflow.org/learn
- Repo: https://github.com/tensorflow/tensorflow
- Install: https://www.tensorflow.org/install/pip

## Install / setup
```bash
# CPU-only
python3 -m pip install tensorflow

# GPU/CUDA (Linux)
python3 -m pip install 'tensorflow[and-cuda]'
```
Commands from the official install guide: https://www.tensorflow.org/install/pip

## Core concepts
- **Tensor** — immutable n-dimensional array with a dtype and shape; the unit of data that flows through ops.
- **tf.keras** — the official high-level API for layers, models (`Sequential`, Functional, subclassing), training loops, and metrics.
- **Eager vs graph execution** — ops run imperatively by default; `@tf.function` traces Python into an optimized graph (AutoGraph) for speed.
- **tf.data** — composable, performant input pipelines (`map`, `batch`, `shuffle`, `prefetch`) for streaming data into training.
- **tf.Variable / GradientTape** — variables hold trainable state; `tf.GradientTape` records ops for automatic differentiation.
- **tf.distribute.Strategy** — abstraction for multi-GPU/multi-host/TPU training (e.g. `MirroredStrategy`).
- **SavedModel** — language-neutral serialization format for export, serving, and TFLite/TF.js conversion.

## Best practices
- Use `tf.data` with `.cache()` and `.prefetch(tf.data.AUTOTUNE)` to keep accelerators fed (https://www.tensorflow.org/guide/data_performance).
- Wrap hot training steps in `@tf.function` rather than running everything eagerly (https://www.tensorflow.org/guide/function).
- Use `tf.distribute.MirroredStrategy` for multi-GPU instead of manual device placement (https://www.tensorflow.org/guide/distributed_training).
- Export a SavedModel for serving with `model.export("path")` (or `tf.saved_model.save(model, "path")`); use `model.save("model.keras")` for the native Keras checkpoint format. In Keras 3 (TF 2.16+), `model.save()` requires a `.keras` extension and no longer writes a SavedModel (https://www.tensorflow.org/guide/saved_model).

## Common pitfalls
- Mixing NumPy ops inside `@tf.function` creates Python side effects that get traced once → use TF ops or `tf.numpy_function`.
- Forgetting `.prefetch`/`.batch` ordering starves the GPU → batch then prefetch with AUTOTUNE.
- GPU not detected → verify with `tf.config.list_physical_devices('GPU')` and match CUDA/cuDNN to the install matrix.

## Examples
```python
import tensorflow as tf

model = tf.keras.Sequential([
    tf.keras.layers.Dense(128, activation="relu"),
    tf.keras.layers.Dense(10),
])
model.compile(optimizer="adam",
              loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
              metrics=["accuracy"])

(x, y), _ = tf.keras.datasets.mnist.load_data()
ds = tf.data.Dataset.from_tensor_slices((x / 255.0, y)).batch(32).prefetch(tf.data.AUTOTUNE)
model.fit(ds, epochs=3)
```

## Further reading
- https://www.tensorflow.org/tutorials — official tutorials (beginner to advanced)
- https://www.tensorflow.org/guide — in-depth guides on tf.data, tf.function, distribution
- https://www.tensorflow.org/api_docs/python/tf — full Python API reference

## Related skills
- ../keras — high-level model API; tf.keras is TensorFlow's bundled Keras
- ../pytorch — alternative deep learning framework
- ../numpy — array foundation TensorFlow interops with
