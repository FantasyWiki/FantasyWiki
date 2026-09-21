---
title: AI Assistance
type: development
tags: [ai, genai, agents, skills, process, declaration]
related:
  - ./development-process.md
  - ../../AI-DECLARATION.md
  - ../../AGENTS.md
---

# AI assistance

Generative AI was used to build FantasyWiki, and this page says for what, how,
and under which constraints. The machine-readable form of the same statement is
[`AI-DECLARATION.md`](../../AI-DECLARATION.md), which follows the
[AI-DECLARATION.md](https://ai-declaration.md/) convention: when the two
disagree, fix whichever is wrong, they are one claim.

It is about how the code was written. The **Article Genie** also uses a language
model, but as a feature that runs in production, and it is covered where the
feature is: [ADR 0006](../adr/0006-article-genie.md).

## The tools, and the level of involvement

Two tools: **Claude Code**, in the terminal and the editor, and **GitHub
Copilot**, both as a coding agent that opens pull requests from `copilot/*`
branches and in the editor.

| Process | Level | What that meant here |
|---|---|---|
| Design | `pair` | The domain model, the economy and every ADR were decided by the authors, with an agent as the other side of the argument |
| Implementation | `copilot` | An author states the task; the agent carries it out, asking before it acts; the author reviews the diff |
| Testing | `copilot` | As implementation, mostly test-first |
| Documentation | `copilot` | As implementation, against the voice and rules in `docs/agents/documentation-site.md` |
| Deployment | `copilot` | Workflows and build scripts, as implementation |
| Review | `assist` | An agent points at problems; the decision to merge is an author's |

The levels are the convention's: `pair` is both acting on the task with the
human understanding its internals; `copilot` is the agent doing the whole task
while asking for permission or clarification; `assist` is the agent acting on a
part of it. Nothing here is `auto`, an agent completing a task with no human in
the loop.

## How an agent is kept inside the lines

**One instruction file.** [`AGENTS.md`](../../AGENTS.md) is what every agent
reads, Claude Code through `CLAUDE.md`, which imports it, and Copilot directly.
There used to be three copies, one per tool, and the Copilot one had fallen
behind the build it described. A second copy of an instruction is a second
instruction.

**The vocabulary and the decisions are written down first.** `CONTEXT.md` is the
glossary an agent must use, and `docs/adr/` holds the decisions it must not
relitigate. Both are human-owned: an agent may propose a term or an ADR, and an
author writes it. This is what keeps a model's fluent synonym for *Free Agent*
out of the code.

**The tests are the check, not the agent's confidence.** Backend tests run
against a real database on both persistence targets, and a rule an agent
implemented is accepted when a test states it, not when the agent says it is
done ([Backend Testing](./backend-testing.md)).

**Only an author merges.** `master` accepts nothing but pull requests with signed
commits and a green `ci-cd / success`
([Development Process](./development-process.md)). An agent's work, whether a
Copilot pull request or a Claude Code session's diff, reaches `master` when an
author merges it, and in the Claude Code case after the author has committed it
themselves.

**Where to see it.** Commits written with Claude Code carry a
`Co-Authored-By: Claude` trailer when the session added one; 36 commits on
`master` do, the first on 2026-06-21. The six commits the Copilot agent authored
carry `Copilot` as their author. The absence of a trailer is not evidence that
no agent was involved.

## Skills

A skill is a packaged set of instructions an agent loads for one kind of task.
Four were used, each for a job where an unguided agent fails in a recognisable
way.

| Skill | Used for | Why a skill rather than a prompt |
|---|---|---|
| `grill-me` | Stress-testing a design before it became an ADR | An agent asked to review a plan tends to agree with it. This one interviews the author branch by branch until every open decision is resolved, and it is the author who answers. |
| `tdd` | Red, green, refactor on backend rules | It makes the agent write the failing test first and stop there, so the test states the rule before any code can shape it to fit. |
| `diagnose` | Hard bugs | It forces reproduce, minimise, hypothesise, instrument, before any fix, instead of the plausible patch an agent reaches for first. |
| `improve-codebase-architecture` | Finding modules worth deepening or merging | It reads `CONTEXT.md` and `docs/adr/` before proposing anything, so its suggestions use the project's words and respect decisions already taken. |

The skills read their project configuration from fixed paths under
`docs/agents/`, which is why that directory must not move. It also holds the
configuration for an issue-tracker and a triage skill; those were set up with
the others and not used, which is why no issue carries a triage label.

## Related

- [`AI-DECLARATION.md`](../../AI-DECLARATION.md): the same statement, machine-readable
- [`AGENTS.md`](../../AGENTS.md): what every agent is told
- [Development Process](./development-process.md): the gate an agent's work passes like anyone's
- [ADR 0006: Article Genie](../adr/0006-article-genie.md): the model that runs in production
