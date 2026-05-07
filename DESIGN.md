---
name: FantasyWiki
description: Competitive fantasy-league UI built around Wikipedia strategy gameplay.
colors:
  primary-league-green: "#1e7e50"
  primary-league-green-light: "#358e62"
  primary-league-green-dark: "#1a6f46"
  accent-wiki-gold: "#f5c842"
  neutral-paper: "#fbfbf7"
  neutral-surface: "#f0f5f0"
  neutral-ink: "#171f1b"
  neutral-muted: "#737f73"
  border-soft: "#cdd8cd"
  dark-primary-league-green: "#3ab87a"
  dark-neutral-surface: "#111c16"
  dark-neutral-paper: "#1a221d"
  dark-neutral-ink: "#f0f0ed"
typography:
  display:
    fontFamily: "\"Libre Baskerville\", Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "\"Libre Baskerville\", Georgia, serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "\"Libre Baskerville\", Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
  body:
    fontFamily: "\"Source Sans 3\", -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Roboto\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"Source Sans 3\", -apple-system, BlinkMacSystemFont, \"Helvetica Neue\", \"Roboto\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-league-green}"
    textColor: "{colors.neutral-paper}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "48px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-league-green-dark}"
    textColor: "{colors.neutral-paper}"
    rounded: "{rounded.md}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
  button-clear:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
  card-default:
    backgroundColor: "{colors.neutral-paper}"
    textColor: "{colors.neutral-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
---

## Overview
**The Competitive Knowledge Arena Rule.** FantasyWiki should feel like a tactical game board, not a passive dashboard. The visual system is strategic, energetic, and clear, with gameplay urgency carried by hierarchy and action focus rather than decorative noise.

**The Confident Clarity Rule.** Surface key decisions fast, keep interaction friction low, and preserve readability in both light and dark modes.

## Colors
**The League Green Rule.** League Green (`#1e7e50`) is the core action color for primary affordances and selected states. Its lighter and darker variants tune emphasis without changing hue identity.

**The Wiki Gold Rule.** Wiki Gold (`#f5c842`) marks reward, ranking, and prestige moments. It is an accent, not a default background fill.

**The Paper Sage Neutral Rule.** Paper/sage neutrals (`#fbfbf7`, `#f0f5f0`, `#171f1b`, `#737f73`) keep the interface readable and game-like while avoiding sterile monochrome.

## Typography
**The Editorial-Gameplay Pairing Rule.** Use Libre Baskerville for display/headline/title moments to reinforce a knowledge-first personality, and Source Sans 3 for body/label text to keep controls and data scannable.

**The Contrast Hierarchy Rule.** Maintain strong role separation between display/headline/title/body/label styles so competitive signals are immediately legible.

## Elevation
**The Layered-Light Rule.** The system is mostly flat, with selective lift for modal and state emphasis. Shadows stay soft and sparse, supporting hierarchy rather than visual effect.

## Components
**The Game-Ready Controls Rule.** Buttons, cards, and interactive surfaces should feel confident and game-ready: rounded corners, compact spacing, clear hover/focus responses, and immediate action readability.

**The State Visibility Rule.** Error, loading, and empty states must be explicit, icon-supported, and actionable (retry, navigate, or next-step CTA).

## Do's and Don'ts
**Do** design for strategy legibility, decisive actions, and persistent league context.

**Do** keep competitive energy visible while preserving calm readability.

**Don't** make the UI feel boring or static.

**Don't** use generic "for sale" marketing templates or sterile corporate dashboard tropes.
