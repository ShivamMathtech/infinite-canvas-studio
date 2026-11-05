# Infinite Canvas Studio — Development Plan

Status: the first working foundation is implemented on `feat/canvas-foundation`. See README.md and VALIDATION.md for implemented features and verification. The remaining milestones below are the continuing product roadmap; they are not all complete.

## Product goal

Build the pen-tablet workspace shown in the UI concept: a large writing canvas, notebook/page navigation, a compact pen toolbar, and contextual Assist, Layers, and Pen panels. Prioritize natural handwriting, dependable saving, and useful mathematical notes.

The core web application must work without a backend connection. Windows local use and Vercel hosting are the initial delivery targets. An installable offline web app is planned; a native desktop package is a later extension.

“More advanced” will mean useful, verified workflows. Smoothness will be measured on real pen-tablet hardware; no comparison with iPad latency is established.

## Architecture decisions

| Area | Planned approach | Reason |
| --- | --- | --- |
| Application UI | React, TypeScript with strict checking, Vite | Modular panels and a straightforward web build |
| Ink rendering | Dedicated Canvas 2D engine outside React's per-point state updates | Keep pointer processing independent from sidebar rendering |
| Input | Pointer Events, pressure where available, coalesced input with a feature-detected fallback | Preserve pen samples while supporting mouse and touch |
| Document model | Versioned notebooks, pages, ordered layers, and editable canvas objects | Support undo, migration, export, and later sync |
| Local storage | IndexedDB behind a storage interface | Store structured notebooks and binary attachments asynchronously |
| Offline app loading | Versioned service-worker cache after the first successful load | Reopen the core editor without a network connection |
| Graphs | Separate 2D plotting module and lazy-loaded WebGL 3D module | Avoid loading graph engines into the initial writing path |
| Mathematics | Formula editor/renderer, restricted expression parser, recognition adapter | Keep typed math usable independently of recognition |
| PDF workflow | PDF rendering module plus document-wide export module | Annotate documents and export all selected pages |
| Optional server | Server-side recognition proxy and optional authenticated cloud storage adapter | Keep credentials off the client and local writing independent |
| Delivery | GitHub source, automated checks, Windows instructions, Vercel configuration, source ZIP | Make each release reproducible |

Exact third-party dependencies and supported runtime versions will be selected and pinned during implementation. These are design decisions, not claims that the modules already exist.

## Planned repository layout

| Path | Responsibility |
| --- | --- |
| `src/app/` | Application shell, navigation, dialogs, focus mode |
| `src/canvas/` | Pointer handling, transforms, stroke rendering, spatial lookup |
| `src/document/` | Object schema, commands, undo/redo, document migrations |
| `src/features/notebooks/` | Notebook and page management |
| `src/features/tools/` | Pens, highlighter, eraser, selection, text, shapes |
| `src/features/layers/` | Layer ordering, visibility, locking |
| `src/features/graphs/` | Editable 2D and 3D graph objects |
| `src/features/math/` | Formula editing and recognition review |
| `src/features/pdf/` | PDF import, page backgrounds, export |
| `src/storage/` | IndexedDB, attachment storage, backups, optional sync |
| `src/integrations/` | Recognition and cloud adapters |
| `api/` | Optional server endpoints; only added when implemented |
| `public/` | Local icons, fonts, offline resources |
| `tests/` | Document, geometry, persistence, integration and browser tests |
| `docs/` | Architecture, setup, shortcuts, deployment and release evidence |
| `.github/workflows/` | Automated verification |
| `vercel.json` | Build and routing configuration |

The table describes intended paths; it is not an inventory of existing files.

## Milestone 1 — Runnable writing notebook

Implement the approved visual direction: dark navigation, light dotted paper, violet active tools, notebook sidebar, pen toolbar, contextual panel and status bar.

Deliver:
- Pen and highlighter with color, size, pressure response and adjustable stabilization.
- Stroke eraser, undo/redo and keyboard shortcuts.
- Pan and cursor-anchored zoom.
- Notebook/page creation, switching and renaming.
- Local autosave with visible saving, saved and failed states.
- Focus mode and responsive panel behavior.
- A clearly labeled sample notebook separate from the user's own notes.

First vertical workflow:
1. Open the application without signing in.
2. Create a notebook and write using a pen tablet or mouse.
3. Erase and undo a stroke.
4. Pan and zoom without shifting existing ink.
5. Switch pages, reload, and find the saved content intact.

Completion checks:
- High-DPI screens and resized windows preserve stroke positions.
- Input outside the canvas cannot accidentally draw.
- Pointer cancellation and leaving the canvas do not leave a stuck pen.
- Page switching does not mix histories or strokes.
- A storage failure does not falsely display “Saved”.
- An older autosave cannot overwrite a newer document revision.
- A clean dependency install, type check and production build pass.

## Milestone 2 — Complete editing and notebook management

Deliver:
- Lasso selection; move, resize, duplicate and delete supported objects.
- Straight lines, arrows, rectangles, ellipses, typed text, images and sticky notes.
- Ruled, dotted, graph and plain backgrounds.
- Layer visibility, locking and ordering.
- Page duplication, reordering, trash and recovery.
- Notebook search for titles and typed content.
- Versioned notebook backup/import that includes attachments.
- Offline app loading after an initial online load.

Completion checks:
- Hidden or locked layers are respected by selection and editing.
- Undo/redo covers object edits and layer changes consistently.
- Backup/import preserves IDs, page order, ink, attachments and styling.
- Malformed imports are rejected without changing the current notebook.
- A stale second browser tab cannot silently overwrite newer work.
- Core editing remains usable with the network disabled.

Local browser storage is not a backup. Provide explicit downloadable backups and a storage-health view; do not imply that clearing browser data preserves notebooks.

## Milestone 3 — Mathematics and interactive graphs

Deliver:
- Editable formulas with mathematical typesetting.
- 2D function plots with adjustable parameters, axes, grid and viewport controls.
- Tangent/slope exploration for supported functions.
- 3D surfaces with rotate, zoom, reset and parameter controls.
- Graph objects that can be positioned and layered with handwritten notes.
- Saved formulas and graph parameters that restore when a notebook opens.

Completion checks:
- Expressions use a restricted parser rather than arbitrary JavaScript evaluation.
- Invalid expressions, discontinuities and extreme parameter values have bounded behavior.
- Graph interactions do not accidentally create ink.
- Graphs do not cover toolbars or notebook navigation.
- Machines without usable 3D rendering show a clear fallback.
- Graphs appear correctly in exports.

## Milestone 4 — PDF annotation and reliable export

Deliver:
- PDF import with page selection and progress.
- Original PDF pages as locked annotation backgrounds.
- Ink, text and shapes placed in page coordinates.
- Export one page, a selection, or the complete notebook.
- PNG/SVG export where supported by object types.
- Explicit export regions or pagination for an infinite canvas.
- Consistent export settings for paper size, orientation and margins.

Completion checks:
- Every selected page is exported in order, not only the active page.
- Export covers the intended document region, not just the visible viewport.
- Hidden layers stay hidden and highlighter transparency stays correct.
- Imported pages, images, formulas and graph snapshots are included.
- Large imports/exports report progress, respect limits, and support cancellation.

## Milestone 5 — Real handwriting assistance

Keep a stable recognition interface so the provider or local model can change without rewriting the editor.

Deliver:
- Explicit selection of handwriting to recognize.
- Recognition of supported handwritten text and mathematical expressions.
- Editable result preview with accept, retry and cancel.
- Original ink retained until the user chooses to replace it.
- Search indexed from accepted recognized content.
- Flashcards generated from selected, reviewed notes.
- An optional explanation service with its outputs clearly distinguished from source notes.

Completion checks:
- Measure recognition quality on representative handwritten notes and math.
- Document provider requirements, supported notation and known limitations.
- Show provider errors honestly; never substitute canned output as successful recognition.
- Missing configuration leaves basic editing and typed formulas usable.
- Never send an entire notebook automatically for a small selection.
- Keep provider secrets on the server and enforce request limits.
- Confirm before sharing content with a cloud recognition provider.

An integration interface alone does not count as completed handwriting recognition. Offline recognition is a separate model/runtime decision and must be benchmarked on CPU hardware before being promised. Training a new HMER model from scratch is not assumed in this application build.

## Milestone 6 — Optional cloud features and release

Cloud extensions:
- Authentication and per-user notebook access.
- Hosted database and object storage behind the storage interface.
- Revision-aware sync with explicit conflict resolution.
- Retry-safe uploads and synchronization.
- Account export and deletion.

Release work:
- Windows setup instructions and scripts.
- Keyboard shortcuts and pen configuration guide.
- Browser and device compatibility matrix based on actual checks.
- Automated type checks, behavioral tests and production build.
- Vercel preview verification and production deployment instructions.
- Source ZIP excluding credentials, dependency folders and user notebooks.

Real-time multi-user collaboration and a native desktop installer are later extensions, not hidden dependencies of the first web release.

## Pen performance strategy

- Capture raw point data in a dedicated input path.
- Use coalesced input when available; otherwise use ordinary pointer samples.
- Keep pressure mapping configurable and provide a stable mouse fallback.
- Separate the active stroke preview from committed document rendering.
- Batch rendering with animation frames; avoid re-rendering the React tree for every point.
- Render visible objects and cache unchanged content when measurement justifies it.
- Move expensive background jobs away from the input path where practical.
- Treat stabilization as a user-controlled tradeoff: stronger smoothing may increase perceived lag.
- Provide pen-only drawing mode and touch navigation; validate accidental-touch behavior on supported hardware.
- Record frame time, long tasks and input-to-render processing under small and large notebooks.

A software timing counter does not measure total physical pen-to-screen latency. Any stronger latency claim requires testing the actual tablet, drivers, display and browser.

## Vercel delivery plan

Core deployment must require no backend URL, account or API key.

Planned project settings:
- Repository: `ShivamMathtech/infinite-canvas-studio`
- Framework preset: Vite
- Root directory: repository root
- Install: `npm ci`, after the lockfile exists
- Build: `npm run build`, after scripts are implemented
- Output: `dist`
- Runtime: a supported Node version pinned when the project is scaffolded

Implement and verify SPA deep-link handling. When API routes are introduced, keep API and asset requests out of the frontend fallback. Store private provider keys only as server environment variables.

Use an external durable database and object store for optional cloud notebooks. Do not treat a deployment's local filesystem as permanent notebook storage.

Deployment acceptance:
- A fresh production build succeeds from the checked-in lockfile.
- Root and deep links load on a preview deployment.
- Reloading a notebook route does not return a routing 404.
- Core tools work with no server credentials configured.
- Notebook changes survive reload on the same origin.
- Service-worker updates do not trap users on an obsolete app version.
- Production is reported as deployed only after the actual deployment succeeds.

Changing between localhost, preview and production origins does not automatically move local notebooks; use backup/import or configured cloud sync.

## Development and review workflow

1. Keep `main` as the reviewed baseline.
2. Implement the first milestone on a feature branch such as `feat/canvas-foundation`.
3. Ship runnable vertical workflows and document exactly which features are complete.
4. Open a pull request with screenshots, validation results and remaining limits.
5. Fix observed failures before broadening the feature set.
6. Connect the repository to the user's Vercel project for preview/release deployment.

Completion means working behavior with verification evidence. A visual placeholder or disabled button is not a completed feature.

## References checked during planning

- [React documentation](https://react.dev/learn)
- [Vite static deployment](https://vite.dev/guide/static-deploy)
- [Vercel Vite integration and SPA routing](https://vercel.com/docs/frameworks/frontend/vite)
- [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent)
- [Coalesced pointer events](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

