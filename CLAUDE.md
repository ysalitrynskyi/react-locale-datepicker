@AGENTS.md

Read `AGENTS.md` first — it is canonical for every tool. Then `docs/PLAN.md`.

Two rules that are easy to get wrong in this repository:

1. **This repository is public and the source product repository is private.**
   Never commit the source repo's name, path, or anything about its business.
   Local specifics live in `LOCAL-CONTEXT.md`, which is gitignored.
2. **The package is live on npm (MIT since 0.1.0), and every further publish
   still needs explicit operator approval for that specific release.** Never
   run `npm publish`, change `/LICENSE`, or alter the license/copyright fields
   on your own initiative.
