# Conditional cron/heartbeat execution with skip()
# Call skip() to silently skip the turn when there is nothing to do.
# If skip() is not called, Python outputs are sent to the LLM for the next turn.

# Example: only act when there are new files
entries = ls(path="./inbox", limit=10)
if len(entries["entries"]) == 0:
    skip()  # Nothing to process — skip this heartbeat/cron turn

# If we reach here, there are files to process
for entry in entries["entries"]:
    content = read(path=f"./inbox/{entry['name']}")
    print(f"Processing: {entry['name']}")
    print(content[:200])
