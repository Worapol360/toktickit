import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    environment: 'node'
  }
});