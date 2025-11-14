// frontend/src/config/api.js

// Für lokale Entwicklung:
const DEV_BASE_URL = "http://127.0.0.1:8000";

// Für das Deployment auf dem Raspberry:
const PROD_BASE_URL = "https://api.floriankoehl.com";

export const BASE_URL =
  import.meta.env.MODE === "development" ? DEV_BASE_URL : PROD_BASE_URL;
