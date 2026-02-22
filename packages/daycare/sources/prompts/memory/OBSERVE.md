{{#if isForeground}}
Extract observations from a conversation between a person and an AI assistant. Each observation is a discrete fact worth remembering across sessions.
{{else}}
Extract observations from an automated agent's task execution log. There is no human participant. Each observation is a discrete fact about what was done, what succeeded/failed, and what was learned. Focus on systems, processes, and outcomes rather than personal preferences.
{{/if}}

Capture everything with signal — intents, actions, outcomes, preferences, decisions, tool failures/recoveries, working strategies, processes, people, relationships, context. No fixed categories. If it matters later, extract it.

## 1.0 Density

¶1 Maximum information per token. Cut filler, hedging, preamble. Every word carries meaning or gets cut.

¶2 Contrast:
- ✗ "The person mentioned that they would prefer to have shorter responses in the future"
- ✓ "Prefers short direct answers — said 'get to the point' when preamble preceded the answer"
- ✗ "There was an issue with the image generation tool where it failed to produce good results"
- ✓ "Image generation: photo-realistic portrait → distorted faces. Fix: illustration style + shorter prompt"

## 2.0 What to Extract

¶1 **Intents** — what the person wanted, why, motivation. Specific: "watercolor cat on windowsill, soft pastels" not "wanted an image".

¶2 **Actions + outcomes** — what was done, what was produced, result quality. "Generated birthday card for Marco: hand-drawn, warm colors, dog in party hat, witty message. Person happy, printing it."

¶3 **Preferences** — style, tone, format, detail level. Corrections are strong signal — when they asked for something different, record both the rejected and preferred approach.

¶4 **Decisions** — what was chosen over what, why. Reasoning reveals priorities.

¶5 **Tool failures + recoveries** — which tool, what input caused failure, what the bad output looked like, what fixed it. Most valuable observations — prevent repeating mistakes. "Web search: restaurant name without city → wrong results. Adding city fixed it. Rule: always include city for local queries."

¶6 **Working strategies** — approaches that produced good results. Reusable recipes: "illustration style > photo-realistic for people-portraits", "image prompts under 30 words avoid truncation".

¶7 **Processes** — multi-step workflows, order of operations, workarounds, tool chains.

¶8 **Reactions** — liked result? Frustrated? Iterated? Abandoned?

¶9 **People + context** — names mentioned, projects, recurring topics, background facts, relationships.

## 3.0 Structure

¶1 Each observation has two fields:
- `text` — the observation: one fact, intent, preference, outcome, or lesson. Dense, self-contained.
- `context` — situation that makes it meaningful: what was discussed, what prompted it, surrounding details. Also dense.

¶2 Self-contained — readable without the original conversation.

¶3 Specific over vague. Vague = worthless.

¶4 Skip zero-signal mechanical exchanges. Empty list if nothing to remember.

## 4.0 Output

XML. No preamble, no markdown fences, no explanation.

```xml
<observations>
<observation>
<text>Wanted birthday card for Marco — hand-drawn, warm colors, witty message, dog in party hat. Happy with result, printing it.</text>
<context>Marco's birthday. Wanted personal over store-bought. Marco likes humor + dogs. Card matched all criteria.</context>
</observation>
<observation>
<text>Prefers direct concise answers — said "get to the point" when preamble preceded the actual answer.</text>
<context>Thailand visa question. Response led with culture paragraph before visa info. Person cut it short. Shorter follow-ups landed better.</context>
</observation>
<observation>
<text>Image generation: photo-realistic people-portraits → distorted faces. Fix: illustration style + simpler prompt. Worked first retry.</text>
<context>Family portrait as gift. Two photo-realistic attempts failed. Warm illustrated style + fewer details succeeded. Use illustration-first for people.</context>
</observation>
<observation>
<text>Web search: local business name without city → wrong results. Adding city to query fixed immediately.</text>
<context>"La Petite Maison" search hit other cities. Adding "Kyiv" found it. Rule: always include city for location-specific queries.</context>
</observation>
</observations>
```
