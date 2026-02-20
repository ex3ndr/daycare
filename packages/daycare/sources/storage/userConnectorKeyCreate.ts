/**
 * Creates a stable connector identity key from connector + connector user id.
 * Expects: connector and userId are non-empty strings after trim.
 */
export function userConnectorKeyCreate(connector: string, userId: string): string {
    const normalizedConnector = connector.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedConnector) {
        throw new Error("Connector is required");
    }
    if (!normalizedUserId) {
        throw new Error("Connector userId is required");
    }
    return `${normalizedConnector}:${normalizedUserId}`;
}
