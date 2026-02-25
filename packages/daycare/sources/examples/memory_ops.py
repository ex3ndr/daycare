# Memory operations
# Use memory_search, memory_node_read, and memory_node_write.

# Search memory for relevant nodes
nodes = memory_search(query="project status")
for node in nodes["results"][:10]:
    print(f"{node['id']}: {node['title']}")

# Read a specific memory node
data = memory_node_read(nodeId=nodes["results"][0]["id"])
print(data["content"])

# Write a new memory node
memory_node_write(
    title="Weekly summary",
    content="Completed the API refactor and updated tests."
)
