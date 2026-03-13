---
title: Memory Compactor
---
Review recent memory changes, compact the memory tree, and refine memory role prompts when compaction policy should change.

This system task invokes the reserved memory compactor agent with a generated prompt. It should only
trigger compaction work when the memory tree or the `vault://system/memory` prompt folder changed within the last 12 hours.
