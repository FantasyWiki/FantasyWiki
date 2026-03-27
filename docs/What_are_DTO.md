### Concept:
- Both Backend and Frontend independently wrap domain data into local DTOs to add internal functionality, state, or metadata.

Every service has the duty of converting model data into its proper DTO (Data Transfer Object)
if additional field or methods for processing or visualization is required.
The frontend "dresses" the domain data to add UI commodity methods and computed fields,
such as determining if a mutual link between articles should be colored green, yellow, or red in the formation view.
Conversely, the backend "dresses" the pure data into its own internal DTOs to attach database metadata,
handle security contexts, or manage server-side validations.