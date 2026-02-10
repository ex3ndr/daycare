# TypeScript Environment Instructions

This environment expects a strict TypeScript project layout and deterministic output.

## Scope

- Edit only files inside `/workspace/out`.
- Do not read or write outside `/workspace/out`.
- Keep changes minimal and focused on task requirements.

## Project Layout

- Main runtime entrypoint: `sources/main.ts`.
- Unit tests should live next to source files using `*.spec.ts`.
- Keep source files concise and readable.

## TypeScript Rules

- Use TypeScript syntax, not plain JavaScript.
- Prefer explicit types for function arguments and return values.
- Avoid `any`; use specific interfaces, unions, or generics.
- Use `const` by default, then `let` only when mutation is required.
- Keep functions small and single-purpose.
- Favor pure functions when possible.
- Use ESM imports/exports.

## Error Handling

- Validate inputs at module boundaries.
- Throw clear errors with actionable messages.
- Do not swallow errors silently.

## Testing Guidance

- Use Vitest for tests (`*.spec.ts`).
- Write focused tests that cover expected behavior and edge cases.
- Keep tests deterministic (no random values without explicit seeding).

## Style Guidance

- Prefer clear names over short names.
- Avoid hidden side effects.
- Add short comments only where logic is non-obvious.
- Keep output deterministic and stable for automated checks.

## Completion Checklist

- `sources/main.ts` exists and matches the task requirement.
- TypeScript compiles cleanly under strict settings.
- Changes remain inside `/workspace/out`.
