import globals from "globals";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha,
            },

            ecmaVersion: "latest",
            sourceType: "module",
        },

        rules: {
            indent: "off",
        },
    },
    {
        // Browser scripts embedded in the documentation site
        files: ["docs/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                app: "readonly",
                Tablesort: "readonly",
            },
        },
    },
];
