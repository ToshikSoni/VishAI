targetScope = 'subscription'
param webapiName string = 'vishapii'
param appServicePlanName string = 'appserviceplan'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

param rg string = ''
param webappName string = 'webapp'

@description('Location for the Static Web App')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia', 'eastasiastage'])
@metadata({
  azd: {
    type: 'location'
  }
})
param webappLocation string

@secure()
@description('Azure OpenAI API Key')
param azureInferenceSdkKey string

@description('Azure OpenAI Instance Name')
param instanceName string

@description('Azure OpenAI Deployment Name')
param deploymentName string

// ---------------------------------------------------------------------------
// Common variables
var abbrs = loadJsonContent('./abbreviations.json')
var tags = {
  'azd-env-name': environmentName
}

// ---------------------------------------------------------------------------
// Resources

// Organize resources in a resource group ✅
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(rg) ? rg : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module webapp 'br/public:avm/res/web/static-site:0.7.0' = {
  name: 'webapp'
  scope: resourceGroup
  params: {
    name: webappName
    location: webappLocation
    tags: union(tags, { 'azd-service-name': webappName })
    sku: 'Standard'
  }
}

module serverfarm 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'appserviceplan'
  scope: resourceGroup
  params: {
    name: appServicePlanName
    skuName: 'B1'
  }
}

module webapi 'br/public:avm/res/web/site:0.15.1' = {
  name: 'webapi'
  scope: resourceGroup
  params: {
    kind: 'app'
    name: webapiName
    tags: union(tags, { 'azd-service-name': 'webapi' })
    serverFarmResourceId: serverfarm.outputs.resourceId
    appSettingsKeyValuePairs: {
      AZURE_INFERENCE_SDK_KEY: azureInferenceSdkKey
      INSTANCE_NAME: instanceName
      DEPLOYMENT_NAME: deploymentName
      SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
      WEBSITE_NODE_DEFAULT_VERSION: '~20'
    }
  }
}

output WEBAPP_URL string = webapp.outputs.defaultHostname
output WEBAPI_URL string = webapi.outputs.defaultHostname
