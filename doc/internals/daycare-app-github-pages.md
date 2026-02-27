# Daycare App GitHub Pages Publishing

Added a dedicated GitHub Actions workflow to publish the Expo web build of `packages/daycare-app` to GitHub Pages.

## Deployment flow

```mermaid
flowchart LR
    Push[Push to main] --> Workflow[daycare-app-pages.yml]
    Workflow --> Install[yarn install --frozen-lockfile]
    Install --> BaseUrl[Set EXPO_PUBLIC_BASE_URL to /repo-name]
    BaseUrl --> Export[expo export --platform web]
    Export --> Artifact[Upload dist as Pages artifact]
    Artifact --> Deploy[actions/deploy-pages]
    Deploy --> Site[GitHub Pages site]
```

## Notes

- `app.config.js` now reads `EXPO_PUBLIC_BASE_URL` and forwards it to Expo `experiments.baseUrl` for repository subpath hosting.
- The workflow writes `dist/.nojekyll` so static assets and underscore-prefixed paths are served as-is.
- Publishing runs automatically on `main` changes affecting `packages/daycare-app` and can also be started manually with `workflow_dispatch`.
