### Concept:
- The `\dto` folder contains shared Data Transfer Objects (DTOs) that define the structure of the data exchanged between the Backend and Frontend.

Unlike the pure domain models, DTOs are specifically tailored for communication over the network and heavily focused on frontend convenience. 

Crucially, DTOs are used to aggregate data (exploding aggregate roots) to avoid excessive API calls from the frontend. While the pure domain models adhere strictly to isolated relational boundaries (e.g., a `Team` model might just hold a `leagueId`), the DTOs eagerly nest these relationships. For example, a `LeagueDTO` directly contains a deeply nested collection of `TeamDTO`s.

The Backend executes these aggregations, resolving relationships and converting isolated model data into these enriched DTO trees before sending them across the network. The Frontend consumes these DTOs directly, benefiting from their shared schema, utility methods/computed getters (as seen in classes like `ContractDTO`), and the reduced need for subsequent fetching.
