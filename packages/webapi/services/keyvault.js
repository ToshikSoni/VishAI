/**
 * Azure Key Vault Integration for VishAI
 * Securely manages API keys and sensitive configuration
 */

const { SecretClient } = require('@azure/keyvault-secrets');
const { DefaultAzureCredential } = require('@azure/identity');

class KeyVaultService {
  constructor() {
    this.vaultUrl = process.env.AZURE_KEYVAULT_URL || '';
    this.client = null;
    this.isInitialized = false;
    this.cache = new Map(); // In-memory cache for secrets
  }

  /**
   * Initialize Key Vault connection
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Skip if vault URL not configured (use environment variables)
      if (!this.vaultUrl) {
        console.warn('⚠️ Key Vault not configured - using environment variables');
        return;
      }

      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(this.vaultUrl, credential);
      
      this.isInitialized = true;
      console.log('✅ Key Vault initialized successfully');
    } catch (error) {
      console.error('❌ Key Vault initialization failed:', error.message);
      console.warn('⚠️ Falling back to environment variables');
    }
  }

  /**
   * Get secret from Key Vault (with fallback to env vars)
   */
  async getSecret(secretName, fallbackEnvVar = null) {
    // Check cache first
    if (this.cache.has(secretName)) {
      return this.cache.get(secretName);
    }

    // Try Key Vault if initialized
    if (this.isInitialized && this.client) {
      try {
        const secret = await this.client.getSecret(secretName);
        this.cache.set(secretName, secret.value);
        return secret.value;
      } catch (error) {
        console.warn(`⚠️ Failed to get secret '${secretName}' from Key Vault:`, error.message);
      }
    }

    // Fallback to environment variable
    if (fallbackEnvVar) {
      const value = process.env[fallbackEnvVar];
      if (value) {
        this.cache.set(secretName, value);
        return value;
      }
    }

    // Try direct env var with secret name
    const value = process.env[secretName.toUpperCase().replace(/-/g, '_')];
    if (value) {
      this.cache.set(secretName, value);
      return value;
    }

    throw new Error(`Secret '${secretName}' not found in Key Vault or environment variables`);
  }

  /**
   * Set secret in Key Vault
   */
  async setSecret(secretName, secretValue) {
    if (!this.isInitialized || !this.client) {
      throw new Error('Key Vault not initialized');
    }

    try {
      await this.client.setSecret(secretName, secretValue);
      this.cache.set(secretName, secretValue);
      console.log(`✅ Secret '${secretName}' stored in Key Vault`);
    } catch (error) {
      console.error(`❌ Failed to set secret '${secretName}':`, error.message);
      throw error;
    }
  }

  /**
   * Get all required secrets for the application
   */
  async loadAllSecrets() {
    const secrets = {
      azureOpenAIKey: await this.getSecret('AZURE-OPENAI-KEY', 'AZURE_INFERENCE_SDK_KEY'),
      azureOpenAIEndpoint: await this.getSecret('AZURE-OPENAI-ENDPOINT', 'INSTANCE_NAME'),
      cosmosDBEndpoint: await this.getSecret('COSMOS-DB-ENDPOINT', 'COSMOS_DB_ENDPOINT'),
      cosmosDBKey: await this.getSecret('COSMOS-DB-KEY', 'COSMOS_DB_KEY'),
      appInsightsConnection: await this.getSecret('APP-INSIGHTS-CONNECTION', 'APPLICATIONINSIGHTS_CONNECTION_STRING')
    };

    console.log('✅ All secrets loaded successfully');
    return secrets;
  }

  /**
   * Clear cache (for testing or refresh)
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Secret cache cleared');
  }
}

// Singleton instance
const keyVault = new KeyVaultService();

module.exports = keyVault;
