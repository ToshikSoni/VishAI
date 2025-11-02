# Deployment Troubleshooting Guide

## Issue: API Not Working in Production

If you're seeing the error: "I'm sorry, I'm having trouble responding right now", follow these steps:

### 1. Check Your API URL

The frontend is configured to use: `https://vishapii.azurewebsites.net`

Verify this matches your actual Azure App Service URL:
```bash
azd env get-values | grep WEBAPI_URL
```

### 2. Update API URL if Needed

If your API URL is different, update it in:
- `packages/webapp/src/config/api.js` (line 18)
- `packages/webapp/.env.production`

Or set the environment variable before building:
```bash
export VITE_API_URL=https://your-actual-api-url.azurewebsites.net
```

### 3. Verify Azure App Service is Running

Check if your API is accessible:
```bash
curl https://vishapii.azurewebsites.net/
```

Or visit in browser: https://vishapii.azurewebsites.net/

You should see "Vish AI API is running!"

### 4. Check Environment Variables in Azure

Go to Azure Portal → Your App Service → Configuration → Application settings

Verify these are set:
- `AZURE_INFERENCE_SDK_KEY`
- `INSTANCE_NAME`
- `DEPLOYMENT_NAME`

### 5. Check App Service Logs

In Azure Portal → Your App Service → Log stream

Look for errors like:
- Missing environment variables
- OpenAI API errors
- Module not found errors

### 6. Redeploy

After making changes, redeploy:
```bash
azd up
```

Or deploy specific service:
```bash
azd deploy webapi
azd deploy webapp
```

### 7. Common Issues

**Issue: "Failed to fetch"**
- CORS issue or API URL is wrong
- Check browser console for exact error

**Issue: "API returned 500"**
- Backend error, check Azure App Service logs
- Likely missing environment variables

**Issue: "Module not found"**
- Dependencies not installed
- Run `npm install` in packages/webapi before deploying

**Issue: "Content filter error"**
- Azure OpenAI content filter blocked the response
- Check if using sensitive keywords

### 8. Local Testing

Test locally first to isolate deployment issues:
```bash
# Terminal 1 - Start API
cd packages/webapi
npm install
npm start

# Terminal 2 - Start Frontend
cd packages/webapp
npm install
npm run dev
```

### 9. Check Browser Console

Open browser DevTools (F12) → Console tab
Look for:
- API URL being called
- Error messages
- Network requests status

### 10. Verify Package Installation

Make sure `multer` is installed in webapi:
```bash
cd packages/webapi
npm install multer
```

## Quick Fix Commands

```bash
# Get deployment URLs
azd env get-values

# View logs
azd monitor --logs

# Redeploy everything
azd up

# Redeploy only API
azd deploy webapi

# Redeploy only frontend
azd deploy webapp
```
