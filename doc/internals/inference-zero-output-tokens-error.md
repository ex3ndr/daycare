# Inference Zero Output Tokens Guard

Inference responses are now rejected when provider-reported `usage.output` is exactly `0`.

- Validation runs in `InferenceRouter` before success callbacks and before returning the response.
- The router throws `Inference error: provider returned zero output tokens.` for this case.
- Responses without usage metadata are still accepted.

```mermaid
flowchart TD
    A[Provider client.complete()] --> B{message.usage.output === 0?}
    B -- Yes --> C[Throw inference error]
    B -- No --> D[Log success + onSuccess callback]
    D --> E[Return inference result]
```
