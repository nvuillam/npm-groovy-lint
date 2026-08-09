import globals from "globals";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
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

            ecmaVersion: "latest",
            sourceType: "module",
        },

        rules: {
            indent: "off",
        },
    },
];
