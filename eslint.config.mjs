import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".test-build/**", "backups/**", "scratch/**", "**/._*", "next-env.d.ts"] },
  {
    rules: {
      // Pre-existing codebase relies on `any` at a handful of SDK/interop
      // boundaries (Ollama, SSE, Firestore) — worth a real type pass later,
      // not a build-breaking rule today.
      "@typescript-eslint/no-explicit-any": "warn",
      // Cosmetic JSX-apostrophe rule; not worth escaping every contraction
      // in existing copy right now.
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default eslintConfig;
