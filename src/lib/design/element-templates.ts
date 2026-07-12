/* Add Elements — the library the operator clicks/drags onto the Design canvas. Every entry's `html` is a
   SELF-CONTAINED snippet with exactly ONE root element, written TOKEN-DRIVEN: it consumes the same :root
   variables Grace's screens declare (--accent, --accent-fg, --space, --radius, --font) — the very vars the
   Styles panel pushes live via applyTokens — so a dropped element instantly matches the live design tokens.
   Each root carries data-ed (Layers-tree label) + data-comp (logical component name → describe().componentName,
   read by Grace) and a leading <!-- intent --> comment. Neutral surfaces use plain values so a snippet looks
   right on any screen; "Clean up with Grace" later folds these inline styles into the stylesheet. */

export type ElementCategory =
  | "Basics" | "Text" | "Forms" | "Layout" | "Navigation"
  | "Feedback" | "Data" | "Cards" | "Modals" | "Sections"
  | "Components" | "Media" | "Interactions";

export interface ElementTemplate {
  id: string;                       // stable key, e.g. "button-primary"
  label: string;                    // tile + data-ed label, e.g. "Primary button"
  category: ElementCategory;
  keywords: string[];               // lowercased search terms
  icon?: string;                    // Icon name (icon.tsx set); default "grid"
  defaultMode?: "flow" | "free";    // "free" = insert absolutely positioned at the drop point (modal, tooltip)
  defaultContainer?: boolean;       // true = a layout container others can drop into (click-insert targets INTO it)
  html: string;                     // the snippet — exactly one root element
}

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  "Basics", "Text", "Forms", "Layout", "Navigation", "Feedback",
  "Data", "Cards", "Modals", "Sections", "Components", "Media", "Interactions",
];

export const ELEMENT_TEMPLATES: ElementTemplate[] = [
  // ── Basics ──────────────────────────────────────────────────────────────────────────────────────
  {
    id: "text", label: "Text", category: "Basics", keywords: ["label", "span", "copy"], icon: "newFile",
    html: `<!-- Inline text --><span class="el-text" data-ed="Text" data-comp="Text" style="font-family:var(--font);font-size:14px;color:#15171c;">New text</span>`,
  },
  {
    id: "button-primary", label: "Primary button", category: "Basics", keywords: ["cta", "action", "submit", "btn"], icon: "play",
    html: `<!-- Primary action button -->
<button class="el-btn el-btn--primary" data-ed="Primary button" data-comp="Button" style="font:600 14px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)*1.25) calc(var(--space)*2.5);border-radius:var(--radius);cursor:pointer;">Get started</button>`,
  },
  {
    id: "button-secondary", label: "Secondary button", category: "Basics", keywords: ["ghost", "outline", "btn"], icon: "play",
    html: `<!-- Secondary / outline button -->
<button class="el-btn el-btn--secondary" data-ed="Secondary button" data-comp="Button" style="font:600 14px/1 var(--font);color:var(--accent);background:transparent;border:1px solid var(--accent);padding:calc(var(--space)*1.25) calc(var(--space)*2.5);border-radius:var(--radius);cursor:pointer;">Learn more</button>`,
  },
  {
    id: "icon", label: "Icon", category: "Basics", keywords: ["svg", "glyph", "symbol"], icon: "skill",
    html: `<!-- Stroke icon (star) --><svg class="el-icon" data-ed="Icon" data-comp="Icon" width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5l1.4 3.1 3.4.4-2.5 2.3.7 3.3L8 9.9 5 11.6l.7-3.3L3.2 6l3.4-.4z"/></svg>`,
  },
  {
    id: "badge", label: "Badge", category: "Basics", keywords: ["tag", "chip", "pill", "label"], icon: "dot",
    html: `<!-- Status badge --><span class="el-badge" data-ed="Badge" data-comp="Badge" style="display:inline-flex;align-items:center;gap:6px;font:600 12px/1 var(--font);color:var(--accent-fg);background:var(--accent);padding:4px 10px;border-radius:999px;">New</span>`,
  },

  // ── Text ────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "heading", label: "Heading", category: "Text", keywords: ["title", "h1", "h2"], icon: "newFile",
    html: `<!-- Section heading --><h2 class="el-heading" data-ed="Heading" data-comp="Heading" style="margin:0;font-family:var(--font);font-size:clamp(24px,3vw,34px);font-weight:800;color:#15171c;line-height:1.15;">Heading</h2>`,
  },
  {
    id: "subtitle", label: "Subtitle", category: "Text", keywords: ["subheading", "eyebrow", "kicker"], icon: "newFile",
    html: `<!-- Subtitle --><p class="el-subtitle" data-ed="Subtitle" data-comp="Subtitle" style="margin:0;font-family:var(--font);font-size:16px;font-weight:600;color:var(--accent);letter-spacing:.02em;">Subtitle</p>`,
  },
  {
    id: "paragraph", label: "Paragraph", category: "Text", keywords: ["body", "text", "copy", "lorem"], icon: "doc",
    html: `<!-- Body paragraph --><p class="el-paragraph" data-ed="Paragraph" data-comp="Paragraph" style="margin:0;font-family:var(--font);font-size:15px;line-height:1.6;color:#5b6170;max-width:60ch;">Write a short, clear paragraph that explains this section in one or two sentences.</p>`,
  },

  // ── Forms ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: "input", label: "Text input", category: "Forms", keywords: ["field", "text", "email", "form"], icon: "newFile",
    html: `<!-- Labeled text field -->
<label class="el-field" data-ed="Text field" data-comp="Input field" style="display:flex;flex-direction:column;gap:calc(var(--space)*.75);font-family:var(--font);max-width:320px;">
  <span class="el-field__label" style="font-size:12px;font-weight:600;color:#5b6170;">Email</span>
  <input class="el-field__input" type="email" placeholder="you@example.com" style="font:14px/1.2 var(--font);color:#15171c;background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:var(--radius);padding:calc(var(--space)*1.1) calc(var(--space)*1.25);outline:none;" />
</label>`,
  },
  {
    id: "textarea", label: "Textarea", category: "Forms", keywords: ["field", "multiline", "message", "form"], icon: "doc",
    html: `<!-- Labeled textarea -->
<label class="el-field" data-ed="Textarea" data-comp="Textarea" style="display:flex;flex-direction:column;gap:calc(var(--space)*.75);font-family:var(--font);max-width:360px;">
  <span class="el-field__label" style="font-size:12px;font-weight:600;color:#5b6170;">Message</span>
  <textarea class="el-field__input" rows="4" placeholder="Type your message…" style="font:14px/1.5 var(--font);color:#15171c;background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:var(--radius);padding:calc(var(--space)*1.1) calc(var(--space)*1.25);outline:none;resize:vertical;"></textarea>
</label>`,
  },
  {
    id: "checkbox", label: "Checkbox", category: "Forms", keywords: ["check", "toggle", "option", "form"], icon: "check",
    html: `<!-- Checkbox + label -->
<label class="el-check" data-ed="Checkbox" data-comp="Checkbox" style="display:inline-flex;align-items:center;gap:calc(var(--space));font-family:var(--font);font-size:14px;color:#15171c;cursor:pointer;">
  <input type="checkbox" checked style="width:16px;height:16px;accent-color:var(--accent);" />
  <span>I agree to the terms</span>
</label>`,
  },
  {
    id: "radio", label: "Radio group", category: "Forms", keywords: ["option", "choice", "form", "select"], icon: "dot",
    html: `<!-- Radio group -->
<div class="el-radio" data-ed="Radio group" data-comp="Radio group" style="display:flex;flex-direction:column;gap:calc(var(--space));font-family:var(--font);font-size:14px;color:#15171c;">
  <label style="display:inline-flex;align-items:center;gap:calc(var(--space));cursor:pointer;"><input type="radio" name="opt" checked style="accent-color:var(--accent);" /> Option one</label>
  <label style="display:inline-flex;align-items:center;gap:calc(var(--space));cursor:pointer;"><input type="radio" name="opt" style="accent-color:var(--accent);" /> Option two</label>
</div>`,
  },
  {
    id: "select", label: "Select", category: "Forms", keywords: ["dropdown", "field", "options", "form"], icon: "chevronDown",
    html: `<!-- Select field -->
<label class="el-field" data-ed="Select" data-comp="Select" style="display:flex;flex-direction:column;gap:calc(var(--space)*.75);font-family:var(--font);max-width:280px;">
  <span class="el-field__label" style="font-size:12px;font-weight:600;color:#5b6170;">Plan</span>
  <select class="el-field__input" style="font:14px/1.2 var(--font);color:#15171c;background:#fff;border:1px solid rgba(0,0,0,.15);border-radius:var(--radius);padding:calc(var(--space)*1.1) calc(var(--space)*1.25);outline:none;cursor:pointer;"><option>Starter</option><option>Pro</option><option>Enterprise</option></select>
</label>`,
  },
  {
    id: "form", label: "Form", category: "Forms", keywords: ["signup", "login", "contact", "fields"], icon: "newFile", defaultContainer: true,
    html: `<!-- Form: stacked fields + submit -->
<form class="el-form" data-ed="Form" data-comp="Form" style="display:flex;flex-direction:column;gap:calc(var(--space)*1.5);font-family:var(--font);max-width:360px;padding:calc(var(--space)*2.5);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);">
  <label style="display:flex;flex-direction:column;gap:calc(var(--space)*.5);"><span style="font-size:12px;font-weight:600;color:#5b6170;">Name</span><input style="font:14px/1.2 var(--font);border:1px solid rgba(0,0,0,.15);border-radius:var(--radius);padding:calc(var(--space)*1.1);outline:none;" /></label>
  <label style="display:flex;flex-direction:column;gap:calc(var(--space)*.5);"><span style="font-size:12px;font-weight:600;color:#5b6170;">Email</span><input type="email" style="font:14px/1.2 var(--font);border:1px solid rgba(0,0,0,.15);border-radius:var(--radius);padding:calc(var(--space)*1.1);outline:none;" /></label>
  <button type="button" style="font:600 14px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)*1.25);border-radius:var(--radius);cursor:pointer;">Submit</button>
</form>`,
  },

  // ── Layout ──────────────────────────────────────────────────────────────────────────────────────
  {
    id: "container", label: "Container", category: "Layout", keywords: ["box", "section", "wrapper", "div"], icon: "split", defaultContainer: true,
    html: `<!-- Generic container --><div class="el-container" data-ed="Container" data-comp="Container" style="font-family:var(--font);padding:calc(var(--space)*2);border:1px dashed rgba(0,0,0,.18);border-radius:var(--radius);min-height:80px;"></div>`,
  },
  {
    id: "grid", label: "Grid container", category: "Layout", keywords: ["columns", "responsive", "gallery", "cards"], icon: "grid", defaultContainer: true,
    html: `<!-- Responsive auto-fit grid — drop elements into the cells -->
<div class="el-grid" data-ed="Grid" data-comp="Grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:calc(var(--space)*2);padding:calc(var(--space)*2);font-family:var(--font);">
  <div class="el-grid__cell" style="min-height:120px;background:rgba(0,0,0,.03);border-radius:var(--radius);"></div>
  <div class="el-grid__cell" style="min-height:120px;background:rgba(0,0,0,.03);border-radius:var(--radius);"></div>
  <div class="el-grid__cell" style="min-height:120px;background:rgba(0,0,0,.03);border-radius:var(--radius);"></div>
</div>`,
  },
  {
    id: "stack-flex", label: "Stack (flex)", category: "Layout", keywords: ["flex", "row", "column", "hstack", "vstack"], icon: "collapse", defaultContainer: true,
    html: `<!-- Flex row — drop elements inline -->
<div class="el-stack" data-ed="Stack" data-comp="Flex stack" style="display:flex;align-items:center;gap:calc(var(--space)*1.5);padding:calc(var(--space)*1.5);font-family:var(--font);flex-wrap:wrap;">
  <div style="min-width:60px;min-height:48px;background:rgba(0,0,0,.03);border-radius:var(--radius);"></div>
  <div style="min-width:60px;min-height:48px;background:rgba(0,0,0,.03);border-radius:var(--radius);"></div>
</div>`,
  },

  // ── Navigation ──────────────────────────────────────────────────────────────────────────────────
  {
    id: "navbar", label: "Navbar", category: "Navigation", keywords: ["nav", "menu", "topbar", "header"], icon: "panelBottom", defaultContainer: true,
    html: `<!-- Top navigation bar -->
<nav class="el-navbar" data-ed="Navbar" data-comp="Navbar" style="display:flex;align-items:center;justify-content:space-between;gap:calc(var(--space)*2);padding:calc(var(--space)*1.5) calc(var(--space)*2.5);font-family:var(--font);background:#fff;border-bottom:1px solid rgba(0,0,0,.08);">
  <span style="font-weight:800;font-size:16px;color:#15171c;">Brand</span>
  <div style="display:flex;gap:calc(var(--space)*2);font-size:14px;color:#5b6170;"><span>Features</span><span>Pricing</span><span>About</span></div>
  <button style="font:600 13px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)) calc(var(--space)*1.75);border-radius:var(--radius);cursor:pointer;">Sign in</button>
</nav>`,
  },
  {
    id: "sidebar", label: "Sidebar", category: "Navigation", keywords: ["nav", "menu", "drawer", "rail"], icon: "sidebarIcon", defaultContainer: true,
    html: `<!-- Side navigation -->
<aside class="el-sidebar" data-ed="Sidebar" data-comp="Sidebar" style="display:flex;flex-direction:column;gap:calc(var(--space)*.5);width:220px;padding:calc(var(--space)*2);font-family:var(--font);background:#fff;border-right:1px solid rgba(0,0,0,.08);">
  <span style="font-weight:800;font-size:15px;color:#15171c;margin-bottom:calc(var(--space));">Brand</span>
  <a style="padding:calc(var(--space)) calc(var(--space)*1.25);border-radius:var(--radius);color:var(--accent-fg);background:var(--accent);font-size:14px;text-decoration:none;">Dashboard</a>
  <a style="padding:calc(var(--space)) calc(var(--space)*1.25);border-radius:var(--radius);color:#5b6170;font-size:14px;text-decoration:none;">Projects</a>
  <a style="padding:calc(var(--space)) calc(var(--space)*1.25);border-radius:var(--radius);color:#5b6170;font-size:14px;text-decoration:none;">Settings</a>
</aside>`,
  },
  {
    id: "tabs", label: "Tabs", category: "Navigation", keywords: ["tab", "segmented", "switcher"], icon: "split",
    html: `<!-- Tab strip -->
<div class="el-tabs" data-ed="Tabs" data-comp="Tabs" style="display:inline-flex;gap:4px;padding:4px;font-family:var(--font);background:rgba(0,0,0,.04);border-radius:var(--radius);">
  <button style="font:600 13px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)) calc(var(--space)*1.5);border-radius:calc(var(--radius)*.8);cursor:pointer;">Overview</button>
  <button style="font:600 13px/1 var(--font);color:#5b6170;background:transparent;border:none;padding:calc(var(--space)) calc(var(--space)*1.5);border-radius:calc(var(--radius)*.8);cursor:pointer;">Activity</button>
  <button style="font:600 13px/1 var(--font);color:#5b6170;background:transparent;border:none;padding:calc(var(--space)) calc(var(--space)*1.5);border-radius:calc(var(--radius)*.8);cursor:pointer;">Settings</button>
</div>`,
  },
  {
    id: "dropdown", label: "Dropdown menu", category: "Navigation", keywords: ["menu", "popover", "select", "actions"], icon: "chevronDown",
    html: `<!-- Dropdown menu -->
<div class="el-dropdown" data-ed="Dropdown" data-comp="Dropdown menu" style="display:inline-flex;flex-direction:column;min-width:180px;font-family:var(--font);background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:var(--radius);box-shadow:0 12px 32px -10px rgba(0,0,0,.25);overflow:hidden;">
  <button style="text-align:left;font:500 14px/1 var(--font);color:#15171c;background:none;border:none;padding:calc(var(--space)*1.25) calc(var(--space)*1.5);cursor:pointer;">Edit</button>
  <button style="text-align:left;font:500 14px/1 var(--font);color:#15171c;background:none;border:none;padding:calc(var(--space)*1.25) calc(var(--space)*1.5);cursor:pointer;">Duplicate</button>
  <button style="text-align:left;font:500 14px/1 var(--font);color:#c0392b;background:none;border:none;padding:calc(var(--space)*1.25) calc(var(--space)*1.5);cursor:pointer;">Delete</button>
</div>`,
  },

  // ── Feedback ────────────────────────────────────────────────────────────────────────────────────
  {
    id: "alert", label: "Alert", category: "Feedback", keywords: ["banner", "notice", "message", "toast"], icon: "warn",
    html: `<!-- Inline alert -->
<div class="el-alert" data-ed="Alert" data-comp="Alert" style="display:flex;align-items:center;gap:calc(var(--space)*1.25);font-family:var(--font);padding:calc(var(--space)*1.25) calc(var(--space)*1.75);background:color-mix(in srgb,var(--accent) 12%,#fff);border:1px solid var(--accent);border-radius:var(--radius);color:#15171c;font-size:14px;">
  <span style="font-weight:700;color:var(--accent);">!</span><span>Heads up — this is an important message.</span>
</div>`,
  },
  {
    id: "tooltip", label: "Tooltip", category: "Feedback", keywords: ["hint", "bubble", "popover"], icon: "chat", defaultMode: "free",
    html: `<!-- Tooltip bubble --><span class="el-tooltip" data-ed="Tooltip" data-comp="Tooltip" style="display:inline-block;font:500 12px/1.3 var(--font);color:#fff;background:#15171c;padding:calc(var(--space)*.75) calc(var(--space)*1.25);border-radius:calc(var(--radius)*.7);box-shadow:0 6px 18px -6px rgba(0,0,0,.4);">Tooltip text</span>`,
  },
  {
    id: "progress-bar", label: "Progress bar", category: "Feedback", keywords: ["progress", "loading", "meter", "bar"], icon: "pulse",
    html: `<!-- Progress bar (66% filled) --><div class="el-progress" data-ed="Progress bar" data-comp="Progress bar" style="width:280px;height:12px;background:rgba(0,0,0,.1);border-radius:999px;overflow:hidden;display:block;"><div class="el-progress__fill" style="display:block;width:66%;min-width:8px;height:100%;background:var(--accent,#6366f1);border-radius:999px;"></div></div>`,
  },
  {
    id: "loading-state", label: "Loading state", category: "Feedback", keywords: ["spinner", "skeleton", "loading", "shimmer"], icon: "refresh",
    html: `<!-- Skeleton loading rows -->
<div class="el-loading" data-ed="Loading state" data-comp="Loading state" style="display:flex;flex-direction:column;gap:calc(var(--space)*1.25);width:320px;font-family:var(--font);">
  <div style="height:14px;width:70%;background:rgba(0,0,0,.08);border-radius:6px;"></div>
  <div style="height:14px;width:90%;background:rgba(0,0,0,.08);border-radius:6px;"></div>
  <div style="height:14px;width:55%;background:rgba(0,0,0,.08);border-radius:6px;"></div>
</div>`,
  },
  {
    id: "empty-state", label: "Empty state", category: "Feedback", keywords: ["placeholder", "nothing", "blank", "zero"], icon: "inbox", defaultContainer: true,
    html: `<!-- Empty state -->
<div class="el-empty" data-ed="Empty state" data-comp="Empty state" style="display:flex;flex-direction:column;align-items:center;gap:calc(var(--space)*1.25);text-align:center;padding:calc(var(--space)*4);font-family:var(--font);color:#5b6170;">
  <div style="width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--accent) 14%,#fff);display:grid;place-items:center;color:var(--accent);font-size:22px;">+</div>
  <div style="font-size:16px;font-weight:700;color:#15171c;">Nothing here yet</div>
  <div style="font-size:13px;max-width:36ch;">Create your first item to get started.</div>
  <button style="font:600 13px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)) calc(var(--space)*2);border-radius:var(--radius);cursor:pointer;">Create</button>
</div>`,
  },

  // ── Data ────────────────────────────────────────────────────────────────────────────────────────
  {
    id: "table", label: "Table", category: "Data", keywords: ["grid", "rows", "data", "spreadsheet"], icon: "grid",
    html: `<!-- Data table -->
<table class="el-table" data-ed="Table" data-comp="Table" style="border-collapse:collapse;font-family:var(--font);font-size:14px;color:#15171c;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);overflow:hidden;min-width:360px;">
  <thead><tr style="background:rgba(0,0,0,.03);text-align:left;color:#5b6170;font-size:12px;"><th style="padding:calc(var(--space)) calc(var(--space)*1.5);">Name</th><th style="padding:calc(var(--space)) calc(var(--space)*1.5);">Status</th><th style="padding:calc(var(--space)) calc(var(--space)*1.5);">Date</th></tr></thead>
  <tbody>
    <tr style="border-top:1px solid rgba(0,0,0,.06);"><td style="padding:calc(var(--space)) calc(var(--space)*1.5);">Item one</td><td style="padding:calc(var(--space)) calc(var(--space)*1.5);color:var(--accent);">Active</td><td style="padding:calc(var(--space)) calc(var(--space)*1.5);">Jun 25</td></tr>
    <tr style="border-top:1px solid rgba(0,0,0,.06);"><td style="padding:calc(var(--space)) calc(var(--space)*1.5);">Item two</td><td style="padding:calc(var(--space)) calc(var(--space)*1.5);color:#5b6170;">Pending</td><td style="padding:calc(var(--space)) calc(var(--space)*1.5);">Jun 24</td></tr>
  </tbody>
</table>`,
  },
  {
    id: "list", label: "List", category: "Data", keywords: ["items", "ul", "rows", "menu"], icon: "collapse", defaultContainer: true,
    html: `<!-- Item list -->
<ul class="el-list" data-ed="List" data-comp="List" style="list-style:none;margin:0;padding:0;font-family:var(--font);font-size:14px;color:#15171c;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);overflow:hidden;min-width:280px;">
  <li style="padding:calc(var(--space)*1.25) calc(var(--space)*1.5);">First item</li>
  <li style="padding:calc(var(--space)*1.25) calc(var(--space)*1.5);border-top:1px solid rgba(0,0,0,.06);">Second item</li>
  <li style="padding:calc(var(--space)*1.25) calc(var(--space)*1.5);border-top:1px solid rgba(0,0,0,.06);">Third item</li>
</ul>`,
  },
  {
    id: "mock-chart", label: "Chart (mock)", category: "Data", keywords: ["graph", "bars", "analytics", "stats"], icon: "pulse",
    html: `<!-- Mock bar chart -->
<div class="el-chart" data-ed="Chart" data-comp="Mock chart" style="display:flex;align-items:flex-end;gap:calc(var(--space)*1.25);height:160px;padding:calc(var(--space)*1.5);font-family:var(--font);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);">
  <div style="width:28px;height:40%;background:color-mix(in srgb,var(--accent) 45%,#fff);border-radius:6px 6px 0 0;"></div>
  <div style="width:28px;height:70%;background:color-mix(in srgb,var(--accent) 65%,#fff);border-radius:6px 6px 0 0;"></div>
  <div style="width:28px;height:55%;background:color-mix(in srgb,var(--accent) 55%,#fff);border-radius:6px 6px 0 0;"></div>
  <div style="width:28px;height:90%;background:var(--accent);border-radius:6px 6px 0 0;"></div>
  <div style="width:28px;height:65%;background:color-mix(in srgb,var(--accent) 60%,#fff);border-radius:6px 6px 0 0;"></div>
</div>`,
  },

  // ── Cards ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: "card", label: "Card", category: "Cards", keywords: ["panel", "surface", "tile"], icon: "doc", defaultContainer: true,
    html: `<!-- Content card -->
<article class="el-card" data-ed="Card" data-comp="Card" style="font-family:var(--font);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);padding:calc(var(--space)*2.5);display:flex;flex-direction:column;gap:calc(var(--space)*1.5);max-width:360px;">
  <h3 style="margin:0;font-size:18px;font-weight:700;color:#15171c;">Card title</h3>
  <p style="margin:0;font-size:14px;line-height:1.5;color:#5b6170;">Supporting copy that explains the card in one or two short sentences.</p>
  <button style="align-self:flex-start;font:600 13px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)) calc(var(--space)*1.75);border-radius:var(--radius);cursor:pointer;">Learn more</button>
</article>`,
  },
  {
    id: "pricing-card", label: "Pricing card", category: "Cards", keywords: ["plan", "tier", "price", "subscribe"], icon: "coins", defaultContainer: true,
    html: `<!-- Pricing card -->
<article class="el-pricing" data-ed="Pricing card" data-comp="Pricing card" style="font-family:var(--font);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);padding:calc(var(--space)*3);display:flex;flex-direction:column;gap:calc(var(--space)*1.5);max-width:300px;text-align:center;">
  <span style="font-size:13px;font-weight:700;color:var(--accent);letter-spacing:.04em;text-transform:uppercase;">Pro</span>
  <div style="font-size:40px;font-weight:800;color:#15171c;">$29<span style="font-size:15px;font-weight:500;color:#5b6170;">/mo</span></div>
  <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--space));font-size:14px;color:#5b6170;text-align:left;"><li>✓ Everything in Starter</li><li>✓ Unlimited projects</li><li>✓ Priority support</li></ul>
  <button style="font:600 14px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)*1.25);border-radius:var(--radius);cursor:pointer;">Choose Pro</button>
</article>`,
  },

  // ── Modals ──────────────────────────────────────────────────────────────────────────────────────
  {
    id: "modal", label: "Modal", category: "Modals", keywords: ["dialog", "popup", "overlay", "sheet"], icon: "split", defaultMode: "free", defaultContainer: true,
    html: `<!-- Modal dialog (positioned freely; wrap with an overlay if needed) -->
<div class="el-modal" data-ed="Modal" data-comp="Modal" style="width:420px;max-width:90vw;font-family:var(--font);background:#fff;border-radius:calc(var(--radius)*1.3);box-shadow:0 30px 80px -20px rgba(0,0,0,.45);padding:calc(var(--space)*3);display:flex;flex-direction:column;gap:calc(var(--space)*2);">
  <h3 style="margin:0;font-size:20px;font-weight:800;color:#15171c;">Dialog title</h3>
  <p style="margin:0;font-size:14px;line-height:1.6;color:#5b6170;">Describe the action the user is confirming, in one or two sentences.</p>
  <div style="display:flex;gap:calc(var(--space)*1.25);justify-content:flex-end;">
    <button style="font:600 14px/1 var(--font);color:#5b6170;background:transparent;border:1px solid rgba(0,0,0,.15);padding:calc(var(--space)) calc(var(--space)*1.75);border-radius:var(--radius);cursor:pointer;">Cancel</button>
    <button style="font:600 14px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)) calc(var(--space)*1.75);border-radius:var(--radius);cursor:pointer;">Confirm</button>
  </div>
</div>`,
  },

  // ── Sections ────────────────────────────────────────────────────────────────────────────────────
  {
    id: "header", label: "Header", category: "Sections", keywords: ["top", "masthead", "banner"], icon: "panelBottom", defaultContainer: true,
    html: `<!-- Page header -->
<header class="el-header" data-section="header" data-ed="Header" data-comp="Header" style="display:flex;flex-direction:column;gap:calc(var(--space));padding:calc(var(--space)*3) calc(var(--space)*3);font-family:var(--font);">
  <h1 style="margin:0;font-size:clamp(26px,4vw,38px);font-weight:800;color:#15171c;">Page title</h1>
  <p style="margin:0;font-size:15px;color:#5b6170;">A short description of what this page is about.</p>
</header>`,
  },
  {
    id: "footer", label: "Footer", category: "Sections", keywords: ["bottom", "links", "copyright"], icon: "panelBottom", defaultContainer: true,
    html: `<!-- Page footer -->
<footer class="el-footer" data-section="footer" data-ed="Footer" data-comp="Footer" style="display:flex;align-items:center;justify-content:space-between;gap:calc(var(--space)*2);flex-wrap:wrap;padding:calc(var(--space)*3);font-family:var(--font);font-size:13px;color:#5b6170;border-top:1px solid rgba(0,0,0,.08);">
  <span>© 2026 Brand. All rights reserved.</span>
  <div style="display:flex;gap:calc(var(--space)*2);"><span>Privacy</span><span>Terms</span><span>Contact</span></div>
</footer>`,
  },
  {
    id: "hero", label: "Hero section", category: "Sections", keywords: ["landing", "banner", "headline", "cta"], icon: "skill", defaultContainer: true,
    html: `<!-- Hero: headline + subcopy + CTA pair -->
<section class="el-hero" data-section="hero" data-ed="Hero" data-comp="Hero" style="font-family:var(--font);text-align:center;padding:calc(var(--space)*8) calc(var(--space)*3);display:flex;flex-direction:column;align-items:center;gap:calc(var(--space)*2.5);">
  <h1 style="margin:0;font-size:clamp(32px,5vw,56px);font-weight:800;color:#15171c;max-width:14ch;line-height:1.05;">Build it before you build it</h1>
  <p style="margin:0;font-size:clamp(15px,2vw,19px);color:#5b6170;max-width:48ch;line-height:1.5;">Prototype the whole product visually, then hand off a pixel-exact reference.</p>
  <div style="display:flex;gap:calc(var(--space)*1.25);flex-wrap:wrap;justify-content:center;">
    <button style="font:600 15px/1 var(--font);color:var(--accent-fg);background:var(--accent);border:none;padding:calc(var(--space)*1.4) calc(var(--space)*3);border-radius:var(--radius);cursor:pointer;">Start free</button>
    <button style="font:600 15px/1 var(--font);color:var(--accent);background:transparent;border:1px solid var(--accent);padding:calc(var(--space)*1.4) calc(var(--space)*3);border-radius:var(--radius);cursor:pointer;">Watch demo</button>
  </div>
</section>`,
  },
  {
    id: "custom-section", label: "Custom section", category: "Sections", keywords: ["block", "region", "container", "section"], icon: "split", defaultContainer: true,
    html: `<!-- Custom section — drop anything inside --><section class="el-section" data-section="custom" data-ed="Section" data-comp="Section" style="font-family:var(--font);padding:calc(var(--space)*5) calc(var(--space)*3);display:flex;flex-direction:column;gap:calc(var(--space)*2);min-height:120px;"></section>`,
  },

  // ── Components ──────────────────────────────────────────────────────────────────────────────────
  {
    id: "reusable-component", label: "Reusable component", category: "Components", keywords: ["block", "module", "widget", "slot"], icon: "skill", defaultContainer: true,
    html: `<!-- Reusable component slot --><div class="el-component" data-ed="Component" data-comp="Reusable component" style="font-family:var(--font);padding:calc(var(--space)*2);border:1.5px dashed var(--accent);border-radius:var(--radius);color:var(--accent);font-size:13px;font-weight:600;display:grid;place-items:center;min-height:72px;">Reusable component</div>`,
  },

  // ── Media ───────────────────────────────────────────────────────────────────────────────────────
  {
    id: "image", label: "Image", category: "Media", keywords: ["img", "photo", "picture", "media"], icon: "files",
    html: `<!-- Image placeholder (use the panel's Upload image to set a real picture) --><div class="el-image" data-ed="Image" data-comp="Image" style="width:280px;height:180px;background:repeating-linear-gradient(45deg,rgba(0,0,0,.04),rgba(0,0,0,.04) 10px,rgba(0,0,0,.07) 10px,rgba(0,0,0,.07) 20px);border-radius:var(--radius);display:grid;place-items:center;font-family:var(--font);font-size:13px;color:#5b6170;">Image</div>`,
  },
  // Icon set (stroke icons, themed via --accent). Upload a custom one via the panel's Upload image.
  { id: "icon-check", label: "Icon · Check", category: "Media", keywords: ["icon", "svg", "check", "done", "tick"], icon: "check",
    html: `<svg class="el-icon" data-ed="Check icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>` },
  { id: "icon-heart", label: "Icon · Heart", category: "Media", keywords: ["icon", "svg", "heart", "like", "love"], icon: "skill",
    html: `<svg class="el-icon" data-ed="Heart icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7.5-4.6-7.5-10A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/></svg>` },
  { id: "icon-search", label: "Icon · Search", category: "Media", keywords: ["icon", "svg", "search", "find", "magnify"], icon: "search",
    html: `<svg class="el-icon" data-ed="Search icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>` },
  { id: "icon-user", label: "Icon · User", category: "Media", keywords: ["icon", "svg", "user", "person", "account", "profile"], icon: "account",
    html: `<svg class="el-icon" data-ed="User icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>` },
  { id: "icon-bell", label: "Icon · Bell", category: "Media", keywords: ["icon", "svg", "bell", "notification", "alert"], icon: "bell",
    html: `<svg class="el-icon" data-ed="Bell icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16H6c1.3-1.3 2-3 2-5a4 4 0 0 1 8 0c0 2 .7 3.7 2 5z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>` },
  { id: "icon-arrow", label: "Icon · Arrow", category: "Media", keywords: ["icon", "svg", "arrow", "right", "next"], icon: "goto",
    html: `<svg class="el-icon" data-ed="Arrow icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>` },
  { id: "icon-plus", label: "Icon · Plus", category: "Media", keywords: ["icon", "svg", "plus", "add", "new"], icon: "add",
    html: `<svg class="el-icon" data-ed="Plus icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>` },
  { id: "icon-home", label: "Icon · Home", category: "Media", keywords: ["icon", "svg", "home", "house"], icon: "grid",
    html: `<svg class="el-icon" data-ed="Home icon" data-comp="Icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent,#6366f1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10V20h13V10"/></svg>` },

  // ── Interactions ────────────────────────────────────────────────────────────────────────────────
  {
    id: "accordion", label: "Accordion", category: "Interactions", keywords: ["collapse", "expand", "faq", "disclosure"], icon: "chevronDown", defaultContainer: true,
    html: `<!-- Accordion -->
<div class="el-accordion" data-ed="Accordion" data-comp="Accordion" style="font-family:var(--font);background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:var(--radius);overflow:hidden;min-width:340px;">
  <details open style="border-bottom:1px solid rgba(0,0,0,.06);"><summary style="padding:calc(var(--space)*1.5);font-weight:600;font-size:14px;color:#15171c;cursor:pointer;">First question</summary><div style="padding:0 calc(var(--space)*1.5) calc(var(--space)*1.5);font-size:14px;line-height:1.5;color:#5b6170;">Answer to the first question goes here.</div></details>
  <details><summary style="padding:calc(var(--space)*1.5);font-weight:600;font-size:14px;color:#15171c;cursor:pointer;">Second question</summary><div style="padding:0 calc(var(--space)*1.5) calc(var(--space)*1.5);font-size:14px;line-height:1.5;color:#5b6170;">Answer to the second question goes here.</div></details>
</div>`,
  },
];

/** Filter by category + free-text query (id / label / category / keywords). Used by the Add rail tab. */
export function searchTemplates(query: string, category: ElementCategory | "All"): ElementTemplate[] {
  const q = query.trim().toLowerCase();
  return ELEMENT_TEMPLATES.filter((t) => {
    if (category !== "All" && t.category !== category) return false;
    if (!q) return true;
    return (
      t.label.toLowerCase().includes(q) ||
      t.id.includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q))
    );
  });
}
