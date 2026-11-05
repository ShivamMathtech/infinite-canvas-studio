# Infinite Canvas Studio

A pen-tablet notebook for handwritten thinking. The first working release follows the agreed dark navigation, warm paper, and violet pen-tool design.

**Status: v0.1 foundation implementation.** The editor and local notebooks work without a backend. Advanced recognition and cloud features are still on the roadmap.

## What works

- Pressure-aware pen, adjustable stabilization, translucent highlighter, and stroke eraser.
- Page-scoped undo/redo, pan, cursor-anchored zoom, and fit-to-content.
- Notebook and page creation/renaming, page duplication, and confirmed page deletion.
- Rectangles, ellipses, lines, arrows, typed text, sticky notes, and object selection/movement.
- Layer selection, visibility, locking, and ordering.
- Dotted, ruled, graph, and plain paper.
- Local autosave in IndexedDB with save-error feedback and revision checks across tabs.
- Validated JSON backups and additive import that preserves existing notebooks.
- Full-content PNG and all-page notebook PDF export. Prepared exports have an explicit download link.
- Interactive presets for quadratic, sine, and linear graphs, with an editable coefficient.
- Focus mode, keyboard shortcuts, collapsible panels, and bundled local fonts.
- Editable sample notes, clearly marked as a sample notebook.

The mathematical content in the sample is prepared demo content, not handwriting recognized by an AI model.

## Run locally

Install **Node.js 24.x**. From this repository's root:

```sh
npm ci
npm run dev
```

Open the URL Vite prints in the terminal. On Windows, you can also run `start-windows.bat`; it installs dependencies if needed and starts Vite. Use `install-windows.bat` for a clean dependency reinstall.

No environment variables, account, API key, backend, or database server are required.

## Check the implementation

```sh
npm run check
```

This runs strict TypeScript checking, the behavioral tests, and a production build. The build output is `dist/`.

```sh
npm run preview
```

The preview command is for checking the built application locally.

## Deploy to Vercel

Import this repository into your Vercel account. Until the implementation pull request is merged, choose the `feat/canvas-foundation` branch when creating a preview deployment.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | Repository root |
| Node.js | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | None |

`vercel.json` includes the build settings and SPA fallback. See [deployment details](docs/DEPLOYMENT.md).

## A few shortcuts

| Action | Shortcut |
| --- | --- |
| Pen / highlighter / eraser | P / H / E |
| Select and move | V |
| Rectangle / ellipse / arrow / line | R / O / A / L |
| Text | T |
| Pan | Hold Space and drag; or use the hand tool |
| Zoom | Ctrl/Cmd + wheel; or the zoom buttons |
| Undo / redo | Ctrl/Cmd + Z / Ctrl/Cmd + Shift + Z |
| Focus mode | F |
| Delete selected object | Delete |
| Find a notebook/page | / |
| Save now | Ctrl/Cmd + S |

Shortcuts do not intercept text-entry fields. Touch gestures navigate the page; pen-only mode prevents mouse drawing. Pressure input depends on the tablet, driver, and browser.

## Your data

Notebooks live in this browser's IndexedDB for the current origin. They are not uploaded. Clearing site data, changing browser profiles, or moving to another domain does not carry those notebooks along.

Use **Export → Workspace backup** to keep a separate copy. **Import backup** adds notebooks rather than replacing existing ones. If another tab saves newer work, the editor stops automatic writes and offers backup and reload options.

The loaded editor can keep working without a backend or an active network connection. Offline reopening through a service worker is **not yet implemented**.

## Current limits

- This is the first functional milestone, not the complete advanced product.
- No handwriting-to-text/LaTeX recognition, arbitrary-expression parser, 3D graphs, PDF import, image import, cloud sync, accounts, or collaboration yet.
- Selection currently moves one object by its bounding box; freeform lasso, resize handles, and multi-selection are not implemented.
- Undo/redo history lasts for the current browser session. Deleted pages require a prior backup for recovery.
- PDF output rasterizes each page's visible content and fits it to one A4 sheet. Text is not selectable in the PDF. Very large infinite pages may be reduced in scale.
- Large-notebook stress tests, touch-device checks, and physical pen latency measurements are still required. No iPad performance comparison has been established.

See [validation notes](docs/VALIDATION.md), [module architecture](docs/ARCHITECTURE.md), and the full [development roadmap](docs/DEVELOPMENT_PLAN.md).
