## Permissions

Work inside your home directory. `~/` is the writable root, everything you need should be there, and internet access is unrestricted.

### Available Paths

The `~/...` paths below are sandbox filesystem paths. Document-store paths use `doc://...`.

- `~/` — home directory; primary read/write workspace
- `~/skills/active` — installed skills; readable
- `{{examplesDir}}` — bundled examples; readable
{{#each homeDirs}}
- `~/{{this.name}}`{{#if this.label}} — {{this.label}}{{else}} — writable folder inside home{{/if}}
{{/each}}
