---
name: scikit-learn
description: scikit-learn is the standard Python library for classical (non-deep) machine learning, offering consistent fit/predict/transform APIs for classification, regression, clustering, dimensionality reduction, model selection, and preprocessing built on NumPy/SciPy. Consult this when choosing an estimator, building Pipelines and ColumnTransformers, doing cross-validation and GridSearchCV/hyperparameter tuning, computing metrics, encoding/scaling features, or avoiding data leakage in train/test splits.
domain: stack
category: aiml
tags: [scikit-learn, machine-learning, sklearn, classification, regression, clustering, python]
official_sources:
  - https://scikit-learn.org/stable/
  - https://github.com/scikit-learn/scikit-learn
  - https://scikit-learn.org/stable/install.html
verified: 2026-06-17
---

# scikit-learn

## Overview
scikit-learn is a Python machine learning library built on NumPy, SciPy, and matplotlib, providing simple and efficient tools for predictive data analysis. It implements a huge range of classical algorithms behind a uniform estimator API (`fit`, `predict`, `transform`) plus utilities for preprocessing, model selection, and evaluation. Read this when doing tabular/classical ML, building reproducible Pipelines, or tuning and validating models.

## Official sources
- Docs: https://scikit-learn.org/stable/
- Repo: https://github.com/scikit-learn/scikit-learn
- Install: https://scikit-learn.org/stable/install.html

## Install / setup
```bash
pip install -U scikit-learn
```
Command from the official install guide: https://scikit-learn.org/stable/install.html

## Core concepts
- **Estimator** — any object with `.fit(X, y)`; the unifying abstraction across all algorithms.
- **Transformer** — estimator with `.transform()` (scalers, encoders, vectorizers) for feature engineering.
- **Predictor** — estimator with `.predict()` (and often `.predict_proba`/`.score`) for inference.
- **Pipeline** — chains transformers + a final estimator so fit/transform happen in order and only on training folds.
- **ColumnTransformer** — applies different transformers to different column subsets in one object.
- **Model selection** — `train_test_split`, `cross_val_score`, `GridSearchCV`/`RandomizedSearchCV` for evaluation and tuning.
- **Metrics** — `sklearn.metrics` for accuracy, precision/recall, ROC AUC, RMSE, R², etc.

## Best practices
- Put all preprocessing in a `Pipeline` so cross-validation refits transforms per fold and prevents leakage (https://scikit-learn.org/stable/modules/compose.html).
- Fit scalers/encoders on training data only; never fit on the full dataset before splitting (https://scikit-learn.org/stable/common_pitfalls.html).
- Use `GridSearchCV`/`RandomizedSearchCV` with a `cv` strategy rather than manual loops (https://scikit-learn.org/stable/modules/grid_search.html).
- Set `random_state` for reproducible splits and estimators (https://scikit-learn.org/stable/common_pitfalls.html).

## Common pitfalls
- Data leakage from scaling/encoding before the split → wrap preprocessing in a Pipeline and fit inside CV.
- Using accuracy on imbalanced classes → prefer precision/recall, F1, or ROC/PR AUC.
- Passing pandas columns of mixed dtypes → encode categoricals (e.g. `OneHotEncoder`) via ColumnTransformer first.

## Examples
```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.datasets import load_iris

X, y = load_iris(return_X_y=True)
pipe = Pipeline([
    ("scale", StandardScaler()),
    ("clf", LogisticRegression(max_iter=1000)),
])
print(cross_val_score(pipe, X, y, cv=5).mean())
```

## Further reading
- https://scikit-learn.org/stable/user_guide.html — comprehensive user guide
- https://scikit-learn.org/stable/auto_examples/index.html — runnable example gallery
- https://scikit-learn.org/stable/common_pitfalls.html — common pitfalls and recommended practices

## Related skills
- ../pandas — DataFrames feeding scikit-learn estimators
- ../numpy — array backbone for X/y inputs
- ../jupyter — interactive environment for ML experiments
