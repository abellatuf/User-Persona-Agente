import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // La prueba de integración levanta el servidor MCP real: le damos margen.
    testTimeout: 30_000,
  },
});
