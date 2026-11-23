export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "tests/fixtures/**",
      ".git/**"
    ]
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        chrome: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        HTMLTextAreaElement: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        MutationObserver: "readonly",
        Node: "readonly",
        Element: "readonly",
        webkitSpeechRecognition: "readonly",
        SpeechRecognition: "readonly",
        URL: "readonly",
        process: "readonly",
        performance: "readonly",
        Buffer: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error"
    }
  }
];
