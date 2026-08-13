# Publishing to npm

The standard baseline publishing workflow for Autotask uses direct terminal release with npm's built-in `prepublishOnly` lifecycle hooks (which automatically execute TypeScript compilation and the Vitest test suite prior to packaging).

---

## Standard Release Commands

Publishing new versions from your terminal:

### 1. Patch Release (e.g. `0.1.0` -> `0.1.1`)
```bash
npm run release:patch
```
* Bumps patch version in `package.json`
* Creates a git tag and pushes to GitHub
* Runs typecheck, build, and unit tests automatically
* Publishes `@9matesu/autotask` to npm

### 2. Minor Feature Release (e.g. `0.1.0` -> `0.2.0`)
```bash
npm run release:minor
```

### 3. Major Breaking Release (e.g. `0.1.0` -> `1.0.0`)
```bash
npm run release:major
```

### 4. Direct Publish Current Version
```bash
npm run release
```

---

## Global Installation for Users

Once published, users install and run Autotask globally via:

```bash
npm install -g @9matesu/autotask
```

### CLI Commands Available:
```bash
# Launch interactive Amber TUI
autotask

# Or short alias
ocq

# Offline zero-token simulation mode
autotask --mock

# Run system diagnostic checks
autotask --doctor
```
