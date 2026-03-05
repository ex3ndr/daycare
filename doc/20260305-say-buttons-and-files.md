# Say Tool Buttons and Attachments

## Summary
- Extended `say` to accept `buttons` (`url` and `callback`) and `files` attachments.
- Added Telegram callback-query handling so callback button clicks are routed back as incoming messages.
- Extracted sandbox file-resolution logic to shared `fileResolve()` and reused it in `send_file`.

## Message Flow
```mermaid
flowchart TD
    A[Agent calls say] --> B{pythonExecution and now != true}
    B -->|yes| C[Resolve files in sandbox]
    C --> D[Store deferred payload with text buttons files]
    B -->|no| E[Resolve files in sandbox]
    E --> F[connector.sendMessage text buttons files]
```

## Telegram Callback Flow
```mermaid
flowchart TD
    A[User taps callback button] --> B[Telegram callback_query]
    B --> C[answerCallbackQuery]
    C --> D{Allowed UID}
    D -->|no| E[Reject in private mode]
    D -->|yes| F[Build ConnectorMessage text=callback_data]
    F --> G[Dispatch through message handlers]
```

## Shared File Resolution
```mermaid
flowchart TD
    A[fileResolve path mimeType] --> B[sandbox.read binary]
    B --> C[sanitize filename]
    C --> D[sandbox.write ~/downloads/name]
    D --> E[FileReference id name mimeType size path]
```
