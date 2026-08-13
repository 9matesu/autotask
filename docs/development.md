# Developer Guide

## Project Setup

```bash
git clone <repo-url>
cd autotask
npm install
npm test
npm run build
```

## Running Dev Server in Mock Mode

To experiment with TUI components or queue management without calling OpenCode:

```bash
npm run dev:mock
```

## Adding New Commands

Add a new `CommandDefinition` to `src/commands/command-registry.ts`:

```typescript
this.register({
  name: 'mycommand',
  description: 'Custom action description',
  usage: '/mycommand <arg>',
  execute: (args, ctx) => {
    return 'Done';
  }
});
```

## Running Tests

```bash
npm test
```
