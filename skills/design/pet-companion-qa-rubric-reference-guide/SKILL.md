---
name: pet-companion-qa-rubric-reference-guide
description: |
  Use this skill when Codex needs procedural guidance derived from hatch-pet/references/qa-rubric.md. Recast from the original hatch-pet/references/qa-rubric.md material as the pet-companion-qa-rubric-reference-guide procedure.
---

# Pet Companion QA Rubric Reference Guide

## Role

Use this skill when Codex needs procedural guidance derived from hatch-pet/references/qa-rubric.md. Recast from the original hatch-pet/references/qa-rubric.md material as the pet-companion-qa-rubric-reference-guide procedure.

## Source Trace

- Original Markdown: `hatch-pet/references/qa-rubric.md`
- Reformulated skill name: `pet-companion-qa-rubric-reference-guide`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Do not accept an atlas until all checks pass.

## Geometry

- Exact `1536x1872` dimensions.
- 8 columns x 9 rows.
- Each frame fits inside its `192x208` cell.
- Unused cells are transparent.
- `qa/review.json` has no errors.
- `frames/frames-manifest.json` records component extraction for production rows, unless slot extraction was intentionally accepted after visual inspection.

## Character Consistency

- Same silhouette and proportions across every row.
- Same face and expression language.
- Same material, palette, lighting, and prop design.
- No frame introduces a new unintended character or object.

## Sprite Style

- Art reads as a Codex digital pet sprite, not a polished illustration or glossy app icon.
- Silhouette is compact and chunky enough to read inside a `192x208` cell.
- Outlines are dark and simple, with visible stepped/pixel-style edges.
- Palette is limited, with flat cel shading and minimal highlights or shadow steps.
- No painterly texture, realistic fur/material detail, soft gradients, high-detail antialiasing, or tiny accessories that disappear at pet size.

## Animation Completeness

- Each row uses the exact expected number of frames.
- The first and last frames can loop without an obvious pop.
- Directional rows read as the intended direction.
- State-specific actions are recognizable at pet size.
- Poses are generated animation variants, not repeated copies of the same source image.

## App Fitness

- First idle frame works as a static reduced-motion pet.
- No important detail is too small to read.
- No frame is clipped by the cell.
- Failed/review/waiting states are distinct from ordinary idle.
- Contact sheets needs to show whole sprite poses inside cells, not cropped tiles from a larger reference image.
- Contact sheets needs to not be accepted if every used frame is just the reference image with small geometric transforms.
- Used cells needs to not have white or opaque rectangular backgrounds unless the pet intentionally fills the whole cell and the user accepts that tradeoff.
- The chroma key needs to be visually absent from the character. If extraction removes character regions, choose a different key and regenerate the affected base/rows.
- Contact sheets needs to not show edge slivers or partial neighboring sprites inside cells.
- Contact sheets needs to not show darker/lighter versions of the chroma key as shadows, dust, smears, glows, landing marks, or motion effects. These are background extraction failures and prefer to trigger row repair.
- If `qa/review.json` reports edge pixels, sparse frames, size outliers, or slot-extraction fallback, review the row visually and repair it when the issue is visible.
- If `qa/review.json` reports chroma-adjacent non-transparent pixels, repair the row unless those pixels are an intentional character color and the selected key was manually accepted.

## Repair Strategy

Repair the smallest failing scope first:

1. Single bad frame.
2. One row.
3. Full atlas regeneration only when identity or layout is broadly broken.

The normal production path prefer to queue targeted repair jobs for failing rows. Manual repair prefer to preserve the same execute directory and regenerate only the affected row prompt/image unless the base character is wrong.
