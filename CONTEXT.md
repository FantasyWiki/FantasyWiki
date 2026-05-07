# FantasyWiki

FantasyWiki is a game experience that uses Wikimedia traffic signals as domain input. This context defines the canonical language for external article-trend data used in product features.

## Language

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
_Avoid_: live ranking, real-time top list

**Snapshot Date (UTC)**:
The canonical date used for Wikimedia lookups and cache validity boundaries.
_Avoid_: local calendar date

**Range Average**:
The average daily pageviews for the selected **Content Article Candidate** across a chosen time range in the same **Project Domain**.
_Avoid_: daily top value

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

**Article Availability**:
The ownership status of an article at the time detail is shown.
Allowed values: **Free Agent**, **Owned by Viewer**, **Owned by Other Team**.
_Avoid_: generic unavailable flag

**Owner Team**:
The team that currently owns a non-free article. This is always shown when availability is not **Free Agent**.
_Avoid_: holder, assignee

## Relationships

- A **Top Read Snapshot** belongs to exactly one **Project Domain**
- A **Top Read Snapshot** is identified by **Project Domain** plus **Snapshot Date (UTC)**
- A **Range Average** is computed from one or more **Top Read Snapshots**
- The **Wikimedia Top Read API** provides the source data used to build **Top Read Snapshots**
- The **Wikimedia Client** orchestrates requests needed to build the **Top Read List**
- A **Content Article Candidate** is selected from a **Top Read Snapshot** after filtering
- A **Top Read Entry** is built from a **Content Article Candidate** plus its **Range Average**
- A **Top Read List** contains ordered **Top Read Entry** items
- The landing badge metric is **Filtered Snapshot Volume**
- A **Top Read Entry** displays **Filtered Rank** and may retain **Source Rank** for internal diagnostics
- **Owner Team** exists only when **Article Availability** is not **Free Agent**
- Buy action eligibility depends on **Article Availability** and viewer credits

## Example dialogue

> **Dev:** "For 'today top article', do we query live data?"
> **Domain expert:** "No — we use the latest available daily **Top Read Snapshot**, which is usually previous-day data for the selected **Project Domain**."

## Flagged ambiguities

- "today's most viewed" was ambiguous — resolved: use the latest available daily snapshot (typically previous day), not real-time values.
- "article by namespace" was ambiguous — resolved: namespace-only filtering is insufficient; apply hybrid filtering (namespace + denylist rules).
- "rank" was ambiguous — resolved: UI uses **Filtered Rank** while the service may keep **Source Rank** internally.
- "day boundary" was ambiguous — resolved: use **Snapshot Date (UTC)**, not client-local dates.
- "allowed domains" was ambiguous — resolved: `Project Domain` is constrained by app enums and mapped to Wikimedia project IDs.
- "single top article vs list" was ambiguous — resolved: landing displays a **Top Read List** of 5 entries, each with 30-day average.
- "service scope naming" was ambiguous — resolved: use **Wikimedia Client** as the generic integration boundary, with feature-specific interactions beneath it.
- "project id format" was ambiguous — resolved: use `en.wikipedia`/`it.wikipedia` (not `*.org`) in Top Read endpoint paths.
- "badge total" was ambiguous — resolved: badge uses **Filtered Snapshot Volume** (sum over all filtered snapshot entries), not top-5 only.
- "today badge wording" was ambiguous — resolved: domain semantics remain latest available **Top Read Snapshot**, but landing marketing copy may say "views today" as a deliberate UI simplification.
- "most searched" vs "most viewed" was ambiguous - resolved: this feature uses pageview-based **Top Read** data, so canonical wording is "most viewed."
- "centralized Wikimedia service" was ambiguous - resolved: centralization means a shared **Wikimedia Client** policy contract, while callers may still be distributed across frontend and backend.
- "not available" was ambiguous - resolved: use explicit **Article Availability** states instead of a generic unavailable boolean.
