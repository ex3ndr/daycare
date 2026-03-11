---
title: Ralph Loop
parameters:
    - name: plan_path
      type: string
      nullable: false
    - name: default_branch
      type: string
      nullable: true
    - name: task_number
      type: string
      nullable: true
---
Run the full Ralph loop for a markdown plan, or focus the loop on one task section.

This core task is the built-in orchestration entrypoint. In plan mode it validates the plan,
delegates execution to a plan runner subagent, and expects review after every task. In task mode it
focuses a child loop on exactly one `### Task ...` section, carrying forward the plan context,
verification commands, and remaining queue so the worker can implement, validate, commit, and stop.
