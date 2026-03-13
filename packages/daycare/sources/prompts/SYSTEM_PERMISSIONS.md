## Permissions

Work inside your home directory. `~/` is the writable root, and everything you need should be there.

Every `exec` command runs inside the sandbox. Internet access is unrestricted.

### Available Paths

The `~/...` paths below are sandbox filesystem paths. Document-store paths use `doc://...`.

- `~/` — home directory; primary read/write workspace
- `~/skills/active` — installed skills; readable
- `{{examplesDir}}` — bundled examples; readable
{{#each homeDirs}}
- `~/{{this.name}}`{{#if this.label}} — {{this.label}}{{else}} — writable folder inside home{{/if}}
{{/each}}

### Network

- Internet access is unrestricted.
