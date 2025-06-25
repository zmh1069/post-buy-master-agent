# GitHub Secrets Setup Guide

This guide will help you set up GitHub Secrets to securely manage your environment variables instead of using `env.txt` files.

## 🔐 **Why GitHub Secrets?**

- **Security**: API keys are encrypted and not visible in your code
- **Automatic CI/CD**: Agents can run in GitHub Actions with secure credentials
- **Team Access**: Control who can see/modify secrets
- **Deployment Ready**: Works seamlessly with cloud deployments

## 📋 **Required Secrets**

You need to set up the following secrets in your GitHub repository:

### **1. Supabase Configuration**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key (not the anon key!)

### **2. HouseCanary Credentials**
- `HOUSECANARY_EMAIL` - Your HouseCanary account email
- `HOUSECANARY_PASSWORD` - Your HouseCanary account password

## ⚙️ **How to Set Up GitHub Secrets**

### **Step 1: Navigate to Repository Settings**
1. Go to your GitHub repository
2. Click on **"Settings"** tab
3. In the left sidebar, click **"Secrets and variables"**
4. Click **"Actions"**

### **Step 2: Add Repository Secrets**
Click **"New repository secret"** for each of the following:

```
Name: SUPABASE_URL
Secret: https://your-project-id.supabase.co

Name: SUPABASE_SERVICE_KEY  
Secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Name: HOUSECANARY_EMAIL
Secret: your-email@example.com

Name: HOUSECANARY_PASSWORD
Secret: your-secure-password
```

### **Step 3: Verify Setup**
Once you've added all secrets, commit and push any changes to trigger the GitHub Action, which will verify the configuration.

## 🏠 **Local Development**

For local development, you can still use an `env.txt` file:

### **Option 1: Create env.txt (for local development only)**
```bash
cp env.txt.template env.txt
# Edit env.txt with your actual values
```

### **Option 2: Use Environment Variables Directly**
```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_KEY="your_service_key"
export HOUSECANARY_EMAIL="your_email"
export HOUSECANARY_PASSWORD="your_password"
```

## 🔄 **How It Works**

The agents now use a **shared configuration system** that:

1. **In Production/CI**: Uses environment variables (GitHub Secrets)
2. **In Development**: Falls back to `env.txt` file if environment variables aren't set
3. **Validates**: Ensures all required configuration is present
4. **Logs**: Shows whether it's using environment variables or env.txt

## 🚀 **Benefits**

- ✅ **Secure**: No API keys in your code repository
- ✅ **Flexible**: Works in both development and production
- ✅ **Automated**: GitHub Actions can run tests automatically
- ✅ **Team-Ready**: Multiple developers can work without sharing credentials
- ✅ **Deployment-Ready**: Easy to deploy to cloud platforms

## 🔍 **Troubleshooting**

### **"Missing required configuration" Error**
- Check that all 4 secrets are set in GitHub
- Verify secret names match exactly (case-sensitive)
- Make sure you're using the Supabase **service key**, not the anon key

### **Local Development Issues**
- Ensure `env.txt` exists and has correct format
- Check that lines in `env.txt` follow `KEY=value` format (no spaces around =)
- Verify the shared-config.js file is in the right location

### **GitHub Actions Failing**
- Check the Actions tab for detailed error messages
- Verify all secrets are properly set in repository settings
- Make sure the workflow file has the correct secret names

## 📞 **Need Help?**

If you encounter issues:
1. Check the GitHub Actions logs for detailed error messages
2. Verify your Supabase credentials in the Supabase dashboard
3. Test HouseCanary credentials by logging in manually to their website 