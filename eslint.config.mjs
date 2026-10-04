import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const restrictedSyntax = {
  findById: {
    selector: "CallExpression[callee.property.name=/^findById/]",
    message:
      "findById* is banned: wedding-owned lookups must filter by weddingId (DB Design §9.2). Use a repository function that takes weddingId.",
  },
  aggregate: {
    selector: "CallExpression[callee.property.name='aggregate']",
    message:
      "Raw .aggregate() skips soft-delete middleware (DB Design §10.2). Use aggregateScoped(weddingId, pipeline).",
  },
  useServer: {
    selector: "ExpressionStatement[directive='use server']",
    message: "Server Actions are not used in V1; all writes go through the REST API.",
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/models", "@/models/*"],
              message: "Mongoose models may only be imported by *.repository.ts files.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        restrictedSyntax.findById,
        restrictedSyntax.aggregate,
        restrictedSyntax.useServer,
      ],
    },
  },
  {
    // Repositories and the models themselves are the data-access layer.
    files: ["src/**/*.repository.ts", "src/models/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // aggregateScoped() lives here and is the one place allowed to call .aggregate().
    files: ["src/infrastructure/database/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", restrictedSyntax.findById, restrictedSyntax.useServer],
    },
  },
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
