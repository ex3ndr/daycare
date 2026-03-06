# App Image Preview Zoom

## Summary
- Adds an interactive `ImageViewer` to the app file preview screen for image files.
- Replaces the static `expo-image` preview with pinch, pan, double-tap, and web wheel zoom.

## Flow
```mermaid
flowchart TD
    A[FilePreviewScreen loads preview] --> B{mimeType starts with image}
    B -- no --> C[Render existing text or fallback preview]
    B -- yes --> D[Render ImageViewer with data URI]
    D --> E[Pinch gesture updates scale]
    D --> F[Pan gesture updates translation when zoomed]
    D --> G[Double tap toggles zoom state]
    D --> H[Web wheel updates scale]
    E --> I[Animated image transform]
    F --> I
    G --> I
    H --> I
```
