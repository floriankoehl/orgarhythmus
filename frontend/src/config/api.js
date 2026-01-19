// frontend/src/config/api.js

const hostname = window.location.hostname;

const isLocal =
  hostname === "localhost" ||
  hostname === "127.0.0.1";

// Für lokale Entwicklung - PROXY verwendet, also leer!
const DEV_BASE_URL = "";  // Changed!

// Für Production (Pi + Cloudflare)
const PROD_BASE_URL = "https://api.orgarhythmus.org";

export const BASE_URL = isLocal ? DEV_BASE_URL : PROD_BASE_URL;