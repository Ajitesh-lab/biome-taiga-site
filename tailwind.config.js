module.exports = {
  content: ["./*.html", "./blog/*.html", "./cookie-consent.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0c2c16",
        secondary: "#566342",
        surface: "#f9faf6",
        "surface-container-low": "#f3f4f0",
        "surface-container": "#edeeea",
        "surface-container-high": "#e7e9e5",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#1a1c1a",
        "on-surface-variant": "#424842",
        "outline-variant": "#c2c8bf",
        "secondary-container": "#dae8be",
        "on-secondary-container": "#5c6947",
        "primary-container": "#23422a",
        "on-primary-container": "#8cae8f",
        "surface-variant": "#e2e3df",
        outline: "#727971",
      },
      fontFamily: {
        headline: ["Helvetica", "Arial", "sans-serif"],
        body: ["Helvetica", "Arial", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px",
      },
    },
  },
};
