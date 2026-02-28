# Daycare Runtime: Install Recommended Tooling Bundle

## Summary
- Added the full recommended tooling bundle to both runtime images:
  - `packages/daycare-runtime/Dockerfile`
  - `packages/daycare-runtime/Dockerfile.minimal`
- Added packages:
  - `ffmpeg`
  - `mencoder`
  - `imagemagick`
  - `libvips-tools`
  - `libimage-exiftool-perl`
  - `mediainfo`
  - `shellcheck`
  - `strace`
  - `lsof`
  - `tree`
  - `p7zip-full`
  - `zstd`
- Added command compatibility links in both runtime images:
  - `ffprobe` (explicitly linked; binary provided by `ffmpeg`)
  - `avconv` (linked to `ffmpeg` for CLI compatibility)

## Why
- Expands media conversion/inspection capabilities and improves diagnostics and script quality checks in sandbox runtime environments.

## Runtime Tooling Flow
```mermaid
flowchart LR
    A[Agent task] --> B{Task type}
    B -->|Image/Video| C[imagemagick ffmpeg ffprobe avconv mencoder vips mediainfo exiftool]
    B -->|Archive/Compression| D[p7zip zstd]
    B -->|Shell Script| E[shellcheck]
    B -->|Debugging| F[strace lsof tree]
    C --> G[Execute in Daycare runtime]
    D --> G
    E --> G
    F --> G
```
