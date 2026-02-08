# WhatsApp

Connect Daycare to WhatsApp using the [Baileys](https://github.com/WhiskeySockets/Baileys) library. Baileys connects directly to WhatsApp Web via WebSocket without requiring a browser.

## Setup

1. Run `daycare add` and select the WhatsApp plugin
2. A QR code will be printed to the terminal
3. Open WhatsApp on your phone -> Settings -> Linked Devices -> Link a Device
4. Scan the QR code

Authentication state is persisted in the `whatsapp-auth` directory within the plugin data folder.

## Configuration

```json
{
  "instanceId": "whatsapp",
  "pluginId": "whatsapp",
  "enabled": true,
  "settings": {
    "allowedPhones": ["14155551234", "+1 415 555 1234"],
    "printQRInTerminal": true
  }
}
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `allowedPhones` | string[] | required | Phone numbers with country code allowed to interact |
| `printQRInTerminal` | boolean | `true` | Print QR code to terminal for authentication |
| `authDir` | string | `whatsapp-auth` | Directory to store authentication state |

## Capabilities

| Feature | Supported |
|---------|-----------|
| Send/receive text | Yes |
| Send/receive files | Yes (images, videos, documents) |
| Typing indicators | Yes (composing presence) |
| Message reactions | Yes |
| Permission requests | Yes (text-based allow/deny replies) |

## Message formatting

WhatsApp uses its own formatting syntax. The connector converts GitHub-flavored Markdown:

| GFM | WhatsApp | Result |
|-----|----------|--------|
| `**bold**` | `*bold*` | **bold** |
| `*italic*` | `_italic_` | *italic* |
| `~~strike~~` | `~strike~` | ~~strike~~ |
| `` `code` `` | ` ```code``` ` | monospace |
| `# Header` | `*Header*` | bold text |

## Permission handling

Unlike Telegram's inline buttons, WhatsApp uses text-based permission responses. The user replies with "allow" or "deny" to permission requests.

## Important notes

### Terms of Service

WhatsApp does not officially support third-party clients. Using this plugin may violate WhatsApp's Terms of Service. Use at your own risk.

### Rate limits

WhatsApp monitors for spam-like behavior. Avoid:
- Sending many messages rapidly
- Sending identical messages to multiple contacts
- Automated bulk messaging

### Session persistence

Keep the authentication directory (`whatsapp-auth`) intact to maintain your session. Deleting it requires re-scanning the QR code.
