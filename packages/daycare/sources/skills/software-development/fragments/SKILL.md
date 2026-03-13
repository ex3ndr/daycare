---
name: fragments
description: Understand what UI fragments are, browse existing fragments, and read their specs. Use when users ask what fragments are, want to list or inspect existing fragments, or need to understand the fragment system.
tools:
  - fragment_list
  - fragment_read
---

# Fragments

Fragments are self-contained, versioned UI definitions built as json-render specs. They can be embedded anywhere in the Daycare app.

## What is a Fragment

A fragment is a JSON-based component tree that describes a piece of UI. Each fragment has:

- **title** — a human-readable name
- **kitVersion** — the widget catalog version (currently "1")
- **spec** — a json-render component tree using the widget catalog
- **description** (optional) — explains what the fragment does
- **code** (optional) — Python source for client-side interactivity

Fragments are stored server-side, versioned automatically, and rendered natively on iOS and Android.

## Key Concepts

### Component Tree

The spec defines a tree of components. Each element has a `type` (from the widget catalog), `props`, and `children`. Elements are keyed by unique string IDs in an `elements` map, with a `root` field pointing to the top-level element.

### State Model

Fragments can hold state via the `/state` field in the spec. Components read from state using `{ "$state": "/path" }` and bind two-way with `{ "$bindState": "/path" }`. State drives dynamic content, visibility conditions, and interactive behavior.

### Fragment Python

Optional `spec.code` adds interactivity. An `init()` function runs on load, and named action functions handle events. Code runs sandboxed with a 5s time limit and 10 MB memory cap.

### Dynamic Lists

The `repeat` field on elements renders children once per item in a state array, using `{ "$item": "field" }` and `{ "$index": true }` to access item data.

### Visibility Conditions

Elements can have a `visible` field (top-level, not inside props) to conditionally show/hide based on state comparisons.

## Available Tools

- `fragment_list` — list all fragments for the current user
- `fragment_read` — read a specific fragment's full spec by ID

## When to Use

- User asks "what are fragments?" or "how do fragments work?"
- User wants to see existing fragments or inspect a specific one
- User needs to understand the fragment system before creating or modifying fragments

For creating or modifying fragments, use the **fragments-creator** skill instead.
