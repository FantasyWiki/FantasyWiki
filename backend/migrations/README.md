# D1 Database Migrations

This directory contains SQL migration files for the Cloudflare D1 database used by FantasyWiki backend.

## Migration Files

- `0001_initial_schema.sql` - Creates all tables (google_accounts, players, leagues, teams, contracts, notifications) and indexes. **Note:** Players have a 1:1 relationship with google_accounts via the `googleAccountId` foreign key.
- `0002_add_google_account_fk_to_players.sql` - Migration to add foreign key constraint from players to google_accounts (for upgrading from older schema).

## Running Migrations

### Local Development

To apply migrations to your local D1 database during development:

```bash
cd backend
wrangler d1 execute db --file ./migrations/0001_initial_schema.sql --local
```

### Production Deployment

To apply migrations to your production D1 database:

```bash
cd backend
wrangler d1 execute db --file ./migrations/0001_initial_schema.sql --remote
```

Or via Wrangler CLI:

```bash
wrangler d1 migrations apply db
```

## Schema Overview

### Tables

- **google_accounts** - Google OAuth account (id, googleId, email)
- **players** - Player accounts (id, username, googleAccountId) - each player must have exactly one Google account
- **leagues** - Leagues for fantasy tournaments (id, name, adminId, startDate, endDate, domain, icon)
- **teams** - Player teams within leagues (id, name, playerId, leagueId, credits)
- **contracts** - Wikipedia article contracts for teams (id, teamId, articleId, purchaseDate, expireDate, purchasePrice)
- **notifications** - Notifications for contract events (id, contractId, message, date, isRead)

### Indexes

Indexes are created on:

- `players.googleAccountId` - For account lookup
- `google_accounts.googleId` - For unique Google account lookup
- `teams.playerId` - For finding player's teams
- `teams.leagueId` - For finding league's teams
- `contracts.teamId` - For finding team's contracts
- `notifications.contractId` - For finding contract notifications
- `leagues.adminId` - For finding leagues by admin

## Schema Relationship

The relationship between players and google_accounts is now **1:1**:

- Each player must have exactly one Google account
- The `players.googleAccountId` column is a unique foreign key referencing `google_accounts.id`
- Deleting a google_account will cascade-delete the associated player

## Notes

- All tables use `TEXT` for UUID-style IDs generated client-side
- Temporal dates are stored as ISO 8601 strings
- CASCADE deletes ensure referential integrity
- `created_at` timestamps are set to database server time
