# WhatsApp Plugin

Connect ClayBot to WhatsApp using the [Baileys](https://github.com/WhiskeySockets/Baileys) library.

## Overview

This plugin uses Baileys, an open-source TypeScript library that connects to WhatsApp Web via WebSocket. Unlike solutions that require a browser (like Puppeteer), Baileys connects directly to WhatsApp's servers, making it lightweight and efficient.

## Authentication

WhatsApp uses QR code authentication via the "Linked Devices" feature:

1. On first run, a QR code will be printed to the terminal
2. Open WhatsApp on your phone
3. Go to Settings > Linked Devices > Link a Device
4. Scan the QR code

Authentication state is persisted in the `whatsapp-auth` directory within the plugin data folder.

## Configuration

```json
{
  "allowedPhones": ["14155551234", "+1 415 555 1234"],
  "printQRInTerminal": true,
  "authDir": "whatsapp-auth"
}
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `allowedPhones` | `string[]` | required | Phone numbers allowed to interact (with country code) |
| `printQRInTerminal` | `boolean` | `true` | Print QR code to terminal for authentication |
| `authDir` | `string` | `whatsapp-auth` | Directory to store authentication state |

## Message Formatting

Messages support GitHub-flavored markdown with WhatsApp formatting:

| GFM | WhatsApp | Result |
|-----|----------|--------|
| `**bold**` | `*bold*` | **bold** |
| `*italic*` | `_italic_` | *italic* |
| `~~strike~~` | `~strike~` | ~~strike~~ |
| `` `code` `` | ` ```code``` ` | monospace |
| `# Header` | `*Header*` | bold text |

## Capabilities

- Send/receive text messages
- Send/receive files (images, videos, documents)
- Typing indicators ("composing" presence)
- Message reactions
- Permission requests via text replies

## Important Notes

### Terms of Service

WhatsApp does not officially support third-party clients. Using this plugin may violate WhatsApp's Terms of Service. Use at your own risk.

### Rate Limits

WhatsApp monitors for spam-like behavior. Avoid:
- Sending many messages rapidly
- Sending identical messages to multiple contacts
- Automated bulk messaging

### Session Persistence

Keep the authentication directory (`whatsapp-auth`) intact to maintain your session. Deleting it will require re-scanning the QR code.

## Architecture

```
WhatsAppConnector
├── makeWASocket (Baileys)
│   ├── WebSocket connection to WhatsApp
│   ├── Multi-device auth state
│   └── Message encryption/decryption
├── Message handlers
│   ├── Text messages
│   ├── Media (images, videos, documents)
│   └── Commands (/ prefix)
└── Permission system
    └── Text-based allow/deny responses
```

## Dependencies

- `@whiskeysockets/baileys` - WhatsApp Web API
- `@hapi/boom` - HTTP error handling
- `pino` - Logging (used internally by Baileys)
