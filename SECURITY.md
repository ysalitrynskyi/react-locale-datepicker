# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x (latest) | Yes |
| anything older | No — upgrade to the latest 0.x |

Pre-1.0, fixes land in the newest release only.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**), which reaches the maintainer directly.

Include what you can: affected version, reproduction steps, and impact. You will
get an acknowledgement as soon as the report is seen — this is a small project,
so please allow a few days rather than a few hours.

## Scope

This is a UI component. It renders dates and accepts typed input; it makes no
network requests, reads no credentials and writes no storage. The realistic
categories are:

- **Cross-site scripting** through a prop rendered without escaping — the
  component should never use `dangerouslySetInnerHTML`, and a report that it does
  is valid.
- **Prototype pollution** or similar via an options object.
- **A supply-chain problem** in the published tarball, for example unintended
  files or a compromised build artifact.

Denial of service by passing absurd values (a year of 1e9, for instance) is worth
reporting as a bug but is not treated as a vulnerability.
