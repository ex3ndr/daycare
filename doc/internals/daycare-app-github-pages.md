# Daycare App GitHub Pages Publishing

Added a dedicated GitHub Actions workflow to publish the Expo web build of `packages/daycare-app` to GitHub Pages.

## Deployment flow

```mermaid
flowchart LR
    Push[Push to main] --> Workflow[daycare-app-pages.yml]
    Workflow --> Install[yarn install --frozen-lockfile]
    Install --> BaseUrl[Set EXPO_PUBLIC_BASE_URL to /]
    BaseUrl --> Export[expo export --platform web]
    Export --> Domain[Write CNAME daycare.dev]
    Export --> Artifact[Upload dist as Pages artifact]
    Artifact --> Deploy[actions/deploy-pages]
    Deploy --> Site[daycare.dev]
```

## Notes

- `app.config.js` reads `EXPO_PUBLIC_BASE_URL` and forwards it to Expo `experiments.baseUrl`.
- Workflow now exports with `EXPO_PUBLIC_BASE_URL="/"` for custom-domain root hosting at `daycare.dev`.
- Workflow writes `dist/CNAME` with `daycare.dev`.
- The workflow writes `dist/.nojekyll` so static assets and underscore-prefixed paths are served as-is.
- Publishing runs automatically on `main` changes affecting `packages/daycare-app` and can also be started manually with `workflow_dispatch`.
