# npm Publishing & Distribution

Autotask is configured for automated distribution to the official npm registry.

## Automated Release via GitHub Actions

The repository includes an automated publishing workflow in `.github/workflows/publish.yml`.

### One-Time Setup:
1. Create an Automation Access Token on [npmjs.com](https://www.npmjs.com/) (Access Tokens -> Generate New Token -> Automation).
2. In the GitHub repository settings (`https://github.com/9matesu/autotask/settings/secrets/actions`), add a new Repository Secret:
   - **Name**: `NPM_TOKEN`
   - **Value**: Your npm access token.

### Triggering a Release:

#### Option A: Create a GitHub Release
1. Create a git tag and push it:
   ```bash
   npm version patch # or minor / major
   git push origin main --tags
   ```
2. On GitHub, create a new Release from the tag. The workflow will automatically test, build, and publish the package with provenance.

#### Option B: Manual Workflow Trigger
1. Go to **Actions** -> **Publish to npm** -> **Run workflow**.
2. Select tag (`latest` or `beta`) and trigger.

---

## Manual Publishing from Terminal

If logged in to npm via `npm login`:

```bash
npm run typecheck
npm run build
npm test
npm publish --access public
```

---

## User Installation & Execution

Once published on npm, users anywhere can install and run Autotask with:

### Global Install
```bash
npm install -g autotask
autotask
```

### Direct Execution via npx
```bash
npx autotask
```
