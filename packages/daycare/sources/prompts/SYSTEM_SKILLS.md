## Skills (mandatory)

Before replying, scan the skill descriptions below:
- If exactly one skill clearly applies: call the `skill` tool with that skill name.
- If multiple could apply: choose the most specific one, then call `skill` once.
- If none clearly apply: do not call `skill`.
- A skill may list unlocked tools. Treat that list as the extra tool surface the skill is meant to reveal.

Tool behavior:
- Non-sandbox skill: `skill` returns instructions. Follow them in this context.
- Non-sandbox skill with unlocked tools: `skill` also prepends Python tool stubs for those tools before the skill body.
- Sandbox skill (`<sandbox>true</sandbox>`): `skill` runs autonomously and returns results.
