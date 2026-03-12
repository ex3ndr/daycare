/**
 * Resolves the connector-specific value from a normalized connector key.
 * Expects: connectorKey starts with "<connector>:" and includes a non-empty value.
 */
export function connectorKeyValueResolve(connector: string, connectorKey: string): string {
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
    const connectorValue = normalizedKey.slice(prefix.length).trim();
    if (!connectorValue) {
        throw new Error(`Connector key is missing value for ${normalizedConnector}`);
    }
    return connectorValue;
}
