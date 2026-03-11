---
title: Plan Execute
parameters:
    - name: plan_path
      type: string
      nullable: false
    - name: default_branch
      type: string
      nullable: true
---
Coordinate the full Ralph loop for every remaining task in a validated plan.

This core task is the delegated execution manager. It carries the plan overview, context, and
remaining task list into a subagent, then instructs that subagent to run each task in order via
focused child Ralph loops, with review after every section.
