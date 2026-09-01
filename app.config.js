const app = require("./app.json");

// GitHub Pages publishes the app inside /zanomer, while Vercel serves it
// from the domain root. The workflow supplies EXPO_BASE_URL only for Pages.
const baseUrl = process.env.EXPO_BASE_URL;

module.exports = {
  ...app,
  expo: {
    ...app.expo,
    experiments: {
      ...app.expo.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  },
};
