---
name: commerce-visual-flow-quality-gate
description: |
  Use this skill when Codex needs procedural guidance derived from ecommerce-image-workflow/references/checklist.md. Recast from the original ecommerce-image-workflow/references/checklist.md material as the commerce-visual-flow-quality-gate procedure.
---

# Commerce Visual Flow Quality Gate

## Role

Use this skill when Codex needs procedural guidance derived from ecommerce-image-workflow/references/checklist.md. Recast from the original ecommerce-image-workflow/references/checklist.md material as the commerce-visual-flow-quality-gate procedure.

## Source Trace

- Original Markdown: `ecommerce-image-workflow/references/checklist.md`
- Reformulated skill name: `commerce-visual-flow-quality-gate`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

Execute this before handoff. P0 items needs to pass for the output to be usable.

## P0 - needs to pass

- [ ] **Reference image exists.** The workflow used at least one real uploaded
  product image. If no image was available, the execute stopped and asked the user
  to upload one.
- [ ] **Reference-product mode only.** The output is not a brief-only concept
  product. Any brief-only request was deferred.
- [ ] **One product.** The execute targets one product, not a SKU family or mixed catalog.
- [ ] **Product fidelity lock appears in every prompt.** Each generated slot
  prompt preserves shape, silhouette, color, material, logo/label placement,
  visible construction details, and proportions.
- [ ] **No redesign.** Prompts avoid add, remove, relocate, recolor, or restyle
  product features. Product edit requests that change the product itself are
  out of scope for this V1 workflow and prefer to be deferred to a follow-up
  workflow.
- [ ] **Three-slot scope.** The set is limited to main, feature, and lifestyle
  unless the user explicitly requested fewer.
- [ ] **Media dispatcher only.** Generation used
  `"$OD_NODE_BIN" "$OD_BIN" media generate`; no provider API or custom model
  command was called directly.
- [ ] **Reference image is passed to generation.** Each media command includes
  `--image <project-relative product reference image>` when the model supports
  reference images. If not supported, the workflow stops instead of pretending
  product fidelity is guaranteed.
- [ ] **No fabricated claims.** The feature image does not invent
  certifications, measurements, materials, ingredients, performance numbers,
  awards, or compliance promises.
- [ ] **No tiny rendered text dependency.** Prompts avoid relying on small
  in-image text for selling points; they leave clean label space when copy will
  be added later.
- [ ] **Manifest exists.** `image-manifest.json` records workflow name, mode,
  product name/label, reference images, slot ids, output filenames, aspects,
  and prompt summaries.
- [ ] **Gallery exists.** `ecommerce-gallery.html` shows the reference image
  first and the generated main, feature, and lifestyle slots.

## P1 - prefer to pass

- [ ] **Slot roles are visually distinct.** Main is a clean packshot, feature is
  detail/benefit focused, lifestyle is contextual.
- [ ] **Backgrounds fit ecommerce use.** Main image uses white/off-white/light
  grey; feature and lifestyle avoid noisy backgrounds that hide product details.
- [ ] **Scale is plausible.** Product size and proportions remain credible across all slots.
- [ ] **Human interaction is controlled.** Hands/models avoid hide the product
  or alter its construction.
- [ ] **File names are predictable.** Outputs use `<product-slug>-main.png`,
  `<product-slug>-feature.png`, and `<product-slug>-lifestyle.png` or similarly
  readable names.

## P2 - nice to have

- [ ] **Marketplace note included.** Handoff states that platform-specific
  crop/background/text rules remain a follow-up or human review step.
- [ ] **Variation path is clear.** Handoff suggests the next useful variant,
  such as a different lifestyle scene or a second feature focus.
