module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
  },
  plugins: ["promise"],
  extends: ["eslint:recommended", "google", "airbnb-base", "prettier"],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { allowTemplateLiterals: true }],
    "quote-props": ["error", "consistent-as-needed"],
    "max-len": ["warn", { code: 299 }],
    "indent": ["error", 2, { SwitchCase: 1 }],
    "no-unused-vars": ["warn"],
    "object-curly-spacing": ["off"],
    "space-before-function-paren": ["off"],
    "prefer-const": ["warn"],
    "camelcase": ["off"],
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
