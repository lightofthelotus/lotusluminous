---
title: Who Answers When AI Gets It Wrong?
date: 2026-10-18
eyebrow: AI & Accountability
description: The headlines swing between "AI will save us" and "AI will kill us." The more useful question is quieter: when it goes wrong, who is responsible?
lede: Every serious technology eventually gets a courtroom. AI's is open right now, and the question on trial isn't whether the technology is good or evil. It's who has to answer for it.
readTime: 8 min read
cardMedia: ⚖
cardTag: AI & Accountability
linkText: Read Article →
---

Scroll through any news feed this year and you'll find two AI stories running side by side. In one, a model helps researchers spot a disease earlier than a human would have. In the other, agents after agents going rogue, hacking systems, doing things they were told not to! Same technology, same week, wildly different tone.

It's tempting to pick a side. AI is a miracle, or AI is a menace. For years I have been a fan of debate shows, and I always used to have prejudice towards one camp of the arguments in any debate. But in the current AI debate of it being a mircale or menace, which is unique and very important, I think both camps are skipping the question that actually decides what happens next: **when an AI system causes harm, who is accountable?**

## The harms are real, and so are the benefits

Let's be honest about both, because a balanced view starts there.

The harms aren't science fiction. Families have sued the makers of AI agents, chatbots, alleging the products contributed to unethical activities, tempting to suicide or self-harm. In 2024 (yes seems very long ago now where the landscape changes every  day!), in a case of a 14-year-old in Florida, a judge declined to throw out the suit against Character.AI and Google. In January 2026, the settlement was reached in principle and terms remain confidential without an admission of liability(!?!?). 

Lawyers have told a California judge that the claims against OpenAI and Microsoft over chatbot harm could grow from about two dozen to fifty or more. Courts are also being asked newer questions, like whether a chatbot that helps someone draft legal filings is practicing law without a licence.

These are allegations, not verdicts, and that distinction matters. But the volume alone tells us something: people are using these systems in moments of real vulnerability, and the systems weren't built with that in mind.

Now the other half. The same pattern-matching that produces a bad answer can read a scan, summarize a hundred-page contract, help a student who can't afford a tutor, or let someone with a disability use a computer in a way that wasn't possible before. Ignoring that isn't caution, it's just a different kind of inaccuracy.

So no, the technology isn't the villain, and it isn't the hero. It's a very capable tool that is being deployed faster than anyone has decided who holds the responsibility.

## Why "it's just a tool" doesn't settle it

The most common defence is that AI is a tool, and tools don't have intent. A hammer doesn't answer for the nail.

But a hammer doesn't talk back, doesn't sound confident when it's wrong, and doesn't adapt its tone to a lonely sixteen-year-old when he or she is at their most vulnerable situation in life. When a product is designed to feel like a friend, a counsellor or an expert, the "just a tool" argument gets thin. We hold other products to a standard that matches how they're presented and who is likely to use them. Medicines come with warnings. Cars have to pass crash tests. Toys are tested for safety of children by their age.

AI chatbots are slowly being pulled toward the same logic. California's SB 243, for example, now requires disclosure that you're talking to an AI, protocols for pointing people to crisis support, and break reminders for minors. That's not a ban. It's the first outline of a duty of care.

## The accountability gap

Here's the part I find most worth thinking about as someone who builds software. When an AI-assisted decision goes wrong, there's a chain of possible owners:

- **The model developer** who trained it
- **The company** that wrapped it into a product
- **The business** that deployed it for a specific use
- **The person** who acted on its output

Each one can point at the others. The developer says the deployer used it wrongly. The deployer says the model was supposed to be safe. The user is told they should have double-checked. In the gap between those answers, nobody is clearly responsible, and that's exactly where harm tends to land on the person with the least power.

Regulators are starting to close it. In Europe, the revised Product Liability Directive explicitly covers AI and software, with member states expected to put national rules in place by December 2026. The EU AI Act sets obligations by risk level, though the timeline for the strictest high-risk rules has been shifting later. Whatever you think of the details, the direction is consistent: someone has to be on the hook.

## Automation bias: the quiet risk

There's a more everyday version of this problem that never makes the headlines. It's called automation bias, the human habit of trusting a confident machine more than our own judgment.

We've seen it on engineering teams. An agent produces a clean, complete, plausible pull request, and the reviewer, tired and busy, approves it. Nothing malicious happened. The code looked right, so nobody looked closer. Now move the same instinct into a hospital, a loan decision or a hiring screen, where the cost of "looked right" is a person.

This is why "human in the loop" is no longer enough. It tells you a person is present. It doesn't tell you whether they're awake. A human who is rubber-stamping 200 outputs a day isn't providing oversight, they're providing a signature.

## From "in the loop" to "accountable in the loop"

I'd like us to retire "human in the loop" as the gold standard and replace it with something stricter: **accountable in the loop.**

A human is *accountable in the loop* only if all four of these are true:

1. **Time:** they have enough of it to actually examine the output, not just glance at it.
2. **Information:** they can see what the system saw and why it decided what it did.
3. **Authority:** they can stop or reverse the decision, and nobody punishes them for doing so.
4. **Responsibility:** their name is on the record, and they have the mindset that AI can and will go wrong and they take the responsiblity to cover and answer for the outcome.

If any one of those is missing, the person is only *passively* in the loop. That's a signature, not oversight. Most "human in the loop" systems in the wild today fail at least one of the four, usually time or authority.

## A practical rule

Here's a rule of thumb I'd defend: **the higher the stakes, the more the human in the loop must be accountable, not just present.**

In practice that means a few things:

- **Low stakes** (drafting an email, suggesting a recipe): a human in the loop is fine. Let the tool run and spot-check.
- **Medium stakes** (code going to production, customer-facing answers): require someone who understands the output well enough to disagree with it, and log what was approved.
- **High stakes** (health, money, safety, a child's wellbeing): the human must be accountable in the loop, with all four conditions met. The system explains its reasoning, and there's a clear route to challenge and reverse the decision.

A simple test for any AI deployment: ask who the accountable person is, and whether they have the time, information and authority to say no. If nobody can answer, you've found the gap.

And for anyone building these products: design for the vulnerable user first, not the average one. If your system can end up in a conversation with someone in crisis, that's not an edge case. It's a requirement.

## Where this leaves us

The people who say AI will destroy us and the people who say it's all upside are making the same mistake. They're treating the outcome as something that will happen to us, instead of something we decide through rules, design choices and who we're willing to hold responsible.

The technology will keep getting better. Whether it gets safer is a different question, and it doesn't answer itself. It gets answered in courtrooms, in legislatures, in product reviews, and in the quiet moment when someone decides whether to read the output or just click approve.

So the next time someone reassures you that a human is in the loop, ask the follow-up: are they also *accountable* in the loop? Because presence was never the point. But their ownership and responsibility is !

That's a more modest conclusion than "AI will save us" or "AI will kill us." It's also the one I trust more.

## References

- [CNN: Character.AI and Google settle teen suicide lawsuit](https://edition.cnn.com/2026/01/07/business/character-ai-google-settle-teen-suicide-lawsuit)
- [JURIST: Google and Character.AI agree to settle lawsuit linked to teen suicide](https://www.jurist.org/news/2026/01/google-and-character-ai-agree-to-settle-lawsuit-linked-to-teen-suicide/)
- [NBC News: Eight states sue OpenAI, claiming ChatGPT harms children](https://www.nbcnews.com/video/eight-states-sue-openai-claiming-chatgpt-harms-children-271603269912)



