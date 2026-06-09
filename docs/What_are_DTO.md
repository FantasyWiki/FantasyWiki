### Concept:
- Both Backend and Frontend independently wrap domain data into local DTOs to add internal functionality, state, or metadata.

Every service has the duty of converting model data into its proper DTO (Data Transfer Object)
if additional field or methods for processing or visualization is required.
The frontend "dresses" the domain data to add UI commodity methods and computed fields,
such as determining whether a chemistry link should render as excellent, good, weak, or empty in the formation view.
Conversely, the backend "dresses" the pure data into its own internal DTOs to attach database metadata,
handle security contexts, or manage server-side validations.

### Deserialization: `ContractDTO.fromRaw`

The API returns dates and durations as ISO-8601 strings (a `RawContract`). Converting that
raw payload into a `ContractDTO` (with `Temporal.Instant` / `Temporal.Duration` fields) is the
DTO's own responsibility, exposed as the static factory `ContractDTO.fromRaw(raw)` in
`dto/contractDTO.ts`. Services (`frontend/src/services/api.ts`, `frontend/src/services/teamService.ts`)
call this single factory instead of constructing `new ContractDTO(...)` themselves, so the
string→Temporal conversion lives in exactly one place.