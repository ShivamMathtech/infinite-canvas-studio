# Infinite Canvas Studio

An advanced pen-tablet workspace for handwritten notes, mathematical exploration, PDF annotation, and offline notebooks.

**Current status: development planning.** This repository currently contains the project introduction and implementation roadmap. Application code, install scripts, tests, and a live deployment are not available yet.

[Read the development plan](docs/DEVELOPMENT_PLAN.md)

## Product direction

- A large infinite writing canvas with notebooks, pages, layers, and focus mode.
- Pressure-aware handwriting, adjustable stabilization, highlighter, eraser, and undo/redo.
- Selection tools, shapes, text, images, and flexible paper backgrounds.
- Editable formulas and interactive 2D/3D graphs.
- PDF annotation and export of complete notebooks.
- Local autosave, downloadable backups, and offline use after initial loading.
- Optional handwriting recognition and cloud synchronization through separate integrations.

These are planned capabilities, not implemented features. Writing performance and recognition accuracy must be verified on real devices and representative notes.

## Initial technical direction

React + TypeScript + Vite for the application; a dedicated Canvas 2D engine for ink; IndexedDB for local notebooks; separately loaded math, graph, and PDF modules.

The core editor will be designed to run without a backend connection. Windows local setup and Vercel deployment are the initial targets.

## First implementation milestone

A working notebook in which users can create a page, write, erase, undo, pan, zoom, and reload their saved work. The interface will follow the agreed canvas UI concept.

Subsequent milestones add richer editing, mathematical tools, PDF workflows, verified handwriting assistance, and optional cloud features.

## Running and deployment

There are no runnable application commands yet. Setup instructions, a dependency lockfile, automated checks, and Vercel configuration will be added with the implementation.

See [the development plan](docs/DEVELOPMENT_PLAN.md) for module ownership, acceptance criteria, performance strategy, and planned deployment settings.
