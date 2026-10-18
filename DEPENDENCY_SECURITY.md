# Dependency maintenance on Node 8

The runtime remains Node 8.17.0 with npm 6 and a version 1 lockfile. Install with `npm ci`; CI checks that installation leaves the lockfile unchanged. npm 6 does not support npm's newer `overrides` field.

The `resolutions` field and pinned `npm-force-resolutions` development tool apply these security patches when maintaining the lockfile:

| Dependency | Pinned version | Finding addressed |
| --- | --- | --- |
| form-data | 2.5.4 | CVE-2025-7783: predictable multipart boundaries |
| minimist | 1.2.8 | CVE-2021-44906: prototype pollution |
| flat | 5.0.2 | CVE-2020-36632: prototype pollution |
| crypto-js | 4.2.0 | CVE-2023-46233: weak PBKDF2 defaults |

These resolutions deliberately override upstream ranges. `flat` 5 supports Node 8 and retains the flattening API used by Mocha's `yargs-unparser`; the compatibility suite also checks its prototype pollution fix. Rookout uses the SHA256 API retained by crypto-js 4, which the suite exercises without starting an external debugging session. Keep these checks when updating either parent dependency.

Nodemailer 6.10.1 addresses CVE-2020-7769 while retaining Node 8 support. The local translation substitution replaces `stringinject`, removing the abandoned Babel 6 dependency chain responsible for CVE-2023-45133.

## Updating the lockfile

Use Node 8.17.0 and npm 6 for all commands:

```bash
npm install --ignore-scripts --no-audit
npm run lock:resolutions
npm ci --unsafe-perm --no-audit
```

Run the isolated suite documented in the README and the full Node 8/MySQL GitHub Actions job. Commit `package.json` and the generated `package-lock.json` together. Rerun the resolution command after any `npm install` that changes the lockfile. There is intentionally no install lifecycle hook that rewrites the lockfile or downloads resolution tooling during `npm ci`.

CodeFactor must rescan dependency changes. A passing test suite alone does not establish that dependency findings are resolved.

## Remaining warning-level findings

The CodeFactor report on commit `df3a7a5` also identified warnings in body-parser, braces, date-and-time, dicer, ini, ip, is_js, js-yaml, json-bigint, jsonwebtoken, jws, minimatch, node-forge, path-to-regexp, qs, semver, and tar. Some may disappear as dependency trees are updated; use the latest CodeFactor annotations as the source of truth.

These warnings are follow-up security work, not suppressed findings or a declaration that the packages are safe. Some require parent dependency replacements or a supported Node.js runtime; for example, the recommended jsonwebtoken 9 release requires a newer runtime. Keep the security check enabled and plan that migration separately.
