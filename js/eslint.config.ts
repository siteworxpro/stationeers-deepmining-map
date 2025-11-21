// @ts-ignore
import js from "@eslint/js";
// @ts-ignore
import globals from "globals";
import tseslint from "typescript-eslint";
import {defineConfig} from "eslint/config";

export default defineConfig([
    js.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: {js},
        languageOptions: {globals: globals.browser}
    },
    tseslint.configs.recommended,
    {
        files: ["**/*.{ts,mts,cts}"],
        rules: {
            "@typescript-eslint/ban-ts-comment": "off",
        }
    }
]);
