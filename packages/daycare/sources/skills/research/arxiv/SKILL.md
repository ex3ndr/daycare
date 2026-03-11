---
name: arxiv
description: Search arXiv papers and retrieve abstracts or PDFs. Use for academic literature lookup, paper triage, and citation gathering.
---

# arXiv Research

Use the bundled helper script for clean search output, then fetch the paper you actually need.

## Search

```bash
python3 SKILL_DIR/scripts/search_arxiv.py "reinforcement learning"
python3 SKILL_DIR/scripts/search_arxiv.py "transformer attention" --max 10 --sort date
python3 SKILL_DIR/scripts/search_arxiv.py --author "Yann LeCun" --max 5
python3 SKILL_DIR/scripts/search_arxiv.py --category cs.AI --sort date
python3 SKILL_DIR/scripts/search_arxiv.py --id 2402.03300
```

`SKILL_DIR` is the directory containing this skill.

## Read Results

- Abstract page: `https://arxiv.org/abs/<id>`
- PDF: `https://arxiv.org/pdf/<id>`

Use `web_fetch` for the abstract page when you want metadata and summary text.
Use a PDF tool or direct download when you need the full paper.

## Useful Query Fields

- `all:` all fields
- `ti:` title
- `au:` author
- `abs:` abstract
- `cat:` category

## Good Workflow

1. Search broadly
2. Narrow to the most relevant 3-5 papers
3. Fetch the abstract pages
4. Download full PDFs only for the finalists

## Notes

- arXiv search is good for discovery, not citation graphs
- For citations or related work, use Semantic Scholar or broader web research
