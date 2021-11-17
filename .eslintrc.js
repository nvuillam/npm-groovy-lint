module.exports = {
  env: {
    browser: true,
    es6: true
  },
  extends: [
    'eslint:recommended'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
    "module": true,
    "require": true,
    "process": true,
    "__dirname": true,
    "describe": true,
    "it": true,
    "globalThis": true,
    "beforeEach": true,
    "app": true,
    "Tablesort": true
  },
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    requireConfigFile: false
  },
  rules: {
    "indent": "off" // Managed by prettier
  }
}
