---
title: Ralph Loop
parameters:
    - name: plan_path
      type: string
      nullable: false
    - name: default_branch
      type: string
      nullable: true
---
Execute one ralphex-style plan iteration from a markdown plan file.

This core task reads a plan, extracts the first incomplete `### Task ...` or `### Iteration ...`
section, carries over `## Overview`, optional `## Context`, and `## Validation Commands`, then
hands a focused prompt to the task agent. The prompt is modeled on the upstream ralphex task
execution loop: complete exactly one section, validate, mark its checkboxes complete, commit, and
stop before the next section.
