# File search and reading patterns
# Use grep, find, ls, and read to explore the filesystem.

# Search for a pattern across files
results = grep(pattern="TODO", path=".", glob="*.py", limit=50)
print(results)

# Find files by name pattern
py_files = find(pattern="*.py", path=".", limit=50)
for f in py_files["entries"][:10]:
    print(f["path"])

# List a directory
entries = ls(path=".", limit=50)
for entry in entries["entries"][:10]:
    print(f"{entry['name']}  {entry['type']}")

# Read a specific file
content = read(path="./notes.md")
print(content)

# Read with offset and limit for large files
page = read(path="./large_log.txt", offset=100, limit=50)
print(page)
