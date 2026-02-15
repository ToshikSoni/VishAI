# Deployment Guide - VishAI to Azure

This guide walks you through deploying VishAI to Microsoft Azure for the AI Dev Days Hackathon.

## Prerequisites

- Azure subscription ([Free trial available](https://azure.microsoft.com/free/))
- Azure CLI installed ([Install guide](https://docs.microsoft.com/cli/azure/install-azure-cli))
- Docker installed (for containerized deployment)
- GitHub account (for CI/CD)
- Node.js 20.x installed locally

## Quick Deployment Options

### Option 1: Azure App Service (Recommended for Hackathon)

Easiest deployment method with built-in scaling and monitoring.

#### Step 1: Login to Azure

```bash
az login
az account set --subscription "Your-Subscription-Name"
```

#### Step 2: Create Resource Group

```bash
az group create \
  --name vishai-rg \
  --location westus2 \
  --tags project=VishAI hackathon=AI-Dev-Days-2026
```

#### Step 3: Create Azure Services

```bash
# Create Azure OpenAI (if not already created)
az cognitiveservices account create \
  --name vishai-openai \
  --resource-group vishai-rg \
  --kind OpenAI \
  --sku S0 \
  --location westus2

# Deploy GPT-4o model
az cognitiveservices account deployment create \
  --name vishai-openai \
  --resource-group vishai-rg \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard

# Create Cosmos DB
az cosmosdb create \
  --name vishai-cosmos \
  --resource-group vishai-rg \
  --locations regionName=westus2 \
  --kind GlobalDocumentDB

# Create Cosmos DB database and containers
az cosmosdb sql database create \
  --account-name vishai-cosmos \
  --resource-group vishai-rg \
  --name vishai_db

az cosmosdb sql container create \
  --account-name vishai-cosmos \
  --resource-group vishai-rg \
  --database-name vishai_db \
  --name conversations \
  --partition-key-path /sessionId \
  --throughput 400

# Create Key Vault
az keyvault create \
  --name vishai-keyvault \
  --resource-group vishai-rg \
  --location westus2

# Create Application Insights
az monitor app-insights component create \
  --app vishai-insights \
  --location westus2 \
  --resource-group vishai-rg \
  --application-type web
```

#### Step 4: Store Secrets in Key Vault

```bash
# Get OpenAI credentials
OPENAI_KEY=$(az cognitiveservices account keys list \
  --name vishai-openai \
  --resource-group vishai-rg \
  --query key1 -o tsv)

OPENAI_ENDPOINT=$(az cognitiveservices account show \
  --name vishai-openai \
  --resource-group vishai-rg \
  --query properties.endpoint -o tsv)

# Get Cosmos DB credentials
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name vishai-cosmos \
  --resource-group vishai-rg \
  --query documentEndpoint -o tsv)

COSMOS_KEY=$(az cosmosdb keys list \
  --name vishai-cosmos \
  --resource-group vishai-rg \
  --query primaryMasterKey -o tsv)

# Store in Key Vault
az keyvault secret set --vault-name vishai-keyvault --name AZURE-OPENAI-KEY --value "$OPENAI_KEY"
az keyvault secret set --vault-name vishai-keyvault --name AZURE-OPENAI-ENDPOINT --value "$OPENAI_ENDPOINT"
az keyvault secret set --vault-name vishai-keyvault --name COSMOS-DB-ENDPOINT --value "$COSMOS_ENDPOINT"
az keyvault secret set --vault-name vishai-keyvault --name COSMOS-DB-KEY --value "$COSMOS_KEY"
```

#### Step 5: Create App Service Plans and Web Apps

```bash
# Create App Service Plan
az appservice plan create \
  --name vishai-plan \
  --resource-group vishai-rg \
  --sku B1 \
  --is-linux

# Create Web App for API
az webapp create \
  --name vishai-api \
  --resource-group vishai-rg \
  --plan vishai-plan \
  --runtime "NODE:20-lts"

# Create Web App for MCP Server
az webapp create \
  --name vishai-mcp \
  --resource-group vishai-rg \
  --plan vishai-plan \
  --runtime "NODE:20-lts"

# Enable managed identity for Key Vault access
az webapp identity assign \
  --name vishai-api \
  --resource-group vishai-rg

az webapp identity assign \
  --name vishai-mcp \
  --resource-group vishai-rg
```

#### Step 6: Configure Key Vault Access

```bash
# Get API webapp identity
API_IDENTITY=$(az webapp identity show \
  --name vishai-api \
  --resource-group vishai-rg \
  --query principalId -o tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name vishai-keyvault \
  --object-id $API_IDENTITY \
  --secret-permissions get list
```

#### Step 7: Configure Application Settings

```bash
# API settings
az webapp config appsettings set \
  --name vishai-api \
  --resource-group vishai-rg \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    MCP_SERVER_URL="https://vishai-mcp.azurewebsites.net" \
    AZURE_KEYVAULT_URL="https://vishai-keyvault.vault.azure.net/" \
    DEPLOYMENT_NAME=gpt-4o \
    COSMOS_DB_DATABASE=vishai_db

# MCP settings
az webapp config appsettings set \
  --name vishai-mcp \
  --resource-group vishai-rg \
  --settings \
    NODE_ENV=production \
    PORT=3001
```

#### Step 8: Deploy Applications

```bash
# Navigate to project root
cd /path/to/JS-AI_VishAI

# Deploy API
cd packages/webapi
zip -r api-deploy.zip . -x "node_modules/*"
az webapp deployment source config-zip \
  --name vishai-api \
  --resource-group vishai-rg \
  --src api-deploy.zip

# Deploy MCP Server
cd ../mcp-server
zip -r mcp-deploy.zip . -x "node_modules/*"
az webapp deployment source config-zip \
  --name vishai-mcp \
  --resource-group vishai-rg \
  --src mcp-deploy.zip
```

#### Step 9: Deploy Frontend (Static Web App)

```bash
# Create Static Web App
az staticwebapp create \
  --name vishai-frontend \
  --resource-group vishai-rg \
  --location westus2 \
  --source https://github.com/ToshikSoni/JS-AI_VishAI \
  --branch Avatar \
  --app-location "/packages/webapp" \
  --output-location "dist" \
  --login-with-github

# Configure API URL for frontend
az staticwebapp appsettings set \
  --name vishai-frontend \
  --setting-names VITE_API_URL=https://vishai-api.azurewebsites.net
```

### Option 2: Docker Container Deployment

For more control and containerized deployment:

```bash
# Create Azure Container Registry
az acr create \
  --name vishairegistry \
  --resource-group vishai-rg \
  --sku Basic \
  --admin-enabled true

# Build and push images
docker-compose build
docker tag vishai-api vishairegistry.azurecr.io/vishai-api:latest
docker tag vishai-mcp vishairegistry.azurecr.io/vishai-mcp:latest

# Push to ACR
az acr login --name vishairegistry
docker push vishairegistry.azurecr.io/vishai-api:latest
docker push vishairegistry.azurecr.io/vishai-mcp:latest

# Deploy containers to App Service
az webapp create \
  --name vishai-api \
  --resource-group vishai-rg \
  --plan vishai-plan \
  --deployment-container-image-name vishairegistry.azurecr.io/vishai-api:latest
```

## CI/CD Setup (GitHub Actions)

### Step 1: Get Publish Profiles

```bash
# Get API publish profile
az webapp deployment list-publishing-profiles \
  --name vishai-api \
  --resource-group vishai-rg \
  --xml > api-publish-profile.xml

# Get MCP publish profile
az webapp deployment list-publishing-profiles \
  --name vishai-mcp \
  --resource-group vishai-rg \
  --xml > mcp-publish-profile.xml
```

### Step 2: Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and add:

- `AZURE_WEBAPP_API_PUBLISH_PROFILE` - Content of api-publish-profile.xml
- `AZURE_WEBAPP_MCP_PUBLISH_PROFILE` - Content of mcp-publish-profile.xml
- `AZURE_STATIC_WEB_APPS_API_TOKEN` - From Static Web App deployment token
- `AZURE_CONTAINER_REGISTRY` - vishairegistry.azurecr.io
- `ACR_USERNAME` - From ACR admin credentials
- `ACR_PASSWORD` - From ACR admin credentials

The GitHub Actions workflow (`.github/workflows/azure-deploy.yml`) will automatically deploy on push to main branch.

## Verification

### Check Deployments

```bash
# Check API health
curl https://vishai-api.azurewebsites.net/health

# Check MCP health
curl https://vishai-mcp.azurewebsites.net/health

# Check frontend
open https://vishai-frontend.azurestaticapps.net
```

### View Logs

```bash
# API logs
az webapp log tail --name vishai-api --resource-group vishai-rg

# MCP logs
az webapp log tail --name vishai-mcp --resource-group vishai-rg
```

## Monitoring & Scaling

### Enable Application Insights

```bash
# Get connection string
AI_CONNECTION=$(az monitor app-insights component show \
  --app vishai-insights \
  --resource-group vishai-rg \
  --query connectionString -o tsv)

# Add to Key Vault
az keyvault secret set \
  --vault-name vishai-keyvault \
  --name APP-INSIGHTS-CONNECTION \
  --value "$AI_CONNECTION"

# Update app settings to use Key Vault reference
az webapp config appsettings set \
  --name vishai-api \
  --resource-group vishai-rg \
  --settings \
    APPLICATIONINSIGHTS_CONNECTION_STRING="@Microsoft.KeyVault(SecretUri=https://vishai-keyvault.vault.azure.net/secrets/APP-INSIGHTS-CONNECTION/)"
```

### Configure Auto-Scaling

```bash
az monitor autoscale create \
  --resource-group vishai-rg \
  --resource vishai-plan \
  --resource-type Microsoft.Web/serverfarms \
  --name vishai-autoscale \
  --min-count 1 \
  --max-count 5 \
  --count 1

az monitor autoscale rule create \
  --resource-group vishai-rg \
  --autoscale-name vishai-autoscale \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1
```

## Cost Optimization

### Development/Hackathon Setup
- App Service: B1 tier (~$13/month)
- Cosmos DB: Serverless mode (pay per use)
- Static Web App: Free tier
- **Total: ~$15-30/month**

### Production Setup
- App Service: P1V2 tier with autoscaling
- Cosmos DB: Provisioned throughput
- Azure Front Door for CDN
- **Total: Scale based on usage**

## Troubleshooting

### Common Issues

1. **App won't start:**
   ```bash
   # Check logs
   az webapp log tail --name vishai-api --resource-group vishai-rg
   
   # Restart app
   az webapp restart --name vishai-api --resource-group vishai-rg
   ```

2. **Key Vault access denied:**
   ```bash
   # Verify managed identity
   az webapp identity show --name vishai-api --resource-group vishai-rg
   
   # Re-grant access
   az keyvault set-policy --name vishai-keyvault --object-id <IDENTITY-ID> --secret-permissions get list
   ```

3. **Cosmos DB connection issues:**
   ```bash
   # Verify firewall rules
   az cosmosdb update --name vishai-cosmos --resource-group vishai-rg --enable-public-network true
   ```

## Cleanup (After Hackathon)

```bash
# Delete entire resource group
az group delete --name vishai-rg --yes --no-wait
```

## Next Steps

- ✅ Test all endpoints in production
- ✅ Configure custom domain (optional)
- ✅ Set up monitoring alerts
- ✅ Review security recommendations
- ✅ Submit hackathon with deployed URLs!

## Support

- Azure Docs: https://docs.microsoft.com/azure
- Hackathon Discord: [Your Discord Link]
- GitHub Issues: https://github.com/ToshikSoni/JS-AI_VishAI/issues

---

**Good luck with the hackathon! 🚀**
