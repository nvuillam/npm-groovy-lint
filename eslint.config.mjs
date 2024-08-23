import globals from "globals";
import babelParser from "@babel/eslint-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("eslint:recommended"), {
    languageOptions: {
        globals: {
            ...globals.browser,
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
            module: true,
            require: true,
            process: true,
            __dirname: true,
            describe: true,
            it: true,
            globalThis: true,
            beforeEach: true,
            app: true,
            Tablesort: true,
        },

        parser: babelParser,
        ecmaVersion: 2018,
        sourceType: "module",

        parserOptions: {
            requireConfigFile: false,
        },
    },

    rules: {
        indent: "off",
    },
}];