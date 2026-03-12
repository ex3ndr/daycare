/**
 * Resolves the connector-specific target id from a normalized connector key.
 * Expects: connectorKey starts with "<connector>:" and includes a non-empty target id.
 */
export function connectorKeyTargetIdResolve(connector: string, connectorKey: string): string {
    const normalizedConnector = connector.trim();
    const normalizedKey = connectorKey.trim();
    if (!normalizedConnector) {
        throw new Error("Connector is required");
    }
    if (!normalizedKey) {
        throw new Error("Connector key is required");
    }
    const prefix = `${normalizedConnector}:`;
    if (!normalizedKey.startsWith(prefix)) {
        throw new Error(`Connector key does not match connector ${normalizedConnector}`);
    }
    const targetId = normalizedKey.slice(prefix.length).trim();
    if (!targetId) {
        throw new Error(`Connector key is missing target id for ${normalizedConnector}`);
    }
    return targetId;
}
