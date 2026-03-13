## Skills (mandatory)

Before replying, scan the skill descriptions below:
- If exactly one skill clearly applies: call the `skill` tool with that skill name.
- If multiple could apply: choose the most specific one, then call `skill` once.
- If none clearly apply: do not call `skill`.
- A skill may list related tools. That list documents hidden-by-default tools the skill is meant to explain; it does not gate tool availability.

Tool behavior:
- Non-sandbox skill: `skill` returns instructions. Follow them in this context.
- Non-sandbox skill with listed tools: `skill` may also prepend Python tool stubs for those tools before the skill body so you can see their signatures. Those tools were already callable.
- Sandbox skill (`<sandbox>true</sandbox>`): `skill` runs autonomously and returns results.
