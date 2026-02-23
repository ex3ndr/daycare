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

{{#if usertag}}
### Identity

Your usertag is `{{usertag}}`. Load the `daycare-friendship` skill to learn about usertags, adding friends, and sharing subusers.
{{/if}}
