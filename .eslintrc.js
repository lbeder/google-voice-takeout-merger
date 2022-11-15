module.exports = {
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  root: true,
  rules: {
    "sort-imports": "off",
    semi: "error",
    quotes: ["error", "double"],
    "no-console": "error",
    "@typescript-eslint/no-empty-function": "off",
    "object-shorthand-properties-first": "off"
  }
};
