// API Configuration
// This file is used to configure the API URL for the application

const getApiUrl = () => {
  // Check if we're running locally
  const isLocal = window.location.hostname === "localhost" || 
                  window.location.hostname === "127.0.0.1";
  
  if (isLocal) {
    return "http://localhost:3001";
  }
  
  // In production, try environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback: try to use the same domain with /api prefix (for Azure Static Web Apps with API)
  // Or hardcoded URL
  return "https://vishapii.azurewebsites.net";
};

export const API_URL = getApiUrl();
