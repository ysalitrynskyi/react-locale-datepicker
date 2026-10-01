# Releasing

## Gates

A release may not happen unless **all** of these hold:

1. `/LICENSE`, the `license` field and the `author` line are present and
   consistent (standing since 0.1.0 — D1 is resolved; do not alter them
   without the operator).
2. The full test suite is green in CI, including the browser matrix.
3. The parity contract in `EXTRACTION.md` has been re-checked against the built
   artifact, not only the source.
4. **The operator has explicitly approved this specific release.** Approval for a
   previous release does not carry forward.

An agent may prepare everything above. `npm publish` requires explicit operator
approval for that specific release (prior approval does not carry forward).

## Versioning

Semantic versioning, with the first release at **`0.1.0`**.

Start below 1.0 deliberately: it signals the API may still move, which is honest
while it is still settling. Move to 1.0.0 once the API has survived contact
with a few real consumers.

- **Patch** — bug fix, no API change.
- **Minor** — additive: a new optional prop, a new export.
- **Major** — anything that could break a consumer, including changes to the
  contracts in `API.md` § Contracts that must not be broken.

**Below 1.0 the minor number is the breaking slot**, which is what npm's
caret ranges assume: `^0.5.1` accepts `0.5.x` but not `0.6.0`. While the
version starts with `0.`:

- a change that could break a consumer ships as the next **minor**, never as
  a patch (0.5.0 changed the touch default; 0.6.0 the focus and keyboard
  model);
- an addition also ships as a minor, as 0.3.0 and 0.4.0 did;
- a fix with no API or behaviour change ships as a **patch**.

Every behaviour change is listed under *Changed* in the changelog either
way: the source product pins an exact version (D7) and upgrades by reading
it.

Treat the timezone contract, the blur ordering and the locale-resolution
behaviour as part of the public API. Changing any of them is a breaking
change in the sense above, even if the type signature is unchanged.

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
- [ ] The stylesheet path resolves (`react-locale-datepicker/styles.css` →
      `dist/styles.css`).
- [ ] README renders correctly on npm — it is a different renderer to GitHub.

**Publishing is irreversible.** An npm version can be deprecated but its contents
stay downloadable forever. Read the tarball file list before every first publish.

## Publish

The order matters: CI runs Firefox and WebKit, which a local run usually does
not, so nothing is tagged or published until CI is green on the exact commit.

1. **Prepare** (an agent may do this): the `CHANGELOG.md` entry,
   `docs/releases/vX.Y.Z.md`, and the version bump committed on `main`:

   ```bash
   npm version X.Y.Z --no-git-tag-version   # package.json and package-lock.json
   ```

2. **Push `main` and wait for CI.** Pushing also redeploys the demo from
   source (`.github/workflows/pages.yml`), so the demo shows the new
   behaviour before npm does.

   ```bash
   git push origin main
   ```

3. **Tag, publish, release** — operator only, with CI green and approval for
   this specific release:

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   npm publish --access public
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z — <one line>" --notes-file docs/releases/vX.Y.Z.md
   ```

Then verify from the outside: install the published version in a clean project
and render it. Do not rely on the local build having worked.

## After a release

- `main` keeps the released version until the next release is prepared; there
  is no development pre-release version.
- Release notes state what changed and, for a breaking change, what a consumer
  has to do.
- If a release is broken, prefer publishing a fix over unpublishing. Unpublishing
  breaks anyone who already installed it.
