import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // O código formata datas e horas para Lisboa a partir de instantes UTC.
    // Fixar o fuso do processo em UTC garante que o teste apanha um erro de
    // conversão em vez de o esconder por a máquina já estar em Lisboa.
    env: { TZ: "UTC" },
  },
})
