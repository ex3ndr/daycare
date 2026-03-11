---
title: Section Execute Commit
parameters:
    - name: plan_path
      type: string
      nullable: false
    - name: task_number
      type: string
      nullable: true
    - name: default_branch
      type: string
      nullable: true
---
Execute exactly one plan task, validate it, update the plan, and commit the result.

This core task focuses a worker on one `### Task ...` section. It carries over the plan overview,
context, file list, verification commands, and remaining queue, then instructs the worker to finish
only that task and create a single Angular-style commit.
