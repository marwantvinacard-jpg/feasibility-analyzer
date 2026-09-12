// Rewrites "@/..." require() specifiers to the compiled .test-build output.
// tsc's `paths` option only affects type-checking, never emitted require()
// calls, so without this hook every compiled engine file that imports "@/lib/..."
// would fail to resolve at runtime. Loaded via `node -r ./test/register.cjs`.
const Module = require("module");
const path = require("path");

const root = path.join(__dirname, "..", ".test-build");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) {
    request = path.join(root, request.slice(2));
  }
  return orig.call(this, request, ...args);
};
