---
name: blogwatcher
description: Track RSS and Atom feeds with the blogwatcher CLI. Use for monitoring blogs, changelogs, and recurring research sources.
---

# Blogwatcher

Use `blogwatcher` when you need a lightweight local feed tracker instead of ad hoc polling.

## Install

```bash
go install github.com/Hyaxia/blogwatcher/cmd/blogwatcher@latest
```

## Common Commands

```bash
blogwatcher add "Example Blog" https://example.com
blogwatcher blogs
blogwatcher scan
blogwatcher articles
blogwatcher read 1
blogwatcher read-all
blogwatcher remove "Example Blog"
```

## Recommended Use

- Add stable sources once
- Run `blogwatcher scan` when the user wants recent updates
- Read or summarize only the new items

Use `blogwatcher <command> --help` for flags and output options.
