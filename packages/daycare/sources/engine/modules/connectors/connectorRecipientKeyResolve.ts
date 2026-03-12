import type { ConnectorRecipient } from "@/types";

/**
 * Resolves the raw connector recipient key after validating connector ownership.
 * Expects: recipient.name matches expectedConnectorName and recipient.key is non-empty.
 */
export function connectorRecipientKeyResolve(expectedConnectorName: string, recipient: ConnectorRecipient): string {
    const normalizedExpectedConnectorName = expectedConnectorName.trim();
    const normalizedRecipientName = recipient.name.trim();
    const normalizedRecipientKey = recipient.key.trim();
    if (!normalizedExpectedConnectorName) {
        throw new Error("Connector name is required.");
    }
    if (normalizedRecipientName !== normalizedExpectedConnectorName) {
        throw new Error(
            `Connector recipient does not match connector ${normalizedExpectedConnectorName}: ${normalizedRecipientName}`
        );
    }
    if (!normalizedRecipientKey) {
        throw new Error(`Connector recipient key is required for ${normalizedExpectedConnectorName}.`);
    }
    return normalizedRecipientKey;
}
