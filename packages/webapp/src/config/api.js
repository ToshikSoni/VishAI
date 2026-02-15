// API Configuration
// This file is used to configure the API URL for the application

const getApiUrl = () => {
  // Check if we're running locally
  const isLocal = window.location.hostname === "localhost" || 
                  window.location.hostname === "127.0.0.1";
  
  if (isLocal) {
    return "http://localhost:3000";  // API server runs on port 3000 (MCP server on 3001)
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

// Enhanced fetch with retry logic for cold starts
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for cold start
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        return response;
      }
      
      // If it's a server error, retry
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        // Timeout - likely cold start, retry
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      // Network error, retry
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
  
  throw lastError || new Error('Failed to fetch after retries');
}
