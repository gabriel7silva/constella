/* The canvas ↔ agent contract (design-module/02-CONTRACT.md §1). The instrumented iframe emits this for
   the exact element the operator selected; the host shows it in the Inspector / Property panel and attaches
   it to the chat so Grace edits THAT element — never a vague textual description. Shared by the iframe script
   (canvas-instrument.ts), the host (design-room.tsx) and the server (design/actions.ts). */

/** The full editable style set the Property panel reads (current values) and writes (live). Every value is a
 *  CSS string exactly as `getComputedStyle` reports it, so the panel can show + round-trip it. Per-side spacing
 *  is included alongside the shorthand so the editor can target one side without clobbering the others. */
export interface EditableStyles {
  // Layout
  display: string; position: string; width: string; height: string;
  // Spacing (shorthand + per-side)
  margin: string; marginTop: string; marginRight: string; marginBottom: string; marginLeft: string;
  padding: string; paddingTop: string; paddingRight: string; paddingBottom: string; paddingLeft: string; gap: string;
  // Typography
  color: string; fontSize: string; fontWeight: string; lineHeight: string; letterSpacing: string; textAlign: string;
  // Appearance + effects
  background: string; border: string; borderRadius: string; boxShadow: string; opacity: string; zIndex: string;
}

/** A library element the operator inserts onto the canvas (Add Elements). The host posts this to the instrument,
 *  which parses the snippet, places it (flow-aware), selects it and persists — see canvas-instrument.ts `insertEl`. */
export interface InsertPayload {
  html: string;                  // self-contained, token-driven snippet — exactly ONE root element
  label: string;                 // data-ed label stamped on the root if it lacks one (Layers tree + Grace naming)
  mode?: "flow" | "free";        // "flow" (default) = append as a normal child; "free" = absolute at the drop point
  dropX?: number;                // drag-drop: iframe-internal client px (host already divided by the zoom factor)
  dropY?: number;
  intoCstlaId?: string | null;   // click-insert: the current selection to target (into it if a container, else after)
}

/** A saved custom element preset (Add panel · "My presets") — the operator's selected element captured as
 *  reusable clean HTML. Persisted in a workspace file by the design server actions. */
export interface DesignPreset { id: string; label: string; html: string }

export interface CanvasSelection {
  selectionId: string;        // ephemeral id, e.g. "sel_2k9f3a"
  cstlaId: string;            // STABLE id stamped on the element (data-cstla-id="c7") — the host targets live edits by this
  elementType: string;        // tag: div, button, span, input…
  componentName: string;      // logical component: Hero, Card, Botão, Navbar… (data-comp/data-ed/tag)
  domPath: string;            // "div › div·hero › button·Botão"
  boundingBox: { x: number; y: number; w: number; h: number }; // px, local to the canvas frame
  tx: number; ty: number;     // current transform:translate offset (the editable X / Y position)
  nodePath: string;           // stable child-index path (e.g. "0/2/1") — matches a Layers-tree item
  computedStyles: EditableStyles;
  textContent: string;        // node text, trimmed ~120 chars
  parentContainer: string;    // parent label/tag
  children: number;           // direct children count
  pageId: string;             // the active screen path/key
  sectionId: string;          // nearest [data-section]
  locked?: boolean;           // move/resize lock (data-cstla-lock) — the Element panel shows Lock/Unlock
  isGroup?: boolean;          // a <div data-cstla-group> wrapper → the Element panel offers Ungroup
}
