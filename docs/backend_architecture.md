# FantasyWiki Backend Architecture

## Requirements


## Overview

The FantasyWiki backend uses a **Repository Pattern** to decouple core business logic from persistence implementation details. This design allows switching between **Cloudflare D1 (SQL)** and **MongoDB (local development)** at build-time through a single configuration flag.

## Architecture Overview

```
FantasyWiki/
├── model/                          # Shared domain entities (League, Contract, etc.)
│
├── repositories-core/              # Abstract interfaces + factory
│   ├── ILeagueRepository.ts
│   ├── IContractRepository.ts
│   ├── IPlayerRepository.ts
│   ├── ITeamRepository.ts
│   ├── INotificationRepository.ts
│   └── RepositoryFactory.ts
│
├── repositories-d1/                # Cloudflare D1 implementation
│   ├── D1LeagueRepository.ts
│   ├── D1ContractRepository.ts
│   ├── ... (other implementations)
│   └── schema.sql (migrations)
│
├── repositories-mongodb/           # MongoDB implementation (local dev)
│   ├── MongoDBLeagueRepository.ts
│   ├── MongoDBContractRepository.ts
│   └── ... (other implementations)
│
└── backend/                        # Express/Hono API
    ├── src/
    │   ├── services/               # Business logic (uses interfaces)
    │   │   ├── LeagueService.ts
    │   │   ├── ContractService.ts
    │   │   └── ...
    │   ├── routes/
    │   │   └── (handlers that call services)
    │   └── index.ts                # Initializes RepositoryFactory
    └── package.json                # Depends on repositories-core
```

## Module Responsibilities

### model
- Pure domain entities: `League`, `Contract`, `Player`, `Team`, `Notification`
- Zero dependencies on backend or database layer
- Shared by all consumers (frontend, backend, future services)

### repositories-core
- **Interfaces**: Abstract contracts for all repositories
  - `ILeagueRepository`, `IContractRepository`, `IPlayerRepository`, `ITeamRepository`, `INotificationRepository`
  - Each interface defines CRUD operations
- **RepositoryFactory**: Abstract factory pattern that returns repository instances
  - Actual implementation choice happens at runtime via constructor injection or environment config
- **Zero database knowledge**: No SQL, no MongoDB, no network details

### repositories-d1
- Cloudflare Workers D1 (serverless SQL) implementation
- Implements all repository interfaces using SQL queries
- Includes database schema (SQL migrations)
- Dependency: `@cloudflare/workers-types`, database binding
- **Use when**: Deploying to Cloudflare Workers
- It's the production implementation, for all architectural decisions, D1 is the **default and primary target**

### repositories-mongodb
- MongoDB driver implementation
- Implements all repository interfaces using MongoDB operations
- Connection management for local/remote MongoDB instances
- **Use when**: Only for "Applicazioni e Servizi Web" project delivery

### backend/
#### 1. Routes (HTTP Handlers)
- Thin wrappers over services
- Responsibilities:
  - Parse HTTP request (query params, path params, body)
  - Call appropriate service method
  - Handle HTTP-specific concerns (status codes, headers, CORS)
  - Handle authentication, the motives behind this choise can be found at Why-rest-layer-handles-authentication.md
- **Zero business logic** – no calculations, no entity manipulation
- **Zero database access** – never touches repositories directly

#### 2. Services (Business Logic)
- Core application logic decoupled from HTTP
- Responsibilities:
  - Implement business rules and workflows
  - Orchestrate operations across multiple repositories
  - Handle domain validation (e.g., league dates must be valid)
  - Transform domain entities as needed
  - Accept repository interfaces (not implementations) via dependency injection
- **Zero HTTP knowledge** – no request/response objects, no status codes
- **Zero database knowledge** – depends only on abstract repository interfaces
- Location: `backend/src/services/LeagueService.ts`, `backend/src/services/ContractService.ts`, etc.

#### 3. Repositories (Data Access)
- Abstract interfaces define data operations
- Concrete implementations (D1, MongoDB) handle persistence
- Services never know which database is being used
- See earlier sections for details

## Dependency Graph

```
                    model/
                      ↑
                      │
          repositories-core/
                 ↑         ↑
                /           \
    repositories-d1/    repositories-mongodb/
                 ↑           ↑
                  \         /
                   backend/
```

**Build-time conditional dependency:**
- `backend/` includes `repositories-core/` always
- `backend/` includes either `repositories-d1/` OR `repositories-mongodb/` based on `DATABASE_TYPE` flag
- Frontend and other consumers depend only on `model/`

## Initialization Flow

### 1. Build Configuration
Environment variable `DATABASE_TYPE` (default: `d1`) determines which implementation to use:
```bash
# Production
DATABASE_TYPE=d1 npm run build

# Local development
DATABASE_TYPE=mongodb npm run build
```

### 2. Gradle Orchestration
`settings.gradle.kts` conditionally includes the appropriate repository module:
```kotlin
if (System.getenv("DATABASE_TYPE") == "mongodb") {
    include("repositories-mongodb")
} else {
    include("repositories-d1")
}
include("repositories-core")
include("backend")
include("frontend")
```

### 3. Backend Initialization
`backend/src/index.ts`:
```typescript
import { RepositoryFactory } from "@fantasywiki/repositories-core";

// RepositoryFactory detects environment and returns correct implementation
const leagueRepository = RepositoryFactory.createLeagueRepository();
const contractRepository = RepositoryFactory.createContractRepository();
// ... etc

// Pass to service layer
const leagueService = new LeagueService(leagueRepository);
const contractService = new ContractService(contractRepository);
// ... etc

// Routes receive services (not repositories)
const leaguesRoutes = createLeaguesRoutes(leagueService);

app.route("/api/leagues", leaguesRoutes);
```

### 4. Request Handling
```
HTTP Request (POST /api/leagues)
    ↓
Route Handler (backend/src/routes/leagues.ts)
    ├─ Parse request body
    ├─ Validate HTTP structure
    └─ Call LeagueService.createLeague(dto)
        ↓
        Service Layer (backend/src/services/LeagueService.ts)
        ├─ Apply business logic
        ├─ Validate domain rules
        ├─ Call leagueRepository.create(entity)
        │   ↓
        │   Repository Interface
        │   ├─ Repository Implementation (D1 or MongoDB)
        │   ├─ Execute database query
        │   └─ Return domain entity
        ├─ Return entity to route
    ↓
Route Handler transforms entity to HTTP response
    ↓
HTTP Response (200 JSON)

## REST Layer Decoupling

The backend implements three independent layers:

### Layer Structure
```
Routes (HTTP)
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access)
```

### Routes
- **Responsibility**: HTTP protocol handling
- **Input**: Parse HTTP requests, query parameters, path parameters, request body
- **Output**: Format HTTP responses, set status codes and headers
- **Zero business logic**: No calculations, no entity manipulation, no workflows
- **Location**: `backend/src/routes/`

### Services  
- **Responsibility**: Application business logic and workflows
- **Input**: Domain objects and DTOs from routes
- **Output**: Domain entities and results
- **Zero HTTP knowledge**: No request/response objects, no status codes, no content negotiation
- **Dependencies**: Abstract repository interfaces only
- **Reusable by**: REST API, GraphQL, CLI, WebSocket, gRPC, or any other client
- **Location**: `backend/src/services/`

### Repositories
- **Responsibility**: Data persistence abstraction
- **Interface**: Abstract contracts (in repositories-core)
- **Implementations**: D1 or MongoDB (chosen at build-time)
- **Location**: `repositories-core/`, `repositories-d1/`, `repositories-mongodb/`

### Layer Contracts
```typescript
// Routes call services with domain objects
const league = await leagueService.createLeague(leagueData);

// Services call repositories with interfaces (never implementations)
class LeagueService {
  constructor(private leagueRepository: ILeagueRepository) {}
}

// Repositories implement interfaces
class D1LeagueRepository implements ILeagueRepository { }
class MongoDBLeagueRepository implements ILeagueRepository { }
```

### Layer Independence Rules
- ✅ Routes can reference Services and HTTP framework (Hono)
- ✅ Services can reference Repositories (interfaces only) and domain models
- ✅ Repositories reference domain models only
- ❌ Services never reference HTTP concerns (Hono context, request, response)
- ❌ Routes never reference repository interfaces or implementations
- ❌ Repositories never reference HTTP concerns

## Adding a New Repository

When adding a new entity (e.g., `Article`):

1. **Add to model/**
   - Create `Article` interface in `model/article.ts`

2. **Add to repositories-core/**
   - Create `IArticleRepository` interface
   - Update `RepositoryFactory` to include `createArticleRepository()`

3. **Add to repositories-d1/**
   - Create `D1ArticleRepository` implementing `IArticleRepository`
   - Add SQL table schema to migrations
   - Update factory implementation

4. **Add to repositories-mongodb/**
   - Create `MongoDBArticleRepository` implementing `IArticleRepository`
   - Configure collection indexes
   - Update factory implementation

5. **Add to backend/**
   - Create `ArticleService` using `IArticleRepository`
   - Create routes in `backend/src/routes/articles.ts`

## Testing Strategy

### Unit Tests
- Service tests mock repository interfaces
- No database interaction required
- Fast, isolated test suites

### Integration Tests
Each repository module (repositories-d1, repositories-mongodb) includes its own integration test suite:
- `repositories-d1/tests/` – tests against D1
- `repositories-mongodb/tests/` – tests against MongoDB

Both test suites validate the same interface contracts, ensuring swappability.

### Running Tests
```bash
# Unit tests (all services)
cd backend && npm run test

# Integration tests - D1 implementation
cd repositories-d1 && npm run test

# Integration tests - MongoDB implementation
cd repositories-mongodb && npm run test
```

## Switching Database Implementation

### Development: Switch from D1 to MongoDB
```bash
DATABASE_TYPE=mongodb npm run dev
# Gradle reloads, backend uses MongoDB repositories
```

### Deployment: D1 is Always Included
```bash
DATABASE_TYPE=d1 npm run build
# Cloudflare deployment gets D1 only
```

The switch is **zero-cost**:
- No code changes required
- No conditional statements in business logic
- No runtime checks
- Only dependency resolution changes at build time

## Comparison: D1 vs MongoDB

| Aspect | D1 | MongoDB |
|--------|-----|---------|
| **Environment** | Cloudflare Workers (prod) | Local development |
| **Setup** | Cloudflare project config | Docker / local instance |
| **Schema** | SQL migrations | Implicit (validated at app level) |
| **Performance** | Optimized for serverless | Better for local dev |
| **Scaling** | Cloudflare global CDN | Vertical only (local) |
| **Cost** | Cloudflare billing | Free (local) |

## NPM Workspaces (Optional Future Enhancement)

If the monorepo grows, consider using npm workspaces to simplify dependency management:

```json
{
  "name": "fantasywiki",
  "workspaces": [
    "model",
    "repositories-core",
    "repositories-d1",
    "repositories-mongodb",
    "backend",
    "frontend",
    "dto"
  ]
}
```

This would replace `file://` paths with workspace references and centralize `node_modules/`.

## Summary

The three-module repository pattern provides:

✅ **Clean Separation** – Business logic is decoupled from persistence  
✅ **True Modularity** – Each module can be tested and deployed independently  
✅ **Build-Time Flexibility** – Choose database at deployment time  
✅ **No Runtime Overhead** – Zero conditional checks in production code  
✅ **Extensibility** – New databases can be added without modifying core logic  
✅ **Type Safety** – Full TypeScript support across all layers  

By adhering to the repository pattern and maintaining clear module boundaries, the FantasyWiki backend remains maintainable, testable, and adaptable to future requirements.
