## What this changes

<!-- One or two sentences. What and why, not a file list. -->

## Why

<!-- The reasoning. If it fixes a bug, describe the failure. -->

## Checklist

- [ ] Tests added or updated, and the suite is green.
- [ ] No new runtime dependency (or the reason is explained above).
- [ ] No documented contract in `docs/API.md` is broken, or the change is flagged
      as breaking and the migration is described.
- [ ] Every behaviour in `docs/EXTRACTION.md` § Parity contract still holds.
- [ ] Nothing referencing the private source product repository is included —
      no names, paths, business rules or identifiers.
- [ ] If a date value is touched: verified under a negative UTC offset, a
      positive one, and UTC.
- [ ] If layout is touched: verified in an RTL locale.

## Breaking?

<!-- Yes or no. If yes, what must a consumer do? -->
