---
title: Spec-Driven Development in the Gen AI–Assisted SDLC
date: 2026-07-15
eyebrow: Gen AI & SDLC
description: Why the spec matters more, not less, now that AI agents can generate code in seconds.
lede: AI coding agents didn't make the spec optional. They made it the only part of the job a human can't skip.
readTime: 8 min read
cardMedia: §
cardTag: Gen AI & SDLC
linkText: Read Article →
---

For most of software history, writing code was the bottleneck, so "just build it and see" was a reasonable way to explore ambiguity — code was expensive enough that you naturally thought before you typed. Gen AI assistants removed that friction. An agent can now generate a working-looking feature, across a dozen files, in the time it takes to read this paragraph. That sounds like it should make specs less necessary. It's the opposite: when generation is nearly free, the spec becomes the only remaining checkpoint where intent gets verified before code exists.

## AI is confident, not correct

A vague prompt to a human engineer usually triggers a clarifying question. A vague prompt to an AI coding agent usually triggers a confident, complete, plausible-looking implementation of the wrong thing — full test-passing, well-commented, and built on an assumption nobody actually signed off on. The agent isn't being careless; it's doing exactly what was asked, and "what was asked" was underspecified. Multiply that by how fast agents can now produce code and multi-file diffs, and an unclear starting point doesn't just waste an afternoon — it can quietly become the shape of a whole subsystem before anyone notices it was never actually decided.

## The spec is the interface you're actually programming

In an AI-assisted SDLC, the highest-leverage artifact a developer writes often isn't the code — it's the spec that the agent implements against. A good spec for this context answers the same questions it always has, but now doubles as the contract between human intent and machine execution:

- What is this feature supposed to do, in terms concrete enough for an agent to implement unambiguously?
- What are the explicit non-goals — the things it should *not* touch, refactor, or "helpfully" improve along the way?
- What does "correct" look like, precisely enough to write a test or acceptance check against — not just prose a human nods along to.

This is a different skill than writing a spec for a human teammate. Humans fill gaps with shared context and will ask before doing something drastic. Agents fill gaps with the most statistically plausible completion, and increasingly, agentic tools will just go do it — open files, edit them, run commands. The looser the spec, the more of that gap-filling happens without a human ever weighing in.

> Prompting is spec-writing with the safety rails removed. The clearer the spec, the less the agent has to guess — and guessing is exactly where things go wrong at agent speed.

## A workflow that actually holds up with AI in the loop

1. Write a short, scoped spec for the next unit of work — inputs, outputs, non-goals, and how you'll know it's done.
2. Have the agent implement against that spec, not against an open-ended chat description of the whole feature.
3. Review the diff against the spec's acceptance criteria specifically, not just "does this look reasonable" — the agent optimized for plausibility, and plausibility is not the same axis as correctness.
4. When reality disagrees with the spec — a constraint you missed, an edge case the agent surfaced — update the spec deliberately, then re-generate or hand-edit. Don't let the code silently drift from a spec nobody bothered to revise.

Note what's missing from that loop: nowhere does it say "write less spec because the agent is fast." Agent speed changes step 2's duration, not steps 1 and 3's necessity. If anything, the review step matters more now, because the volume of AI-generated code a team can produce in a day has grown much faster than most review processes have adapted to handle.

## The token efficiency tension

Here's the catch the argument so far conveniently skips: writing a more precise spec usually means writing a longer one, and longer isn't free. Every token in the spec is a token that has to be read, held in context, and re-processed on every subsequent turn of an agentic loop — alongside the codebase, the conversation history, and every tool call's output. Unlike a document sitting in a wiki that a human skims once, a spec fed to an agent gets paid for, in latency and in cost, again and again as the interaction continues.

This creates a real tension, not just a nice-to-have optimization. Under-specify and you're back to square one — the agent fills gaps with guesses. Over-specify and you burn context budget that would otherwise go toward the agent actually reasoning about the codebase, and you risk burying the two constraints that genuinely matter under twenty paragraphs of boilerplate the agent has to wade through to find them. A spec that's technically complete but bloated can fail for almost the same reason a vague one does: the signal the agent needs gets lost, just by a different mechanism.

- Prefer structured bullets and explicit constraints over narrative prose — density matters more than completeness of phrasing.
- Don't re-explain context the agent can already see — the existing code, an open file, an earlier message in the same session. Restating it costs tokens twice for zero new information.
- Reserve exhaustive edge-case enumeration for the edge cases that are actually likely or actually costly if missed — not every theoretical branch.
- Write for re-reading: a spec an agent (or a teammate) has to re-scan on every iteration should be skimmable in seconds, with the acceptance criteria easy to find, not buried mid-paragraph.

The goal isn't the longest spec that removes all ambiguity, and it isn't the shortest spec that fits in a tweet — it's the minimum spec that removes the ambiguity that actually matters for this task. That's a genuinely harder writing skill than either extreme, and it's one that gets more valuable, not less, as context windows keep filling up with everything else an agent needs to hold at once.

## Where this differs from classic upfront specs

The old objection to spec-first work was that a big upfront document goes stale the moment requirements shift, and that criticism still applies to big upfront documents. It doesn't apply to small, scoped specs written per unit of work, which is exactly the granularity that fits an agentic workflow anyway — most agent tasks are already scoped to "this feature" or "this bug," not "the whole system." Writing that scope down explicitly costs a few minutes and turns an implicit prompt into something reviewable, revisable, and reusable the next time a similar task comes up.

## The real risk isn't slow output, it's unreviewable output

The bottleneck in an AI-assisted SDLC quietly moves from "how fast can we write code" to "how fast can we trust what got written." A spec is what makes trust checkable instead of vibes-based — it gives the human reviewer, and the agent itself on the next iteration, a fixed target to check the output against. Skip it, and you're not saving time; you're deferring the ambiguity to code review, where it's far more expensive to untangle because now it's wrapped in working syntax that looks intentional.

## The actual leverage

Gen AI didn't remove the need for engineering judgment — it moved where that judgment has to be applied. It used to live mostly in the code. Now it has to live mostly in the spec, before the code exists, because that's the last point where a human is reliably still in the loop. Teams that treat spec-writing as the premium skill in an AI-assisted workflow will get compounding leverage from every agent they add. Teams that treat it as overhead will get code faster and correct systems slower.
