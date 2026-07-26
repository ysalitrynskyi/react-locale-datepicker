# Releasing

## Gates

A release may not happen unless **all** of these hold:

1. **D1 is resolved** and `/LICENSE` exists.
2. `package.json` has `"private": false` — flip it only at this point.
3. The full test suite is green in CI, including the browser matrix.
4. The parity contract in `EXTRACTION.md` has been re-checked against the built
   artifact, not only the source.
5. **The operator has explicitly approved this specific release.** Approval for a
   previous release does not carry forward.

An agent may prepare everything above. `npm publish` requires explicit operator
approval for that specific release (prior approval does not carry forward).

## Versioning

Semantic versioning, with the first release at **`0.1.0`**.

Start below 1.0 deliberately: it signals the API may still move, which is honest
while the component has no external users. Move to 1.0.0 once the API has
survived contact with a few real consumers.

- **Patch** — bug fix, no API change.
- **Minor** — additive: a new optional prop, a new export.
- **Major** — anything that could break a consumer, including changes to the
  contracts in `API.md` § Contracts that must not be broken.

Treat the timezone contract, the blur ordering and the locale-resolution
behaviour as part of the public API. Changing any of them is a major, even if
the type signature is unchanged.

## Pre-publish checklist

```bash
npm run check          # types, lint, tests
npm run build
npm pack --dry-run     # inspect the file list
```

- [ ] The tarball contains `dist`, the license and the README — nothing else.
      Confirm by reading the file list, not by trusting `files`.
- [ ] No source maps pointing at private paths.
- [ ] No stray environment files, fixtures or scratch directories.
- [ ] `exports` resolves for ESM, CJS and TypeScript. Test in a scratch consumer
      with `npm install ./package.tgz`, not only in this repository.
- [ ] The stylesheet path resolves, if D3 produced one.
- [ ] README renders correctly on npm — it is a different renderer to GitHub.

**Publishing is irreversible.** An npm version can be deprecated but its contents
stay downloadable forever. Read the tarball file list before every first publish.

## Publish

```bash
npm publish --access public
git tag v0.1.0
git push --tags
gh release create v0.1.0 --notes-file <notes>
```

Then verify from the outside: install the published version in a clean project
and render it. Do not rely on the local build having worked.

## After a release

- Post-release, `main` carries the next development version.
- Release notes state what changed and, for a major, what a consumer has to do.
- If a release is broken, prefer publishing a fix over unpublishing. Unpublishing
  breaks anyone who already installed it.
