---
title: Plan Verify
parameters:
    - name: plan_path
      type: string
      nullable: false
---
Validate that a markdown implementation plan matches the Ralph loop format before delegation.

This core task reads the plan file, checks the required top-level sections, validates every
`### Task ...` block under `## Implementation Steps`, and reports either a valid summary or a
concrete list of format violations with the expected shape.
