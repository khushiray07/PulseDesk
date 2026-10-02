---
name: Clarity Support System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#3130c0'
  on-tertiary: '#ffffff'
  tertiary-container: '#4b4dd8'
  on-tertiary-container: '#d9d8ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  code-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for dense, mission-critical customer operations and support workflows. The brand posture balances resolute engineering dependability with modern digital craftsmanship. It conveys calm authority, extreme legibility, and responsive speed under heavy cognitive load. 

The aesthetic is Modern Corporate with high-precision structural utility. It pairs crisp, low-contrast boundaries and structured layout density with balanced semantic status accents. The visual hierarchy minimizes interface friction: ambient metadata steps into the background, while real-time ticket states, customer urgency levels, and core metrics command direct attention. 

Visual characteristics include:
- Crisp geometric structures with intentional 1px division lines.
- High-efficiency spacing tailored for high-information density without visual crowding.
- Purposeful status signaling that avoids decorative clutter and prevents alert fatigue.

## Colors

The palette operates on a high-contrast foundation of deep slate navies, clean cool-tinted paper neutrals, and vivid indigo action accents. Semantic tokens ensure that operational status and priority values are instantly identifiable across tables, lists, and card headers.

### Core Canvas & Structure
- **Surface Canvas**: `#f8fafc` (Slate 50) provides a soft, low-glare backdrop for large desktop monitors.
- **Surface Card / Elevation**: `#ffffff` (Pure White) defines interactive cards, panel surfaces, and modal overlays.
- **Divider & Border**: `#e2e8f0` (Slate 200) sets subtle, deterministic boundaries between data cells and panel sections.
- **Text Primary**: `#0f172a` (Slate 900) ensures maximum contrast for titles, primary ticket labels, and data fields.
- **Text Secondary / Muted**: `#64748b` (Slate 500) supports timestamps, metadata identifiers, and empty states.

### Primary Accents
- **Primary Brand / Action**: `#4f46e5` (Indigo 600) for primary buttons, focus rings, active navigation items, and link states.
- **Interactive Hover**: `#4338ca` (Indigo 700).
- **Primary Light (Tints)**: `#eef2ff` (Indigo 50) for selected row highlights and subtle active pills.

### Semantic Workflow Status Tokens
- **Open**: Accent `#d97706` (Amber 600) on Surface `#fef3c7` (Amber 100).
- **In Progress**: Accent `#2563eb` (Blue 600) on Surface `#dbeafe` (Blue 100).
- **Resolved / Success**: Accent `#059669` (Emerald 600) on Surface `#d1fae5` (Emerald 100).
- **Closed / Muted**: Accent `#475569` (Slate 600) on Surface `#f1f5f9` (Slate 100).

### Priority Level Tokens
- **Urgent / Critical**: `#e11d48` (Rose 600) with soft surface `#ffe4e6` (Rose 100).
- **Medium**: `#d97706` (Amber 600) with soft surface `#fef3c7` (Amber 100).
- **Low**: `#64748b` (Slate 500) with soft surface `#f1f5f9` (Slate 100).

## Typography

The type system blends the contemporary, geometric personality of **Plus Jakarta Sans** for structural headers and numerical metrics with the hyper-legible, utilitarian neutrality of **Inter** for dense transactional UI, ticket transcripts, and data tables.

- **KPI Numerical Treatment**: Metric summaries pair `display-lg` with tight negative tracking (`-0.025em`) to emphasize velocity and volume without horizontal bloat.
- **Metadata and Badges**: Status badges, table column headers, and timestamp labels use `label-xs` and `label-sm` with slight positive tracking to preserve edge clarity at smaller point sizes.
- **Tabular Alignment**: All numeric data across ticket queues, time counters, and customer IDs must implement tabular figures (`font-variant-numeric: tabular-nums`) to prevent optical jitter during live refreshes.

## Layout & Spacing

The layout is built on a 12-column fluid grid system pinned inside a flexible viewport frame, anchored by a persistent narrow sidebar on the left and an optional conversational inspector drawer on the right.

### Responsive Breakpoints & Viewport Rules
- **Desktop (1280px and above)**: Full 12-column grid with `gutter-lg` (24px) and outer margin `margin-lg` (32px). Allows side-by-side presentation of metrics, ticket listing tables, and preview side-panels.
- **Tablet (768px – 1279px)**: Collapses secondary sidebars into overlay sheets; uses `gutter` (16px) and `margin-md` (24px). Multi-column metric grids collapse from 4 columns to 2.
- **Mobile (below 768px)**: Canvas margins drop to `margin` (16px) with an adaptive 4-column flow. Tables shift into stacked card structures, and horizontal overflow tables gain fixed column indicators.

### Vertical Rhythm
Layouts adhere to an 8px base rhythm (with a 4px sub-step for compact components like badges and action chips). Data tables operate with strict row heights: 44px for high-density monitoring and 56px for standard ticket queues containing multi-line previews.

## Elevation & Depth

Visual hierarchy uses a refined hybrid of crisp 1px structural outlines (`#e2e8f0`) and subtle, cool-slate ambient shadows. This keeps the workspace flat and clean, reserving elevation strictly to signify focus, overlays, and drag states.

- **Level 0 (Flat Surface)**: Used by background canvases and recessed form sections (`#f8fafc`).
- **Level 1 (Card / Container Base)**: `#ffffff` surface enclosed with a 1px border of `#e2e8f0` and an ultra-subtle ambient shadow (`0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`). Used for KPI cards and data table shells.
- **Level 2 (Hover & Focus States)**: Raised card interaction with `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` and a border transition to `#cbd5e1`.
- **Level 3 (Dropdowns & Popovers)**: Floating filters and combobox menus use `box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)`.
- **Level 4 (Modals & Sliding Drawers)**: High-priority dialogue overlays use `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)` atop an ambient backdrop scrim (`rgba(15, 23, 42, 0.4)` with 4px backdrop blur).

## Shapes

The design system adopts a balanced roundedness model (`level 2`, 8px base border-radius). This provides a modern, approachable software feel while maintaining the clean geometry required for data alignment.

- **Standard Elements (8px / `0.5rem`)**: Applied to standard buttons, text input fields, KPI metric cards, data container panels, and dropdown menus.
- **Sub-components (4px / `0.25rem`)**: Applied to checkboxes, inner segmented controls, status tags, and inline badges.
- **Large Cards & Modals (12px / `0.75rem` - 16px / `1rem`)**: Applied to dialog windows, modal sheets, and slide-in panels.
- **Full Radius (9999px / Pill)**: Strictly reserved for count badges, urgency indicators, and customer avatar rings.

## Components

### Buttons
- **Primary**: Solid `#4f46e5` background with pure white text and an 8px border-radius. In hover state, transitions to `#4338ca`. Focused buttons show a crisp 2px offset ring (`ring-2 ring-indigo-500 ring-offset-2`).
- **Secondary / Outline**: `#ffffff` background with 1px border in `#e2e8f0` and `#0f172a` text. Hover brings `#f8fafc` background with `#cbd5e1` border.
- **Ghost / Action**: Transparent background with `#64748b` text; transitions to `#f1f5f9` on hover. Used for bulk action bars and secondary table utilities.
- **Destructive**: Rose tint base (`#ffe4e6`) with `#e11d48` text; transitions to solid `#e11d48` with white text for critical actions.

### Badges & Semantic Chips
- **Status Badges**: Pill-shaped or 4px rounded tags using a subtle background tint and dark foreground text. Includes a 6px solid colored circular indicator icon to reinforce meaning for color-blind users:
  - *Open*: Amber-100 bg (`#fef3c7`), Amber-800 text (`#92400e`).
  - *In Progress*: Blue-100 bg (`#dbeafe`), Blue-800 text (`#1e40af`).
  - *Resolved*: Emerald-100 bg (`#d1fae5`), Emerald-800 text (`#065f46`).
- **Priority Indicator**: Displayed as a compact badge with a high-contrast dot or an upward chevron for *Urgent* (`#e11d48`), horizontal dash for *Medium* (`#d97706`), and down chevron for *Low* (`#64748b`).

### Data Tables
- **Header**: Sticky `#f8fafc` surface with 1px bottom border in `#e2e8f0`. Labels styled with `label-xs` uppercase in `#64748b`.
- **Rows**: Alternating white background with a `#f8fafc` hover fill. Leftmost 3px border lights up in `#4f46e5` when a row is selected.
- **Cell Padding**: 12px vertical padding on compact views, 16px on standard views, with 16px horizontal gutters.

### KPI Summary Cards
- **Structure**: Surface white, bordered by `#e2e8f0`, padded with `space-lg` (24px).
- **Layout**: Top row features title (`label-md` in `#64748b`) paired with a lightweight contextual icon. Middle row showcases the primary figure in `display-lg` (`#0f172a`). Bottom row shows trending deltas: positive metrics in emerald green, negative or delayed metrics in rose red.

### Form Inputs & Filters
- **Input Fields**: 38px standard height, `#ffffff` surface, 1px `#e2e8f0` border, 8px border-radius, `body-md` typography.
- **Focus State**: 1px border color `#6366f1` paired with `0 0 0 3px rgba(99, 102, 241, 0.15)`.
- **Validation State**: Errored fields feature a `#e11d48` border, a light pink glow (`rgba(225, 29, 72, 0.12)`), and an accompanying inline error label in `body-sm`.
- **Search Bar**: Accompanied by a leading slate search icon and a trailing keyboard shortcut chip (`⌘K`) in `code-sm`.

### Checkboxes & Selection
- Custom 16x16px control with a 4px radius. Unchecked state uses a 1.5px `#cbd5e1` border over a white surface. Checked state transitions to solid `#4f46e5` fill with a white checkmark. Indeterminate states use a solid `#4f46e5` fill with a centered horizontal minus glyph.