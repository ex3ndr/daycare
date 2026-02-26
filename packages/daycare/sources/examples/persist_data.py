# Persisting data across Python blocks
# Each Python block runs in a separate instance — variables do not carry over.
# Use write_output() to save results, then read() or read_json() in a later block.
# write_output returns the path (date-prefixed, unique) — always print it.

# --- Block 1: collect and persist ---
listing = exec(command="ls -1apL .")
payload = str({"listing": listing["summary"]})
result = write_output(name="inventory", content=payload)
print(result["path"])  # e.g. ~/outputs/20250615103045-inventory.md

# --- Block 2 (separate execution): read back using the printed path ---
saved = read(path="~/outputs/20250615103045-inventory.md")
print(saved)

# --- Using JSON format ---
rows = '[{"id": "a1", "status": "ok"}, {"id": "a2", "status": "fail"}]'
result = write_output(name="rows", format="json", content=rows)
print(result["path"])  # e.g. ~/outputs/20250615103045-rows.json

# Read back as parsed JSON in a later block (use the printed path)
data = read_json(path="~/outputs/20250615103045-rows.json")
for row in data:
    print(f"{row['id']}: {row['status']}")
