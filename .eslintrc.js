module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project:'./tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  rules: {
    "arrow-parens": "error",
    "curly": ["error", "all"],
    "indent": "off",
    "brace-style": "off",
    "space-before-blocks": ["error", "always"],
    "keyword-spacing": ["error"],
    "@typescript-eslint/brace-style": ["error", "stroustrup"],
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/indent": ["error", 2],
    "@typescript-eslint/semi": ["error"],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off"
  },
  ignorePatterns: [ "examples" ],
}
