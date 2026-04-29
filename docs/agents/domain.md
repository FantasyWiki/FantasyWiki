# Domain docs

This repository is configured as **single-context**.

## Layout

- Domain context file: `CONTEXT.md` at repo root
- Architectural decision records: `docs/adr/` at repo root

## Consumer rules for skills

- Skills that need domain language should read `CONTEXT.md` first.
- Skills that need historical architecture decisions should then read `docs/adr/`.
- If either path is missing, continue with codebase inspection and note the missing docs in outputs.
