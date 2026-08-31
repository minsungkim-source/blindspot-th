/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: 프로젝트 페이지면 '/<repo>/', 사용자·조직 페이지면 '/'
export default defineConfig({
  base: process.env.VITE_BASE ?? "/blindspot-th/",
  plugins: [react()],
  // tsconfig의 paths는 Vite가 읽지 않는다. 여기서 같은 별칭을 다시 선언해야
  // 소스의 `@/...` import가 해석된다 (tsconfig.json과 값이 어긋나면 안 된다).
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { outDir: "dist", sourcemap: false },
  test: {
    // 패리티 벡터가 tests/ 아래 있어서 루트를 프로젝트 전체로 둔다
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
  },
});
