# Security policy

## Supported versions

FantasyWiki is a hosted service, not a package: exactly one version runs, the
latest release, deployed from `master` to <https://fantasywiki.pages.dev>. A fix
is made on `master` and reaches production with the next deploy; older releases
are not patched, because nothing runs them.

| Version | Supported |
|---|---|
| Latest release | Yes |
| Anything older | No |

## Reporting a vulnerability

**Report it privately, through GitHub:**
<https://github.com/FantasyWiki/FantasyWiki/security/advisories/new>. Only the
maintainers can read a report filed there, and the fix can be prepared in a
private fork before anything is disclosed.

**Do not open a public issue, and do not use the app's "Report a problem"
form.** That form files a public GitHub issue on this repository, which is the
right place for a bug and the wrong one for a vulnerability.

A useful report says:

- what an attacker can do, and to whom: another player's team, credits,
  session, or data;
- how to reproduce it, against a local run if at all possible
  (`./gradlew noGenie` needs no credentials, see
  [Running FantasyWiki in Docker](./docs/development/docker-local-dev.md));
- which commit or release you tested.

## What happens next

The two maintainers aim to acknowledge a report within seven days, to agree
with you on whether it is a vulnerability and how severe, and to ship a fix
before it is disclosed. Once it is fixed, the advisory is published with credit
to you, unless you ask not to be named.

## Scope

In scope: the code in this repository, and the deployed frontend and Worker it
builds.

Out of scope, and to be reported to their owners instead: Wikipedia and the
Wikimedia APIs, Cloudflare, Google sign-in, and GitHub. Also out of scope:
denial of service and load testing against production, which is a free-tier
service a league of friends plays on, and social engineering of the
maintainers or the players.

While testing, touch only your own account and teams. If a vulnerability
exposes another player's data, stop at the minimum that demonstrates it.

## How the system is meant to hold

The design a report is measured against:

- [Sessions and sign-in doors](./docs/architecture/sessions.md): one HTTP-only
  session cookie, the doors that mint it, and the guards that read it.
- [Auth modes](./docs/architecture/auth-modes.md): why username and password
  sign-in is absent from the deployed build rather than disabled in it.
- [API naming rules](./docs/development/api-naming-rules.md): identity comes
  from the session, never from a client-supplied id.
- [Problem reports](./docs/architecture/problem-reports.md): what a report
  publishes about the player who filed it, and what it never does.

Dependencies are updated by Renovate, and `npm audit` on production
dependencies is part of the check every change must pass.
