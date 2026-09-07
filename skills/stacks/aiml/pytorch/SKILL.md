---
name: pytorch
description: PyTorch is an open-source deep learning framework with Pythonic tensors, dynamic (define-by-run) autograd, and strong GPU/CUDA acceleration, widely used for research and production. Consult this when building neural networks with torch.nn, writing training loops with autograd and optimizers, moving tensors between CPU/GPU/MPS devices, loading data with Dataset/DataLoader, compiling with torch.compile, doing distributed/DDP training, or saving/loading state_dict checkpoints, and when debugging device mismatches, gradient/requires_grad issues, or CUDA installs.
domain: stack
category: aiml
tags: [pytorch, deep-learning, machine-learning, autograd, neural-networks, gpu, python]
official_sources:
  - https://docs.pytorch.org/docs/stable/index.html
  - https://github.com/pytorch/pytorch
  - https://pytorch.org/get-started/locally/
verified: 2026-06-17
---

# PyTorch

## Overview
PyTorch is a Python-first deep learning framework offering GPU-accelerated tensors and a tape-based automatic differentiation system (autograd) with dynamic computation graphs. It is the dominant framework for ML research and is widely deployed in production via TorchScript, `torch.compile`, and ExecuTorch. Read this when defining models, writing custom training loops, managing devices, or building data pipelines.

## Official sources
- Docs: https://docs.pytorch.org/docs/stable/index.html
- Repo: https://github.com/pytorch/pytorch
- Install: https://pytorch.org/get-started/locally/

## Install / setup
```bash
# CPU-only (pip). For CUDA/ROCm builds, use the selector to get the right index URL.
pip install torch torchvision torchaudio
```
Command from the official install selector: https://pytorch.org/get-started/locally/

## Core concepts
- **Tensor** — n-dimensional array with a dtype and `.device`; supports GPU acceleration and NumPy-like ops.
- **autograd** — tensors with `requires_grad=True` record ops on a dynamic graph; `.backward()` computes gradients.
- **torch.nn.Module** — base class for models/layers; holds parameters and defines `forward()`.
- **Optimizer + loss** — `torch.optim` (SGD, Adam) updates parameters from gradients; losses live in `torch.nn`.
- **Dataset / DataLoader** — abstractions for sampling, batching, shuffling, and parallel data loading.
- **Device model** — explicitly move tensors/modules with `.to(device)` (`cuda`, `mps`, `cpu`).
- **torch.compile** — JIT graph capture + kernel fusion for speedups without changing model code.

## Best practices
- Zero gradients each step (`optimizer.zero_grad()`) before `loss.backward()` (https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html).
- Save the `state_dict`, not the whole pickled model, for portable checkpoints (https://docs.pytorch.org/tutorials/beginner/saving_loading_models.html).
- Wrap eval/inference in `with torch.no_grad():` and call `model.eval()` to disable dropout/batchnorm updates (https://docs.pytorch.org/docs/stable/notes/autograd.html).
- Use `DataLoader(num_workers=...)` and `pin_memory=True` to overlap loading with compute (https://docs.pytorch.org/docs/stable/data.html).

## Common pitfalls
- "Expected all tensors on same device" → move both model and inputs with `.to(device)`.
- Accumulating graphs/memory by appending live tensors to a list → call `.item()` or `.detach()` for logging.
- Forgetting `model.train()` after `model.eval()` → batchnorm/dropout behave wrong in the next epoch.

## Examples
```python
import torch
from torch import nn

device = "cuda" if torch.cuda.is_available() else "cpu"
model = nn.Sequential(nn.Linear(784, 128), nn.ReLU(), nn.Linear(128, 10)).to(device)
opt = torch.optim.Adam(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()

x, y = torch.randn(32, 784, device=device), torch.randint(0, 10, (32,), device=device)
for _ in range(3):
    opt.zero_grad()
    loss = loss_fn(model(x), y)
    loss.backward()
    opt.step()
```

## Further reading
- https://docs.pytorch.org/tutorials/ — official tutorials and recipes
- https://docs.pytorch.org/docs/stable/notes/autograd.html — autograd mechanics
- https://pytorch.org/get-started/locally/ — install selector for CPU/CUDA/ROCm

## Related skills
- ../tensorflow — alternative deep learning framework
- ../keras — high-level API that can run on a PyTorch backend (Keras 3)
- ../numpy — array library PyTorch tensors convert to/from
