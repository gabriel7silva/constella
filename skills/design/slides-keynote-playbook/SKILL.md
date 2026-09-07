---
name: slides-keynote-playbook
description: |
  Use this skill when Codex needs apple Keynote-quality slides, one card per screen, with keyboard left/right navigation. Recast from the original ppt-keynote/SKILL.md material as the slides-keynote-playbook procedure.
---

# Slides Keynote Playbook

## Role

Use this skill when Codex needs apple Keynote-quality slides, one card per screen, with keyboard left/right navigation. Recast from the original ppt-keynote/SKILL.md material as the slides-keynote-playbook procedure.

## Source Trace

- Original Markdown: `ppt-keynote/SKILL.md`
- Reformulated skill name: `slides-keynote-playbook`
- Upstream reference: https://github.com/nexu-io/html-anything
- Source category: `slides`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

【模板: Keynote 风格 PPT】
- 每张幻灯片是一个 `<section class="slide">`, 整体宽 1280 高 720, 居中显示, 背景渐变。
- 单页内容极简: 大标题 + 1-3 行支持文字; 或一张数据图; 或一个金句。
- 字号: 标题 `text-7xl font-semibold tracking-tight`, 副标题 `text-2xl text-neutral-500`。
- 第一页是封面 (主题 + 演讲者 / 日期), 最后一页是 "Thanks." 或行动号召。
- 顶部右上角小指示器: 当前页 / 总页数。
- 加一段 JavaScript 监听 ArrowLeft / ArrowRight / 空格键切换 slide; 同时维护 hash (#/3)。
- 每页之间用 fade-in 动画。
- 保持留白, 数据卡片用 grid 布局对齐, 颜色克制。
