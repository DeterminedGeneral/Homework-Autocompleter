const js = require("@eslint/js");

module.exports = [
    // 1. GLOBAL IGNORES
    // The "**" tells ESLint to ignore the folder AND everything inside it.
    {
        ignores: [
            "sparx/sm_code.js",
            "sparx/sr_code.js",
            "sparx/ss_code.js"
        ]
    },

    // 2. RECOMMENDED CONFIGS
    js.configs.recommended,

    // 3. YOUR CUSTOM RULES
    {
        rules: {
            // Force semicolons
            "semi": ["error", "always"],

            // Warn on unused vars (ignoring variables starting with _)
            "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],

            // Disabled rules
            "no-undef": "off",
            "no-empty": "off",
            "no-case-declarations": "off",
            "no-unreachable": "off"
        }
    }
];