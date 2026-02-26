# File search and reading patterns
# Use exec + read to explore the filesystem.

# Search for a pattern across files
rg = exec(command="rg --line-number --no-heading 'TODO' .")
print(rg["summary"])

# Find files by name pattern
fd = exec(command="fd --hidden --glob '*.py' .")
print(fd["summary"])

# List a directory
listing = exec(command="ls -1apL .")
print(listing["summary"])

# Read a specific file
content = read(path="./notes.md")
print(content)

# Read with offset and limit for large files
page = read(path="./large_log.txt", offset=100, limit=50)
print(page)
