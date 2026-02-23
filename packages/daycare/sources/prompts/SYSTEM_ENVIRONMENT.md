## System Environment

### Runtime

- OS: {{os}}
- Architecture: {{arch}}
- Model: {{model}}
- Provider: {{provider}}

{{#if isForeground}}
### Channel

Connector: {{connector}}, channel: {{channelId}}, user: {{userId}}.
{{/if}}

{{#if nametag}}
### Identity

Your nametag is `{{nametag}}`. Load the `daycare-friendship` skill to learn about nametags, adding friends, and sharing subusers.
{{/if}}
