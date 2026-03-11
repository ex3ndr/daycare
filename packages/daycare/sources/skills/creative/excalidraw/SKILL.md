---
name: excalidraw
description: Create hand-drawn diagrams in Excalidraw JSON format. Use for architecture diagrams, flows, concept maps, and quick visual explanations.
---

# Excalidraw

Create a `.excalidraw` file by writing the standard Excalidraw JSON envelope and element list.

## Workflow

1. Design the diagram structure
2. Write the `.excalidraw` JSON file with normal file tools
3. Open it in Excalidraw or upload it for a shareable link

## File Shape

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "daycare",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff"
  }
}
```

## References

- `references/colors.md` for palette choices
- `references/examples.md` for larger compositions
- `references/dark-mode.md` for dark canvases

## Upload

```bash
python3 SKILL_DIR/scripts/upload.py /path/to/diagram.excalidraw
```

The upload helper prints a shareable URL.
