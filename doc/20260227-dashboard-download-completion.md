# Dashboard Export Download Completion

## Problem

Markdown and JSONL exports from the dashboard occasionally remained stuck as unfinished downloads in browsers.

## Root Cause

The dashboard revoked the generated Blob URL immediately after triggering `anchor.click()`.
Some browsers still need the object URL alive for a short time while the download stream attaches.

## Change

- Added `downloadTextFile()` helper in `packages/daycare-dashboard/lib/downloadTextFile.ts`.
- Moved export download calls in `agentDetailClient.tsx` to use this helper.
- Deferred Blob URL revocation with a scheduled callback (`setTimeout(..., 0)`).
- Added a unit test to ensure revocation is asynchronous.

## Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Agent Detail UI
    participant B as Browser
    participant URL as Object URL

    U->>UI: Click export (Markdown/JSONL)
    UI->>URL: createObjectURL(blob)
    UI->>B: create + click hidden anchor
    B-->>B: Start download stream
    UI->>UI: schedule revoke (next tick)
    UI->>URL: revokeObjectURL(href)
```
