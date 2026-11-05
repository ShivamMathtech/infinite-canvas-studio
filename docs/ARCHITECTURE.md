# Foundation architecture

## Modules

| Module | Responsibility |
| --- | --- |
| `src/app/` | React shell, tool controls, inspector, dialogs and editor layout |
| `src/canvas/Canvas.tsx` | Pointer capture, coalesced samples when available, gestures and animation-frame rendering |
| `src/canvas/render.ts` | Canvas rendering shared by the live editor, thumbnails and exports |
| `src/canvas/geometry.ts` | Coordinate transforms, bounds, stroke hit testing and viewport fitting |
| `src/document/model.ts` | Versioned document schema, ID generation and import validation |
| `src/document/studio.ts` | Immutable state transitions, per-page history and ordered persistence |
| `src/storage/repository.ts` | IndexedDB transactions and compare-and-swap revisions |
| `src/features/export.ts` | Full-content PNG, multi-page PDF and portable JSON backups |

## Ink path

Pointer samples stay in the canvas component's gesture state. React does not receive a state update for every stroke point. A committed stroke stores coordinates, pressure, width, opacity and smoothing settings.

The base canvas displays committed objects. A separate transparent canvas displays the current stroke or object movement. An animation-frame callback batches rendering. Stroke outlines use `perfect-freehand`; completed outline paths are cached by immutable stroke object.

The active stroke is still rebuilt as points arrive. This foundation is not an incremental GPU renderer. Profiling on long strokes and large notebooks is a later performance milestone.

## Document and history

A workspace contains notebooks, pages, ordered layers and editable objects. Objects are strokes, shapes, text, sticky notes or supported graph presets.

Updates create new page/workspace objects. Each page has its own bounded in-memory history, so undo on one page does not alter another page. Local storage writes happen after edits rather than on each pointer sample.

## Save ordering and conflicts

The repository stores `{ revision, workspace }` in one IndexedDB record. Every write reads the current revision and compares it with the caller's expected revision in the same read/write transaction.

The Studio serializes writes. If another edit happens during a save, it schedules another write and does not falsely report that the new edit was saved. A failed transaction preserves the unsaved workspace in memory and reports the failure.

BroadcastChannel provides an early notification for another tab's save. The transactional revision check remains authoritative when that API is absent. Conflicts retain local edits for export and require an explicit reload before further automatic persistence.

## Export

PNG/PDF rendering uses the bounds of all visible page objects, including off-screen and negative-coordinate content. Hidden layers are excluded. The same drawing code preserves highlighter opacity and graph appearance.

PNG dimensions are bounded to prevent unreasonable canvas allocations. PDF uses one fitted raster image per page in the notebook's order. The PDF dependency loads only when an export is requested.

## Backend boundary

There is no server or cloud provider in this release. No credentials are needed. Future recognition/sync work must use explicit adapters, real providers, editable results, and separate availability states.
