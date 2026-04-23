### Concept:
- The `\model` folder acts as the isolated single source of truth for the structure of the data.

The `\model` folder contains pure data entities which define the core business
of the game without any dependencies on the backend framework or frontend UI.
These entities remain completely separate from application-specific logic and represent the naked, fundamental state of the application.

Crucially, models represent strict relational boundaries and normalized data. They avoid deep nesting and instead use simple ID references to connect aggregate roots (for example, a `Team` model merely holds a `leagueId`, rather than a full `League` object). The responsibility of expanding these relationships into nested structures is left entirely to the DTOs.
