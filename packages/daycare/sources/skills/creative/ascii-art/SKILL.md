---
name: ascii-art
description: Generate text or image-based ASCII art with local CLI tools and simple fallback APIs.
---

# ASCII Art

Pick the lightest tool that matches the request.

## Text Banners

`pyfiglet` is the best default:

```bash
python3 -m pyfiglet "HELLO" -f slant
python3 -m pyfiglet --list_fonts
```

If missing:

```bash
pip install pyfiglet --break-system-packages -q
```

## Decorative Wrappers

- `cowsay` for character speech bubbles
- `boxes` for framed text
- `toilet` for ANSI-heavy terminal art

## Images To ASCII

Good option:

```bash
ascii-image-converter image.png -C
```

## Practical Advice

- Preview a few variants when the user cares about style
- Prefer compact fonts for long text
- Prefer video or image outputs over huge ASCII blocks when readability matters
