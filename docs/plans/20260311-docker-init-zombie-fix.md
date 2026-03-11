# Add init process to Docker sandbox containers

## Overview
Sandbox containers use `ENTRYPOINT ["sleep", "infinity"]` as PID 1. `sleep` does not reap zombie child processes. When agent-spawned processes (like `yarn install`) die without being waited on, they become zombies that hold NFS file handles indefinitely, causing EBUSY errors on subsequent operations.

Fix: add `Init: true` to the Docker `HostConfig` when creating containers. This injects `tini` as PID 1, which automatically reaps zombie processes. The Dockerfile entrypoint stays as `sleep infinity` but runs as PID 2 under tini.

## Context
- Container creation: `packages/daycare/sources/sandbox/docker/dockerContainerEnsure.ts`
- Container creation spec: `packages/daycare/sources/sandbox/docker/dockerContainerEnsure.spec.ts`
- Dockerfiles: `packages/daycare-runtime/Dockerfile` and `packages/daycare-runtime/Dockerfile.minimal`
- Docker API `Init: true` in HostConfig is equivalent to `docker run --init`
- Existing containers will be recreated on next access since labels/config change detection is built in

## Development Approach
- Add `Init: true` to the `HostConfig` in `dockerContainerEnsure.ts`
- Add a staleness check so existing containers without init get recreated
- Update tests to verify `Init: true` is set
- No Dockerfile changes needed (tini is injected by Docker Engine at runtime)

## Testing Strategy
- Existing container creation tests must pass
- New test verifies `Init: true` is present in container creation config
- Typecheck passes

## Validation Commands
- `yarn typecheck`
- `yarn test packages/daycare/sources/sandbox/docker/dockerContainerEnsure.spec.ts`

## Progress Tracking
- [ ] keep task checkboxes updated
- [ ] add follow-up items inline when scope changes

## What Goes Where
- Implementation Steps: checkbox-driven tasks that can be completed in this repo
- Post-Completion: manual follow-up items with no checkboxes

## Implementation Steps

### Task 1: Add Init: true to container HostConfig
Files:
- `packages/daycare/sources/sandbox/docker/dockerContainerEnsure.ts`

Verify:
- `yarn typecheck`

- [ ] Add `Init: true` to the `HostConfig` object in the `docker.createContainer()` call (around line 163)
- [ ] Add a staleness label and check so existing containers without init get recreated (add `DOCKER_INIT_LABEL` constant, set label `daycare.init: "1"`, check in `containerStaleReasonResolve`)

### Task 2: Add test coverage for Init: true
Files:
- `packages/daycare/sources/sandbox/docker/dockerContainerEnsure.spec.ts`

Verify:
- `yarn test packages/daycare/sources/sandbox/docker/dockerContainerEnsure.spec.ts`

- [ ] Add test case verifying `Init: true` is included in the container creation HostConfig
- [ ] Add test case verifying containers without the init label are detected as stale and recreated
- [ ] Verify all existing tests still pass

## Post-Completion
- Existing running containers will be automatically recreated on next agent access due to staleness detection
- Monitor that zombie processes no longer accumulate after deployment
