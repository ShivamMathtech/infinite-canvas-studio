# Windows and Vercel

## Local Windows setup

1. Install Node.js 24.x and Git.
2. Clone the repository and switch to the implementation branch until it is merged.
3. Run `npm ci` in the repository root.
4. Run `npm run dev` and open the URL printed by Vite.

```sh
git clone https://github.com/ShivamMathtech/infinite-canvas-studio.git
cd infinite-canvas-studio
git switch feat/canvas-foundation
npm ci
npm run dev
```

The batch files support directory names with spaces. They use the local Vite installation, not a globally installed CLI. Do not copy a Linux `node_modules` directory onto Windows; use the checked-in lockfile and `npm ci`.

## Vercel configuration

Import the GitHub repository into your Vercel project:

- Framework preset: Vite.
- Root directory: repository root.
- Node.js: 24.x.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output: `dist`.
- No environment variables for the foundation editor.

Before merging, deploy `feat/canvas-foundation` as a preview. After review and merge, use `main` for production.

The configuration supports an SPA fallback and serves bundled assets normally. v0.1 restores the active notebook from local storage; it does not yet encode notebook IDs in shareable routes.

Confirm on the actual Vercel deployment:

1. The build succeeds and the editor opens.
2. Creating and drawing on a page works without a backend.
3. Reload restores saved notes on the same URL origin.
4. PNG/PDF downloads and JSON backup/import work.
5. Browser refreshes on a nested path load the SPA.

The repository being ready to deploy does not mean a Vercel project has already been connected or published.

## Storage and backups

Localhost, Vercel preview URLs and a production domain have separate browser storage. Export/import a workspace backup to move notes between them.

Keep private notes out of Git. The repository contains source code and prepared sample content only.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `vite` is not found | Run `npm ci` in the folder containing `package.json`. |
| Unsupported engine | Install Node.js 24.x and reopen the terminal. |
| Vercel build has no app | Use the implementation branch, or merge the implementation PR first. |
| Wrong output directory | Set it to `dist`. |
| Notes seem missing on a new URL | Browser storage is per origin; import a backup from the previous URL. |
| “Another tab has changes” | Export local edits, then load the latest saved workspace. |
| Drawing is blocked | Check pen-only mode and the active layer's visibility/lock. |
| Pressure has no effect | Verify the tablet driver exposes pen pressure to the browser. Mouse input uses a fallback. |

## References

- [Vercel: Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel: Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vite: static deployment](https://vite.dev/guide/static-deploy)
