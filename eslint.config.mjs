// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

const base = zotero({
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        // We disable this rule here because the template
        // contains some unused examples and variables
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
});

const baseArray = Array.isArray(base) ? base : [base];

export default [
  ...baseArray,
  {
    // Node-side build/diagnostic scripts under scripts/ use process/console and
    // aren't shipped plugin code — don't lint them with the browser config.
    ignores: ["scripts/**"],
  },
];
