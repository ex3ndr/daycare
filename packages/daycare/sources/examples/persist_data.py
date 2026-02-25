# Persisting data across Python blocks
# Each Python block runs in a separate instance — variables do not carry over.
# Use write_output() to save results, then read() or read_json() in a later block.

# --- Block 1: collect and persist ---
items = ls(path=".", limit=100)
names = [e["name"] for e in items["entries"]]
payload = str({"file_count": len(names), "names": names})
print(write_output(name="inventory", content=payload))

# --- Block 2 (separate execution): read back ---
saved = read(path="~/outputs/inventory.md")
print(saved)

# --- Using JSON format ---
rows = '[{"id": "a1", "status": "ok"}, {"id": "a2", "status": "fail"}]'
print(write_output(name="rows", format="json", content=rows))

# Read back as parsed JSON in a later block
data = read_json(path="~/outputs/rows.json")
for row in data:
    print(f"{row['id']}: {row['status']}")
