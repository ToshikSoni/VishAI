const getApiUrl = () => {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocal) return "http://localhost:3000";
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return "https://vishapii.azurewebsites.net";
};

export const API_URL = getApiUrl();

export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (response.ok) return response;
      if (response.status >= 500) {
        lastError = new Error(`Server error: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }

  throw lastError || new Error('Failed to fetch after retries');
}
