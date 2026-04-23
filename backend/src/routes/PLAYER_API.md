# Player API Documentation

The Player API provides endpoints to manage player accounts and retrieve their league associations. All endpoints use D1 database for persistence and follow the Result<T> error handling pattern.

## Base URL

```
/api/players
```

## Endpoints

### 1. Create a New Player

**POST** `/api/players`

Create a new player with a username.

**Request Body:**

```json
{
  "username": "john_doe"
}
```

**Success Response (201):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john_doe"
}
```

**Error Response (400/500):**

```json
{
  "error": "Username is required" or "Error saving player: ..."
}
```

---

### 2. Get Player by ID

**GET** `/api/players/:id`

Fetch a player by their UUID.

**Parameters:**

- `id` (string) - Player UUID

**Success Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john_doe"
}
```

**Error Response (404):**

```json
{
  "error": "Player with id 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

---

### 3. Get Player by Google Account ID

**GET** `/api/players/account/:accountId`

Fetch a player by their Google account ID.

**Parameters:**

- `accountId` (string) - Google account ID from `google_accounts` table

**Success Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john_doe"
}
```

**Error Response (404):**

```json
{
  "error": "Player with account id ... not found"
}
```

---

### 4. Get Player's Leagues

**GET** `/api/players/:id/leagues`

Fetch all leagues a player is associated with (through teams).

**Parameters:**

- `id` (string) - Player UUID

**Success Response (200):**

```json
[
  {
    "id": "league-001",
    "name": "Global League",
    "adminId": "admin-id",
    "startDate": "2024-04-21T18:00:00Z",
    "endDate": "2024-05-21T18:00:00Z",
    "domain": "en",
    "icon": "🌍"
  },
  {
    "id": "league-002",
    "name": "Italia League",
    "adminId": "admin-id-2",
    "startDate": "2024-04-22T18:00:00Z",
    "endDate": "2024-05-22T18:00:00Z",
    "domain": "it",
    "icon": "🇮🇹"
  }
]
```

**Empty Response (200):**

```json
[]
```

**Error Response (500):**

```json
{
  "error": "Error retrieving leagues: ..."
}
```

## Implementation Details

### Service Layer

The `PlayerService` class in `src/services/player.ts` provides a clean interface to the `PlayerRepositoryD1`:

```typescript
const service = new PlayerService(db);
const result = await service.getPlayerById(playerId);
if (result.ok) {
  console.log(result.value); // Player data
} else {
  console.error(result.error); // Error message
}
```

### Repository Layer

The `PlayerRepositoryD1` in `src/repositories/d1/playerRepositoryD1.ts` handles all D1 database operations:

- Uses parameterized queries to prevent SQL injection
- Wraps results in `Result<T>` type for consistent error handling
- Provides transaction-safe operations

### Route Handlers

Player routes in `src/routes/players.ts` mount to `/api/players` and provide:

- Input validation (e.g., required fields)
- Proper HTTP status codes (201 for created, 404 for not found, 500 for errors)
- JSON request/response handling

## Database Schema

See `backend/migrations/README.md` for database migration instructions and complete schema documentation.

### Related Tables

- `players` - User accounts (id, username)
- `google_accounts` - OAuth account associations (id, googleId, email, playerId)
- `teams` - Player-league associations (id, name, playerId, leagueId, credits)
- `leagues` - League definitions (id, name, adminId, startDate, endDate, domain, icon)

## Error Handling

All endpoints follow the Result<T> pattern:

- Success: `{ ok: true, value: T }`
- Failure: `{ ok: false, error: string }`

HTTP Status Codes:

- `201` - Player created successfully
- `200` - Request succeeded
- `400` - Bad request (missing required fields)
- `404` - Resource not found
- `500` - Server error
