import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/__tests__/setup.ts"],
    // Ограничиваем поиск тестов корневой папкой `src/` — тесты внутри
    // `packages/uni-fw-*/src/__tests__/` копируются как «спящие» снапшоты
    // (Phase 2 / CONTEXT.md D-05, D-06) и не должны запускаться корневым vitest.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
