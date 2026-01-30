# grambot agent notes

## Goals
- keep the core minimal and composable
- add integrations incrementally

## Conventions
- single workspace package at `packages/gram`
- typescript only, esm output
- sources live in `sources/`
- tests use `*.spec.ts`

## Commands
```sh
yarn install
yarn build
yarn test
yarn typecheck
```

## Working agreements
- keep configs small and explicit
- avoid hidden side effects
- commit after each ready-to-use change using Angular-style commits
- build before each commit and run tests
- document every change in `/docs/` with mermaid diagrams
- do not use barrel `index.ts` files
- avoid backward-compatibility shims for internal code
