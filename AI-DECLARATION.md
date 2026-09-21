---
version: "0.1.2"
level: copilot
processes:
  design: pair
  implementation: copilot
  testing: copilot
  documentation: copilot
  review: assist
  deployment: copilot
---
This format is based on [AI-DECLARATION.md](https://ai-declaration.md/en/0.1.2).

## Notes

- **Tools.** Claude Code (CLI and IDE) and GitHub Copilot, the latter both as a
  coding agent opening pull requests on `copilot/*` branches and in the editor.
- **Design is paired, not delegated.** The domain model, the game's economy and
  every decision recorded under `docs/adr/` were settled by the two authors. AI
  was a sparring partner there, mostly through the `grill-me` skill, which
  interrogates a plan until its open branches are resolved.
- **Implementation, tests, documentation and CI/CD were written with an agent
  at `copilot` level**: a human states the task, the agent carries it out and
  asks for permission or clarification along the way, and a human reviews the
  diff before it is committed. Nothing reached `master` without one of the two
  authors merging it: the six commits the Copilot agent authored arrived as pull
  requests an author reviewed and merged.
- **What an agent is told** is in [`AGENTS.md`](./AGENTS.md), which Claude Code
  and Copilot both read. The skills the agents used, and why, are in
  [AI assistance](./docs/development/ai-assistance.md).
- **The Article Genie is not covered here.** It is a product feature that calls
  a hosted model at run time ([ADR 0006](./docs/adr/0006-article-genie.md)); this
  file declares how the code was written, not what the code does.
