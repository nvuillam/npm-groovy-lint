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
    "require": true,
    "process": true
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  rules: {
    "indent": ["error", 4]
  }
}
