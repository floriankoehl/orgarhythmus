// frontend/src/config/api.js

const hostname = window.location.hostname;

const isLocal =
  hostname === "localhost" ||
  hostname === "127.0.0.1";

// Für lokale Entwicklung (Laptop)
const DEV_BASE_URL = "http://127.0.0.1:8000";

// Für alles, was über Domain läuft (Pi + Cloudflare)
const PROD_BASE_URL = "https://api.floriankoehl.com";

export const BASE_URL = isLocal ? DEV_BASE_URL : PROD_BASE_URL;
