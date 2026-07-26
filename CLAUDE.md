@AGENTS.md

Read `AGENTS.md` first — it is canonical for every tool. Then `docs/PLAN.md`.

Two rules that are easy to get wrong in this repository:

1. **This repository is public and the source product repository is private.**
   Never commit the source repo's name, path, or anything about its business.
   Local specifics live in `LOCAL-CONTEXT.md`, which is gitignored.
2. **Nothing is published until decision D1 (ownership and license) is resolved**
   in `docs/DECISIONS.md`. `package.json` is `"private": true` as a safety catch.
