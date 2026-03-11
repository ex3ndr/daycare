---
title: Review Results
parameters:
    - name: plan_path
      type: string
      nullable: false
    - name: task_number
      type: string
      nullable: true
---
Review the latest completed plan task against the plan, code changes, and validation evidence.

This core task produces a reviewer prompt for a completed plan section. It focuses the review on
the selected task, the promised file set, the required validation steps, and the latest diff or
commit that claims to satisfy that section.
