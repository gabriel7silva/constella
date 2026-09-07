---
name: metrics-brief-playbook
description: |
  Use this skill when Codex needs turns CSV, Excel, or JSON data into a polished visual report page. Recast from the original data-report/SKILL.md material as the metrics-brief-playbook procedure.
---

# Metrics Brief Playbook

## Role

Use this skill when Codex needs turns CSV, Excel, or JSON data into a polished visual report page. Recast from the original data-report/SKILL.md material as the metrics-brief-playbook procedure.

## Source Trace

- Original Markdown: `data-report/SKILL.md`
- Reformulated skill name: `metrics-brief-playbook`
- Upstream reference: https://github.com/nexu-io/html-anything
- Source category: `data`

## Operating Guidance

Follow the rewritten material below as the working procedure. Keep code blocks, commands, file paths, URLs, dimensions, and API names exact when applying the skill.

【模板: 数据可视化报告】
- 头部: 报告标题 + 时间区间 + 数据来源说明。
- KPI 卡片网格: 3-5 个最重要指标, 每个卡片显示数值 + 同比变化 + 微型趋势线。
- 主图表区: 至少 2 个图表 (柱状 / 折线 / 饼 / 散点), 使用 Chart.js 或 ECharts (jsdelivr CDN 引入), 数据从用户输入解析得到。
- **图表容器必须有固定高度**: 每个 `<canvas>` 外层包一个 `<div style="position:relative;height:NNNpx">` (KPI 迷你图 ~40px, 主图表 ~240–280px)。Chart.js 用 `responsive:true, maintainAspectRatio:false` 时若父容器没有显式高度, 会陷入 ResizeObserver 死循环, 图表无限增高直至卡死浏览器。**绝对不要**直接给 canvas 写 `height=` 属性当布局, 那个只是初始值。
- 数据表格: 用户原始数据节选, 使用 `<table>` + 现代化样式 (zebra stripe, hover, sticky header)。
- 洞察块: 3-5 条文字洞察, 用 emoji 开头, 像产品周报。
- 底部"方法论"折叠区。
- 配色克制专业: 主色 1 + 中性色阶, 图表用调色板。
- **必须解析用户提供的实际数据**, 不要捏造。
