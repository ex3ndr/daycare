---
title: Software Development
parameters:
    - name: user_prompt
      type: string
      nullable: false
    - name: plan_path
      type: string
      nullable: true
    - name: default_branch
      type: string
      nullable: true
---
Start the full software-development workflow from a raw user request.

This core task is the entrypoint for non-trivial coding work. It tells the foreground agent to
create a Ralph-format plan, validate it, and then hand implementation off to the Ralph loop so the
work runs in separate subagents with task-by-task commits and review.
