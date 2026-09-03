/// <reference types="vite/client" />

// import.meta.env(BASE_URL 등)의 타입은 vite/client가 제공한다.
// 이 파일이 없으면 tsc가 App.tsx의 import.meta.env를 모른다 —
// Vite로 돌릴 때는 동작하지만 typecheck와 build(tsc -b)가 실패한다.
