# Daycare Friendship Skill

## Overview
Create a core skill `daycare-friendship` that teaches daycare agents how to use the friendship system. The skill provides a comprehensive embedded prompt covering nametags, friend requests, messaging, and subuser sharing. Agents load this skill to understand the full friendship lifecycle and use the 5 friend tools correctly.

## Context
- Skill location: `packages/daycare/sources/skills/daycare-friendship/SKILL.md`
- Mode: embedded (inline prompt, no sandbox)
- Audience: daycare agents (AI agents running inside daycare)
- Existing patterns: see `scheduling/SKILL.md`, `permanent-agent-creator/SKILL.md`
- Friend tools: `friend_add`, `friend_remove`, `friend_send`, `friend_share_subuser`, `friend_unshare_subuser`
- Nametag format: generated via `unique-username-generator`, e.g. `happy-penguin-42`

## Development Approach
- Single file creation (`SKILL.md`) — no code changes, no tests needed
- Follow existing skill conventions (YAML frontmatter + markdown body)
- Content must cover: nametags, friendship lifecycle, all 5 tools with examples, subuser sharing, topology inspection

## Implementation Steps

### Task 1: Create daycare-friendship SKILL.md
- [ ] Create `packages/daycare/sources/skills/daycare-friendship/SKILL.md` with YAML frontmatter (`name`, `description`)
- [ ] Write "What is a Nametag" section — explain format, purpose, uniqueness, case-insensitivity
- [ ] Write "Why Friends" section — motivation for connecting agents/users, sharing capabilities
- [ ] Write "Friendship Lifecycle" section — request flow, states (None → PendingOut/PendingIn → Friends), cooldown rules
- [ ] Write "Friend Tools Reference" — all 5 tools with parameters, descriptions, and usage examples:
  - `friend_add(nametag)` — send/accept request
  - `friend_remove(nametag)` — unfriend/reject/cancel
  - `friend_send(nametag, message)` — direct messaging (requires mutual friendship)
  - `friend_share_subuser(friendNametag, subuserId)` — share a subuser with friend
  - `friend_unshare_subuser(friendNametag, subuserId)` — revoke share
- [ ] Write "Subuser Sharing" section — what it is, share lifecycle, pending vs active states, messaging shared subusers
- [ ] Write "Inspecting Friends" section — using `topology` to see friends, shared subusers, and statuses
- [ ] Write "Common Scenarios" section — worked examples (add friend, share subuser, send message, cleanup)
- [ ] Write "Important Rules" section — constraints, error cases, permission boundaries

### Task 2: Verify skill loads correctly
- [ ] Run `yarn typecheck` to ensure no build issues
- [ ] Run `yarn test` to ensure nothing is broken
- [ ] Run `yarn lint` to check formatting

### Task 3: Update documentation
- [ ] Add entry in relevant doc if skills are cataloged anywhere

## Technical Details

### SKILL.md Frontmatter
```yaml
---
name: daycare-friendship
description: Friendship mechanics for daycare agents. Use when the user wants to add friends, manage friend requests, send messages to friends, share or unshare subusers with friends, or understand what nametags are.
---
```

### Content Sections (ordered)
1. **What is a Nametag** — identity concept
2. **Why Friends** — motivation
3. **Friendship Lifecycle** — state machine
4. **Friend Tools** — all 5 tools with params and examples
5. **Subuser Sharing** — sharing mechanics
6. **Inspecting Friends** — topology usage
7. **Common Scenarios** — end-to-end examples
8. **Important Rules** — constraints and gotchas
