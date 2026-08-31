# FantasyWiki

FantasyWiki is a game experience that uses Wikimedia traffic signals as domain input. This context defines the canonical language of the game: the entities a player plays with, the economy they play in, and the external article-trend data all of it is derived from.

## Language

Every word here is what the code names its types after, what a commit message
says, and what the documentation calls the thing. `_Avoid_` lists the
near-misses the term exists to displace, and a **bold word inside a definition**
is another term in this section.

A term marked `_Core_.` is one nothing else here can be read without. Those are
the terms the single-document exam report carries, so that a reader going
straight through it meets the vocabulary it is written in and not the whole
ingestion pipeline; every term, marked or not, is on the site's vocabulary page.

**Wikimedia Top Read API**:
The canonical source for daily most-viewed article rankings by project domain.
_Avoid_: Wikipedia API (generic), wiki API

**Wikimedia Client**:
The integration boundary responsible for all communication with Wikimedia/Wikipedia APIs.
_Avoid_: top-read-only service

**Project Domain**:
A Wikimedia project identifier derived from allowed app domain enums (currently `en` and `it`) and mapped to values like `en.wikipedia` and `it.wikipedia`.
_Avoid_: language only, site

**Top Read Snapshot**:
A daily ranking result bound to a specific **Project Domain** and retrieval date.
_Core_.
_Avoid_: live ranking, real-time top list

**Snapshot Date (UTC)**:
The canonical date used for Wikimedia lookups and cache validity boundaries.
_Avoid_: local calendar date

**Range Average**:
The average daily pageviews for the selected **Content Article Candidate** across a chosen time range in the same **Project Domain**.
_Avoid_: daily top value

**Language Scale Factor**:
A per-language constant that multiplies raw pageviews to lift each language onto one common reference scale (the reference language's factor is `1.0`; lower-volume languages get a factor `> 1`). A single factor per language drives both **tier granularity** and **synergy balance**, so the tier model and synergy table are tuned once and reused for every language.
_Core_.
_Avoid_: per-language tier table, per-language synergy table, cross-league multiplier

**Normalized Views**:
Raw pageviews multiplied by the **Language Scale Factor**. This is the input to the universal tiered base-points model, never raw pageviews directly.
_Core_.
_Avoid_: adjusted views, weighted views

**Base Points**:
The view-driven score of one article for a day, computed from its **Normalized Views** by the universal geometric model: `max(0, log₂(views / 2000))` up to a 150k kink, then linear above at `+1 point per 50,000 views`. Continuous and decimal-valued (the "+1 per doubling" rule is just the headline at the rungs); crosses zero at 2,000 views. Concave (diminishing) in the mid-field, convex at the top so the volatile daily elite is rewarded. Excludes synergy and events.
_Core_.
_Avoid_: raw points, pageview points

**Content Article Candidate**:
A title eligible for display after applying the shared content filter (namespace and denylist rules).
_Avoid_: raw top-ranked title

**Top Read Entry**:
A normalized item containing article title, filtered rank, source rank, daily views, and 30-day average views for one selected candidate.
_Avoid_: raw API response row

**Top Read List**:
An ordered list of top filtered entries shown on landing (currently size 5) for one **Project Domain** and **Snapshot Date (UTC)**.
_Avoid_: raw top snapshot

**Filtered Snapshot Volume**:
The total views obtained by summing all filtered entries from the 1000-item daily snapshot.
_Avoid_: raw-1000 sum, top-5-only sum

**Filtered Rank**:
The rank position after non-content entries are removed from a **Top Read Snapshot**.
_Avoid_: raw rank

**Source Rank**:
The original rank returned by the **Wikimedia Top Read API** before filtering.
_Avoid_: displayed rank

**Player**:
A person with an account, identified by a sign-in and a username. A player holds
one **Team** in each **League** they belong to, and nothing they own in one
league counts in another.
_Core_.
_Avoid_: user, manager, coach

**Team**:
A player's single entry in one **League**: a name, a **Credits** balance, the
**Contracts** it holds and the **Formation** it fields. Ownership, scoring and
standing are all team-level and never player-level, so a player with teams in
three leagues is playing three separate games.
_Core_.
_Avoid_: squad, club, roster, profile

**League**:
The competition a set of **Teams** play in. It fixes one Wikipedia language
edition, one **Season**, one **League Visibility**, one **Invite Policy** and
the **Language Scale Factor** frozen at the moment it was founded, and every
price and every point inside it is computed against those.
_Core_.
_Avoid_: room, lobby, group, tournament

**Global League**:
The one public **League** every player is enrolled in by naming their first
**Team**. Its id is the fixed string `global` and nobody may leave it, so it is
where a player plays before they have joined or founded anything else.
_Core_.
_Avoid_: default league, main league, home league

**League Admin**:
The player who created a **League**. The admin may close it before its
**Season** ends, and under the `admin` **Invite Policy** is the only one who may
hand out its **Invitation Code**.
_Core_.
_Avoid_: owner, moderator, host

**Season**:
The stretch a **League** runs for, chosen at creation from two weeks, one, two,
three or six months and starting the moment the league is created. The player
picks a length and never an end date. The two-week floor is the shortest season
in which a `LONG` **Contract Tier** can still reach **Expiry Settlement**.
_Core_.
_Avoid_: gameweek, matchday, round, campaign

**League State**:
Whether a **League** can still be played: `active` while its **Season** runs,
`ended` once its end date has passed, derived and never written, and `closed`
when its **League Admin** ended it early. *Inactive* names the two endings
together. Neither ending deletes anything, a season that cannot be read back
afterwards is not a season. See docs/domain/league-lifecycle.md.
Allowed values: active, ended, closed
_Avoid_: archived, deleted, finished

**Article Availability**:
The ownership status of an article at the time detail is shown.
_Core_.
Allowed values: **Free Agent**, **Owned by Viewer**, **Owned by Other Team**.
_Avoid_: generic unavailable flag

**Owner Team**:
The team that currently owns a non-free article. This is always shown when availability is not **Free Agent**.
_Avoid_: holder, assignee

**Viewer Team Context**:
The team id representing the authenticated player's active team in the selected league.
_Avoid_: viewer player id, session subject id

**Contract**:
A **Team**'s holding of one article for a committed term: signed at a
**Purchase Price**, running from its purchase date to its expire date, and
leaving by exactly one of **Early Sell** or **Expiry Settlement**. An article is
never held loosely, only under a contract, which is why the contract and not the
article is what scores, what is priced and what is placed on a **Position**.
_Core_.
_Avoid_: transfer, player card, ownership record

**Formation**:
A lineup that assigns contracts to the positions required by a **Formation Schema**.
_Core_.
_Avoid_: lineup, roster

**Position**:
A named slot in a formation (e.g., LW, CM, GK) where an article contract can be placed.
_Core_.
_Avoid_: slot, role

**Formation Schema**:
A named layout that defines which **Positions** are required and which **Chemistry Links** exist between them.
_Core_.
_Avoid_: formation type, layout only

**Bench**:
Where a **Team**'s **Contracts** sit when they are not placed on a
**Position**. It has no limit of its own, only what is left of the team's
contract cap after the placed ones, and it is where every edit that displaces a
contract puts it, so no edit can lose one. A benched contract is still paid for
and still settles; it scores nothing. See docs/domain/lineup-rules.md.
_Avoid_: reserves, substitutes, spares

**Chemistry Link**:
A schema-defined connection between two **Positions** that carries a **Chemistry Level** for the articles placed there.
_Core_.
_Avoid_: adjacency line, edge

**Chemistry Level**:
A four-step rating (Excellent/Good/Weak/Empty) assigned to a **Chemistry Link** that drives UI color and an **additive** score contribution (flat points), not a multiplier. Chemistry is only evaluated between schema-adjacent **Positions**, not between every pair of owned articles.
_Core_.
_Avoid_: color tier, synergy multiplier, all-pairs synergy

**Daily Performance**:
One **Team**'s score for one **Snapshot Date (UTC)**: the **Base Points** of the
articles placed on its **Positions**, plus the flat points its **Chemistry
Links** carry, stored once per team per day. It is the only thing **Standings**
are built from.
_Core_.
_Avoid_: match, fixture, gameweek, result

**Scoring Collector**:
The nightly batch that scores every **Team** in every **League** on the previous
day's pageviews. It reads each team's placed articles from the backend, fetches
per-article views and the link graph from Wikimedia, and posts back raw facts
rather than points, because the scoring model has one implementation and the
collector is not it. See docs/architecture/scoring-pipeline.md.
_Core_.
_Avoid_: scoring job, cron, scorer

**Standings**:
A **League**'s table: cumulative **Daily Performance** points, descending, with
each team's movement against the order as it stood before its own last scored
day. Nothing else is weighted in, not credits, not team value, not days played,
and ties are broken by nothing. The API and its DTOs call the same table
`leaderboard`. See docs/domain/standings-and-podium.md.
_Core_.
_Avoid_: ranking, scoreboard, league position

**Podium**:
The top three of the **Standings**, shown for the whole **Season** rather than
at the end of it: live and with movement while the league is `active`, final and
still once it has ended. Withheld entirely in a league nobody has scored in yet,
where every team is tied on zero and a first row would be a fiction.
_Avoid_: winners, medal table, final ranking

**Market**:
The screen a **Team** signs **Contracts** from: search across articles, the
**Article Availability** of each, and the **Article Genie** for the article a
player cannot name. Every contract begins here.
_Core_.
_Avoid_: shop, store, transfer market, auction

**Contract Tier**:
The committed duration picked when a **Contract** is signed: `SHORT` is 3 days,
`MEDIUM` 7, `LONG` 14 (ADR 0005). The tier is what **Contract Price** charges
for and what **Early Sell** prorates against, and a renewal rolls the same
length forward rather than choosing a new one.
Allowed values: SHORT, MEDIUM, LONG
_Core_.
_Avoid_: contract length in weeks, plan, subscription

**Credits**:
What a **Team** pays for **Contracts** with, and the only currency in the game.
Never a stored balance: credits are derived on every read from the team's own
contracts, starting budget minus every **Purchase Price** paid, plus every
payout already settled back (ADR 0007). Affordability is enforced inside the
statement that writes the contract, not above it.
_Core_.
_Avoid_: coins, money, wallet, budget

**Contract Price**:
The credits required to hold an article, `D × BasePoints(Normalized_30-day-average_Views)^k × contract_days` (ADR 0005, derived from the scoring curve's own BasePoints shape, not raw views; days-based; supersedes both the original linear `/1000 × weeks` form and an intermediate convex-in-raw-views form). Priced on the **smoothed 30-day average**, never daily views, this is the deliberate decoupling that makes daily spikes cheap-but-fleeting and sustained popularity expensive. The `k` exponent applies convexity to the already-log-compressed points value (not to raw, power-law-skewed views), so giants/top-tier articles cost progressively more per marginal point than mid-tier ones without the price curve diverging from the value it buys.
_Core_.
_Avoid_: daily-view price, spot price, linear-in-views price, convex-in-views price

**Purchase Price / Current Price**:
**Purchase Price** is the **Contract Price** locked at signing. **Current Price** is the same formula re-evaluated with live 30-day-average views, at the contract's **original tier duration**, a "replacement cost" number (ADR 0003). It's the shared basis for both exit paths: prorated for an **Early Sell**, or a full **Expiry Settlement** against Purchase Price at natural term completion.
_Core_.
_Avoid_: fixed price only, single price, resale price (ambiguous about which exit path)

**Early Sell**:
Voluntarily exiting a contract before its committed term ends: `Current Price × (remaining days / tier days)` credited, pays only for the *unused* portion of the term, at today's rate (ADR 0003). Proration is the sole anti-exploit guard (there is **no minimum hold**): holding 3 of 14 days recovers only 11/14, so a partial hold can never return the full price plus free days of points.
_Core_.
_Avoid_: resale, cash out (ambiguous with Expiry Settlement)

**Expiry Settlement**:
The "sold to system" outcome when a contract completes its full committed term without renewal: the team is credited the full **`Current Price`**, i.e. `Purchase Price + (Current Price − Purchase Price)` (ADR 0003). The buy already **debited** `Purchase Price`, so expiry returns the whole stake **plus** the mark-to-market P&L, net profit if views rose over the whole hold, net loss if they fell (crediting only the delta, as an earlier draft did, would wrongly forfeit the stake). Can only trigger by holding the entire term, so it can't be reached via early exit. This is the mechanism that makes buying a viral/trending-spike article at its peak genuinely risky: a spike that fully reverts before the term ends turns into a real loss at settlement, not just "no profit." Runs via a daily **Cloudflare Cron** sweep on the backend (single money-writer, ADR 0004), idempotent on a contract `status` guard.
_Core_.
_Avoid_: expiry (bare), auto-sell, contract end (without specifying settlement)

**Renewal Election**:
The owner's choice, in the final 24h of a **Contract**'s term, to renew rather
than let it reach **Expiry Settlement** (ADR 0003). The default is to let it
expire and the choice locks for expiry once the window closes. Renewing rolls
the term forward at the **Current Price** plus the **Renewal Premium**.
_Core_.
_Avoid_: right of first refusal, auto-renew, extension

**Wealth Ceiling**:
The point at which extra credits stop buying more daily points. **Stale pending re-derivation** (ADR 0003): the previous ~2,400-credit figure (cost of the top-11 team for one week) was calibrated against the now-removed income-floor economy; under mark-to-market settlement, wealth includes unrealized position gains/losses, not just spend, so the ceiling needs redefining before the number can be trusted again.
_Avoid_: budget cap, hard cap

**Renewal Premium**:
A **+10%-per-consecutive-renewal** cost premium on holding the same article, resetting after dropping it for at least one cycle (ADR 0003, retained). The economy's anti-hoard sink, unaffected by the removal of the transaction fee, since it solves a different problem (hoarding one article vs. daily churn).
_Avoid_: tax, penalty

**Article Genie**:
The market-page assistant that finds articles a player cannot name exactly (ADR 0006). It serves two intents through one input: **chemistry scouting** ("find me a relation between OpenAI and Portugal") and **tip-of-the-tongue recall** ("the female mathematician who worked at NASA"). It never invents a title, it seeds a bounded list of real articles from search and uses an LLM only to narrow it through questions. When the daily model quota is exhausted the Genie is **asleep** and the market falls back to the ordinary search bar.
_Core_.
_Avoid_: Akinator assistant, AI search, chatbot

**Genie Turn**:
One question-and-answer exchange with the **Article Genie**, carrying the surviving **Candidate Set** forward. A turn asks either a *filter* question, which partitions the set, or a *preference* question, which only re-ranks it.
_Avoid_: prompt, message, round

**Candidate Set**:
The bounded list of real article titles the **Article Genie** narrows. Seeded from search results and, when the player names anchors, from articles linked in either direction with those anchors. Ranked by mutual links first and **Contract Price** second, so cheap well-connected articles outrank expensive ones with the same chemistry.
_Avoid_: candidates (bare), search results, shortlist

**League Visibility**:
Whether a league is **public** (any player may join) or **private** (joining requires its **Invitation Code**, or being the **League Admin**). Visibility governs *joining* only, a private league's page and standings stay readable by anyone with its id. The Global League is public. See docs/domain/league-visibility.md.
_Core_.
_Avoid_: league privacy, closed league, locked league

**Invitation Code**:
The five-character code that opens a **private** league: digits and capitals minus the look-alikes (`0 O 1 I L U`). Only private leagues have one, a public league is joinable by anyone, so there is nothing for a code to guard. It is a credential, so it never travels on a league DTO; only the endpoint that checks the league's **Invite Policy** serves it (ADR 0008).
_Avoid_: invite token, join key, league password, access code

**Invite Policy**:
Who may hand out a league's **Invitation Code**: `members` (anyone fielding a team) or `admin` (only the **League Admin**). Chosen when the league is created.
_Avoid_: invite permission, sharing setting

## Relationships

- A **Player** holds at most one **Team** in a **League**, and one in the **Global League** from the moment they name a first team
- A **League** has exactly one **League Admin**, one **Season** and one **League State**
- A **Team** belongs to exactly one **League** and holds many **Contracts**
- A **Contract** binds one **Team** to one article for one **Contract Tier**, and ends in **Early Sell** or **Expiry Settlement**
- A **Contract** is either placed on a **Position** of the team's **Formation** or sits on the **Bench**
- **Credits** are derived from a **Team**'s **Contracts**, never stored
- A **Daily Performance** belongs to one **Team** and one **Snapshot Date (UTC)**, and is written by the **Scoring Collector**
- **Standings** are the cumulative **Daily Performances** of every **Team** in a **League**; the **Podium** is their top three
- A **Top Read Snapshot** belongs to exactly one **Project Domain**
- A **Top Read Snapshot** is identified by **Project Domain** plus **Snapshot Date (UTC)**
- A **Range Average** is computed from one or more **Top Read Snapshots**
- The **Wikimedia Top Read API** provides the source data used to build **Top Read Snapshots**
- The **Wikimedia Client** orchestrates requests needed to build the **Top Read List**
- A **Content Article Candidate** is selected from a **Top Read Snapshot** after filtering
- A **Top Read Entry** is built from a **Content Article Candidate** plus its **Range Average**
- A **Top Read List** contains ordered **Top Read Entry** items
- The landing badge metric is **Filtered Snapshot Volume**
- A **League** has exactly one **League Visibility** and exactly one **Invite Policy**
- A **private League** is joined only with its **Invitation Code**, or by its **League Admin**
- An **Invitation Code** belongs to exactly one **private League** and is unique across all of them; a **public League** has none
- A **Top Read Entry** displays **Filtered Rank** and may retain **Source Rank** for internal diagnostics
- **Owner Team** exists only when **Article Availability** is not **Free Agent**
- **Owner Team** and **Viewer Team Context** are both team-level concepts; ownership comparisons are team-id based, not player-id based
- Buy action eligibility depends on **Article Availability** and viewer credits
- A **Formation Schema** defines a set of **Positions** and **Chemistry Links**
- A **Chemistry Link** connects exactly two **Positions**
- A **Formation** assigns a contract to each required **Position** and carries a **Chemistry Level** for each **Chemistry Link**
- The **Article Genie** narrows a **Candidate Set** through successive **Genie Turns**
- A **Candidate Set** contains article titles, never invented ones, and is ranked by mutual links then **Contract Price**

## Example dialogue

> **Dev:** "For 'today top article', do we query live data?"
> **Domain expert:** "No, we use the latest available daily **Top Read Snapshot**, which is usually previous-day data for the selected **Project Domain**."

## Flagged ambiguities

- "today's most viewed" was ambiguous: resolved: use the latest available daily snapshot (typically previous day), not real-time values.
- "article by namespace" was ambiguous: resolved: namespace-only filtering is insufficient; apply hybrid filtering (namespace + denylist rules).
- "rank" was ambiguous: resolved: UI uses **Filtered Rank** while the service may keep **Source Rank** internally.
- "day boundary" was ambiguous: resolved: use **Snapshot Date (UTC)**, not client-local dates.
- "allowed domains" was ambiguous: resolved: `Project Domain` is constrained by app enums and mapped to Wikimedia project IDs.
- "single top article vs list" was ambiguous: resolved: landing displays a **Top Read List** of 5 entries, each with 30-day average.
- "service scope naming" was ambiguous: resolved: use **Wikimedia Client** as the generic integration boundary, with feature-specific interactions beneath it.
- "project id format" was ambiguous: resolved: use `en.wikipedia`/`it.wikipedia` (not `*.org`) in Top Read endpoint paths.
- "badge total" was ambiguous: resolved: badge uses **Filtered Snapshot Volume** (sum over all filtered snapshot entries), not top-5 only.
- "today badge wording" was ambiguous: resolved: domain semantics remain latest available **Top Read Snapshot**, but landing marketing copy may say "views today" as a deliberate UI simplification.
- "most searched" vs "most viewed" was ambiguous - resolved: this feature uses pageview-based **Top Read** data, so canonical wording is "most viewed."
- "centralized Wikimedia service" was ambiguous - resolved: centralization means a shared **Wikimedia Client** policy contract, while callers may still be distributed across frontend and backend.
- "not available" was ambiguous - resolved: use explicit **Article Availability** states instead of a generic unavailable boolean.
- "contract owner identity" was ambiguous - resolved: ownership is determined by team id (**Owner Team** vs **Viewer Team Context**), not by player/session ids.
- "language multiplier" was ambiguous (sounded like cross-league normalization) - resolved: competition is always same-language, so the factor is **not** a cross-league comparison device. It is a single per-language **Language Scale Factor** applied to views before scoring, fixing tier granularity and synergy balance with one universal scoring model. The factor is **static** (rank-matched top-K view ratio, reference language = 1.0), recalibrated rarely (≈annually; there is no formal season). See ADR 0002 (`docs/adr/0002-language-scale-factor.md`).
- "max contracts per team" was contradictory (§3.1 said 10; every formation has 11 positions) - resolved twice. First to **11**, one per formation position, which conflated the squad with the starting eleven and left nothing to bench. Then, on 2026-07-10 (PR #433), to **22 unsettled contracts**: a starting eleven plus a bench of the same size, with 11 still the number that can be *placed*. `MAX_TEAM_CONTRACTS` states it and the guarded INSERT enforces it; see docs/domain/lineup-rules.md.
- "contract duration units" is contradictory (§3.1/§6.1 say weeks–24 months; `contractDTO.tier` buckets in days: SHORT ≤3, MEDIUM ≤7, LONG >7) - leaning to the shorter, code-aligned day/week durations for a fast casual game; exact bounds still open.
- "base scoring shape" was resolved against real en.wp data (2026-06-07 top-1000): rule-based geometric tiers (log-binned, "+1 point per doubling" from a 4k floor) replace the §2.1 three-tier 5k/20k model, with a convex linear tail above 150k (the volatile daily top ~10) to reward catching breakouts. en.wp is the reference language (factor 1.0).
- "synergy/chemistry mechanic" was ambiguous (Requirements §2.2 said additive-over-all-pairs; the "Choose Team Formation" user story and shipped code said position-adjacency multiplier) - resolved: chemistry is **additive flat points** evaluated on **schema-adjacency topology** (FUT-style). It is not a multiplier and is not computed over every owned pair. This favors low-traffic articles proportionally and preserves the formation-placement puzzle.
- "how does a contract pay out at the end" was undefined (only a 24h right-of-first-refusal-then-free-agent-pool was specified, no payout) - resolved (ADR 0003): two distinct exit paths, **Early Sell** (prorated on unused time, exiting before the term ends) and **Expiry Settlement** (credit the full **Current Price** = stake + mark-to-market P&L, only reachable by holding the entire term). The right-of-first-refusal is reworded to a **final-24h renewal election** (owner picks Renew / let-expire during the last 24h of the term; the choice locks for expiry; default = let expire), and settlement runs via a daily **Cloudflare Cron** sweep on the backend (30-day-average views via the Wikimedia client). Also resolved in the same decision: **Base Stipend**, the **8% Transaction Fee**, and the **3-day minimum hold** are all removed: recovery for a broke player comes from the pricing curve's zero floor (free sub-2,000-view articles), not a guaranteed flat income; the fee and the hold were redundant with 30-day-average smoothing plus early-sell proration. See ADR 0003 for the full reasoning and the acknowledged open risk (no-death-spiral is now probabilistic, not guaranteed).
