---
name: gif-search
description: Search Tenor for reaction media and download the result you need. Prefer video formats like mp4 or webm unless the user explicitly needs a GIF.
---

# GIF Search

Prefer `mp4` or `webm` over raw GIF when possible. They are smaller, faster, and usually easier to ship.

## Search

```bash
curl -s "https://tenor.googleapis.com/v2/search?q=thumbs+up&limit=5&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ" | jq -r '.results[].media_formats.mp4.url'
curl -s "https://tenor.googleapis.com/v2/search?q=nice+work&limit=3&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ" | jq -r '.results[].media_formats.gif.url'
```

## Download

```bash
URL=$(curl -s "https://tenor.googleapis.com/v2/search?q=celebration&limit=1&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ" | jq -r '.results[0].media_formats.mp4.url')
curl -sL "$URL" -o celebration.mp4
```

## Notes

- Use `gif` only when the destination truly requires a GIF
- For chat or app delivery, `mp4`, `tinymp4`, or `webm` are usually the better default
- The bundled key is a public demo key and may be rate limited
