"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronRight, FolderTree, Link2, RefreshCw } from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchMemoryGraph,
  fetchMemoryNode,
  fetchUsers,
  type MemoryGraph,
  type MemoryNode,
  type UserSummary
} from "@/lib/engine-client";

export default function MemoryPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [graph, setGraph] = useState<MemoryGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<MemoryNode | null>(null);
  const [nodeCache, setNodeCache] = useState<Map<string, MemoryNode>>(new Map());
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set(["__root__"]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadGraph = useCallback(async (userId: string) => {
    const normalized = userId.trim();
    if (!normalized) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextGraph = await fetchMemoryGraph(normalized, { scope: "documents" });
      setGraph(nextGraph);
      setActiveUserId(normalized);
      setLastUpdated(new Date());

      const cache = new Map<string, MemoryNode>();
      cache.set(nextGraph.root.id, nextGraph.root);
      Object.values(nextGraph.children).forEach((nodes) => {
        nodes.forEach((node) => {
          cache.set(node.id, node);
        });
      });
      setNodeCache(cache);

      setSelectedNodeId(nextGraph.root.id);
      setSelectedNode(nextGraph.root);
      setExpandedNodeIds(new Set([nextGraph.root.id]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers()
      .then((loadedUsers) => {
        setUsers(loadedUsers);
        if (loadedUsers.length > 0) {
          const owner = loadedUsers.find((u) => u.isOwner);
          const first = owner ?? loadedUsers[0]!;
          setActiveUserId(first.id);
          void loadGraph(first.id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load users");
      });
  }, [loadGraph]);

  const handleSelectNode = useCallback(
    async (nodeId: string) => {
      setSelectedNodeId(nodeId);

      const cached = nodeCache.get(nodeId);
      if (cached) {
        setSelectedNode(cached);
      }

      if (!activeUserId) {
        return;
      }

      try {
        const fullNode = await fetchMemoryNode(activeUserId, nodeId, { scope: "documents" });
        if (fullNode) {
          setSelectedNode(fullNode);
          setNodeCache((previous) => {
            const next = new Map(previous);
            next.set(nodeId, fullNode);
            return next;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to read node");
      }
    },
    [activeUserId, nodeCache]
  );

  const childrenByParent = graph?.children ?? {};
  const totalNodeCount = useMemo(() => {
    if (!graph) {
      return 0;
    }
    const unique = new Set<string>();
    unique.add(graph.root.id);
    Object.values(childrenByParent).forEach((nodes) => {
      nodes.forEach((node) => unique.add(node.id));
    });
    return unique.size;
  }, [childrenByParent, graph]);

  return (
    <DashboardShell
      title="Documents"
      subtitle="Hierarchical tree across all user documents, including memory."
      toolbar={
        <>
          <Select
            value={activeUserId ?? ""}
            onValueChange={(userId) => {
              setActiveUserId(userId);
              void loadGraph(userId);
            }}
          >
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.id}{user.isOwner ? " (owner)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="gap-2"
            disabled={loading || !activeUserId}
            onClick={() => activeUserId && void loadGraph(activeUserId)}
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Reload
          </Button>
        </>
      }
      status={
        <>
          {activeUserId ? <span>User: {activeUserId}</span> : null}
          <span>{lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString()}` : "Awaiting first sync"}</span>
          <span>Nodes: {totalNodeCount}</span>
          {error ? (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-destructive">
              {error}
            </span>
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(300px,1fr)_minmax(360px,1fr)] lg:px-6">
        <Card className="min-h-[520px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderTree className="h-4 w-4" />
              Tree
            </CardTitle>
            <CardDescription>Root-level and nested documents projected as a single tree.</CardDescription>
          </CardHeader>
          <CardContent>
            {graph ? (
              <div className="space-y-1">
                {renderNodeTree({
                  node: graph.root,
                  depth: 0,
                  selectedNodeId,
                  childrenByParent,
                  expandedNodeIds,
                  onToggleNode: (nodeId) => {
                    setExpandedNodeIds((previous) => {
                      const next = new Set(previous);
                      if (next.has(nodeId)) {
                        next.delete(nodeId);
                      } else {
                        next.add(nodeId);
                      }
                      return next;
                    });
                  },
                  onSelectNode: (nodeId) => {
                    void handleSelectNode(nodeId);
                  },
                  visited: new Set()
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No graph loaded yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[520px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Node Details
            </CardTitle>
            <CardDescription>Full content and outbound references for the selected document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedNode ? (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedNode.id}
                    </Badge>
                    <Badge variant="secondary">refs: {selectedNode.refs.length}</Badge>
                  </div>
                  <h2 className="text-lg font-semibold leading-tight">{selectedNode.frontmatter.title}</h2>
                  <p className="text-sm text-muted-foreground">{selectedNode.frontmatter.description || "No description"}</p>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                  <RefAwareContent
                    content={selectedNode.content}
                    onRefClick={(nodeId) => {
                      void handleSelectNode(nodeId);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Outbound Refs</div>
                  {selectedNode.refs.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.refs.map((ref) => (
                        <Button
                          key={ref}
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 font-mono text-[11px]"
                          onClick={() => {
                            void handleSelectNode(ref);
                          }}
                        >
                          <Link2 className="h-3 w-3" />
                          {ref}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No outbound references.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Select a node to view full content.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

type RenderNodeTreeParams = {
  node: MemoryNode;
  depth: number;
  selectedNodeId: string | null;
  childrenByParent: Record<string, MemoryNode[]>;
  expandedNodeIds: Set<string>;
  onToggleNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  visited: Set<string>;
};

function renderNodeTree(params: RenderNodeTreeParams): JSX.Element {
  const {
    node,
    depth,
    selectedNodeId,
    childrenByParent,
    expandedNodeIds,
    onToggleNode,
    onSelectNode,
    visited
  } = params;

  const children = childrenByParent[node.id] ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodeIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const preview = node.content.trim().replace(/\s+/g, " ").slice(0, 120);

  const nextVisited = new Set(visited);
  nextVisited.add(node.id);

  return (
    <div key={`${node.id}:${depth}`} className="space-y-1">
      <button
        type="button"
        onClick={() => {
          onSelectNode(node.id);
          if (hasChildren) {
            onToggleNode(node.id);
          }
        }}
        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
          isSelected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted/50"
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-sm font-medium">
              {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
              <span className="truncate">{node.frontmatter.title}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {node.frontmatter.description || "No description"}
            </div>
            {!hasChildren && preview.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">{preview}</div>
            ) : null}
          </div>
          <div className="shrink-0 text-[11px] text-muted-foreground">refs {node.refs.length}</div>
        </div>
      </button>

      {hasChildren && isExpanded
        ? children.map((child) => {
            if (nextVisited.has(child.id)) {
              return (
                <div
                  key={`${node.id}->${child.id}`}
                  className="rounded border border-dashed px-3 py-2 text-xs text-muted-foreground"
                  style={{ marginLeft: (depth + 1) * 16 }}
                >
                  Cycle to {child.id}
                </div>
              );
            }
            return renderNodeTree({
              node: child,
              depth: depth + 1,
              selectedNodeId,
              childrenByParent,
              expandedNodeIds,
              onToggleNode,
              onSelectNode,
              visited: nextVisited
            });
          })
        : null}
    </div>
  );
}

function RefAwareContent({ content, onRefClick }: { content: string; onRefClick: (nodeId: string) => void }) {
  const parts = content.split(/(\[\[[^\[\]]+\]\])/g);

  if (parts.every((part) => part.length === 0)) {
    return <span className="text-muted-foreground">(empty)</span>;
  }

  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        const match = part.match(/^\[\[([^\[\]]+)\]\]$/);
        if (!match) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }
        const ref = match[1] ?? "";
        return (
          <button
            key={`${ref}-${index}`}
            type="button"
            className="mx-0.5 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary hover:bg-primary/20"
            onClick={() => onRefClick(ref)}
          >
            {ref}
          </button>
        );
      })}
    </p>
  );
}
