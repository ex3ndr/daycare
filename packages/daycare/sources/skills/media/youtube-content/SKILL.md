---
name: youtube-content
description: Fetch YouTube transcripts and turn them into summaries, chapters, threads, quotes, or blog posts.
---

# YouTube Content

Use the bundled helper to fetch the transcript first. Then transform it into the format the user wants.

## Helper Script

```bash
python3 SKILL_DIR/scripts/fetch_transcript.py "https://youtube.com/watch?v=VIDEO_ID"
python3 SKILL_DIR/scripts/fetch_transcript.py "https://youtube.com/watch?v=VIDEO_ID" --timestamps
python3 SKILL_DIR/scripts/fetch_transcript.py "https://youtube.com/watch?v=VIDEO_ID" --text-only
python3 SKILL_DIR/scripts/fetch_transcript.py "https://youtube.com/watch?v=VIDEO_ID" --language en,tr
```

## Output Options

Common outputs:

- summary
- timestamped chapters
- chapter summaries
- quotes with timestamps
- thread
- blog post

See `references/output-formats.md` for example output shapes.

## Workflow

1. Fetch transcript
2. If long, summarize in chunks
3. Reformat into the requested deliverable

## Error Handling

- transcript disabled: tell the user directly
- no transcript in requested language: retry without language or with fallback languages
- private or unavailable video: relay the error clearly
