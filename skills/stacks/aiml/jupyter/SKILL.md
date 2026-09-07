---
name: jupyter
description: Jupyter provides interactive computing notebooks (JupyterLab, Jupyter Notebook) that mix live code, equations, visualizations, and narrative text, executed by language-specific kernels over the notebook (.ipynb) format. Consult this when installing/launching JupyterLab or the classic Notebook, working with cells and kernels, choosing the IPython kernel, managing the .ipynb JSON format, using magics (%matplotlib, %timeit), connecting to a server, or troubleshooting kernel selection, reproducibility, and out-of-order execution.
domain: stack
category: aiml
tags: [jupyter, jupyterlab, notebook, ipython, kernel, interactive-computing, python]
official_sources:
  - https://docs.jupyter.org/en/latest/
  - https://github.com/jupyterlab/jupyterlab
  - https://jupyterlab.readthedocs.io/en/stable/getting_started/installation.html
verified: 2026-06-17
---

# Jupyter

## Overview
Project Jupyter provides open-source software for interactive computing across dozens of programming languages, most visibly the web-based JupyterLab IDE and the classic Jupyter Notebook. Notebooks combine executable code cells, rich output, and Markdown narrative in a single `.ipynb` document run by a language kernel. Read this when setting up notebooks, managing kernels, or building reproducible interactive data/ML workflows.

## Official sources
- Docs: https://docs.jupyter.org/en/latest/
- Repo: https://github.com/jupyterlab/jupyterlab
- Install: https://jupyterlab.readthedocs.io/en/stable/getting_started/installation.html

## Install / setup
```bash
pip install jupyterlab
jupyter lab
```
Commands from the official JupyterLab install guide: https://jupyterlab.readthedocs.io/en/stable/getting_started/installation.html

## Core concepts
- **Notebook (.ipynb)** — JSON document of ordered cells plus outputs and metadata.
- **Cell** — unit of content; code cells execute, Markdown cells render text/LaTeX.
- **Kernel** — separate process that runs code (IPython for Python); holds session state.
- **JupyterLab vs Notebook** — Lab is the modern extensible IDE; Notebook 7 is the lightweight document-centric UI (both on the same server).
- **Magics** — IPython commands: line (`%timeit`, `%matplotlib`) and cell (`%%bash`, `%%time`).
- **Kernel state** — variables persist across cells in execution order, independent of cell layout order.
- **Server** — the Jupyter Server backend that the browser frontend connects to (local or remote).

## Best practices
- Restart the kernel and "Run All" before sharing to guarantee top-to-bottom reproducibility (https://docs.jupyter.org/en/latest/).
- Install packages into the same environment the kernel uses (`%pip install`) to avoid kernel/env mismatch (https://docs.jupyter.org/en/latest/install.html).
- Register environments as named kernels with `ipykernel` so you can pick them in the UI (https://ipython.readthedocs.io/en/stable/install/kernel_install.html).
- Keep notebooks small and factor reusable logic into imported `.py` modules (https://jupyterlab.readthedocs.io/en/stable/).

## Common pitfalls
- Out-of-order cell execution creates hidden state → restart kernel and run all to verify.
- Wrong kernel/env means `import` fails despite a `pip install` in a terminal → install into the kernel's env with `%pip`.
- Committing notebooks with large outputs bloats diffs → clear outputs (or use nbstripout) before commit.

## Examples
```bash
# Create and register a dedicated kernel for a virtual environment
python -m venv .venv && source .venv/bin/activate
pip install ipykernel
python -m ipykernel install --user --name myproject --display-name "Python (myproject)"
jupyter lab
```

## Further reading
- https://docs.jupyter.org/en/latest/ — Project Jupyter documentation hub
- https://jupyterlab.readthedocs.io/en/stable/ — JupyterLab user guide
- https://ipython.readthedocs.io/en/stable/interactive/magics.html — IPython magic commands

## Related skills
- ../pandas — common notebook companion for data analysis
- ../numpy — numerical computing in notebooks
- ../scikit-learn — interactive ML experimentation
