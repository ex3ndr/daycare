# Conditional cron/heartbeat execution with skip()
# Call skip() to silently skip the turn when there is nothing to do.
# If skip() is not called, Python outputs are sent to the LLM for the next turn.

# Example: only act when there are new files
entries = exec(command="test -d ./inbox && ls -1A ./inbox || true")
names = [line for line in entries["summary"].replace("stdout:\n", "").strip().split("\n") if line]
if len(names) == 0:
    skip()  # Nothing to process — skip this heartbeat/cron turn

# If we reach here, there are files to process
for name in names[:10]:
    content = read(path=f"./inbox/{name}")
    print(f"Processing: {name}")
    print(content[:200])
