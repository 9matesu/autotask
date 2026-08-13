# Contributing to Autotask

Thank you for contributing to Autotask!

## Development Workflow

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Run tests to verify the baseline:
   ```bash
   npm test
   ```

3. Start interactive development mode in mock mode:
   ```bash
   npm run dev:mock
   ```

4. Verify TypeScript compilation:
   ```bash
   npm run build
   ```

## Code Guidelines
- Use clean TypeScript with ESM modules.
- Ensure all subprocess executions on Windows remain safe from orphaned child processes.
- Never add external database dependencies.
- Add Vitest tests for any new parsers, retry logic, or classifiers.
