# Court Case Monitor Setup

## .env File Configuration

Create a `.env` file in the root directory with the following variables:

```
# Gmail SMTP Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
RECIPIENT_EMAIL=recipient@example.com

# Case Information
CASE_NUMBER=46C01-2511-ES-000237
CASE_URL=https://mycase.in.gov/cases/

# Monitoring
CHECK_INTERVAL=6
```

## Getting Gmail App Password

1. Go to https://myaccount.google.com/
2. Select "Security" from the left menu
3. Enable "2-Step Verification" if not already enabled
4. Search for "App passwords" and select it
5. Choose "Mail" and "Windows Computer" (or your device)
6. Google will generate a 16-character password
7. Copy this password and use it as `EMAIL_PASSWORD` in your `.env` file

## Installation Steps

1. **Clone/download the project and navigate to the directory:**
   ```
   cd "Court Docker Checker"
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Create a .env file:**
   - Copy the example above
   - Replace `your-email@gmail.com` with your Gmail address
   - Replace `your-app-password` with the 16-character app password
   - Set `RECIPIENT_EMAIL` to where you want notifications sent

4. **Create the lastUpdate.json file:**
   ```
   npm start
   ```
   This will automatically create the tracking file on first run.

## Running the Application

**Start the monitor:**
```
npm start
```

The application will:
- Check the court case page immediately
- Schedule automatic checks every 6 hours
- Save the latest docket entry information to `lastUpdate.json`
- Send an email notification if new entries are found
- Display all activity in the console

## How It Works

1. **Scraping**: Uses Playwright to fetch and parse the Indiana MyCase court page
2. **Tracking**: Stores the last known docket entry in `lastUpdate.json`
3. **Comparison**: Checks if new entries exist on each run
4. **Notification**: Sends an email via Gmail SMTP when updates are found
5. **Scheduling**: Automatically checks every 6 hours

## Deployment to Render

### 1. Prepare Your GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/court-case-monitor.git
git push -u origin main
```

### 2. Create Environment Variables on Render

1. Go to https://render.com and sign up
2. Click "New +" and select "Background Worker"
3. Connect your GitHub repository
4. Fill in the deployment details:
   - **Name**: court-case-monitor
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Go to "Environment" tab and add these variables:
   - `EMAIL_USER`: your-email@gmail.com
   - `EMAIL_PASSWORD`: your-app-password
   - `RECIPIENT_EMAIL`: recipient@example.com
   - `CASE_NUMBER`: 46C01-2511-ES-000237
   - `CASE_URL`: https://mycase.in.gov/cases/
   - `CHECK_INTERVAL`: 6

6. Click "Create Background Worker"

### 3. Monitor Your Deployment

- Render will automatically deploy when you push to GitHub
- View logs in the Render dashboard
- The app will run continuously and check every 6 hours

### 4. Troubleshooting Render Deployment

If the app stops running:
- Check the logs in the Render dashboard
- Verify all environment variables are set correctly
- Ensure your `.env.example` file documents all required variables
- Note: Free tier instances may spin down after inactivity

## Project Structure

```
Court Docker Checker/
├── index.js              # Main entry point
├── package.json          # Dependencies
├── .env                  # Your configuration (not in git)
├── .env.example          # Example configuration
├── .gitignore            # Git ignore file
├── README.md             # This file
├── lastUpdate.json       # Tracking file (auto-created)
└── src/
    ├── scraper.js        # Playwright scraping logic
    ├── emailService.js   # Email notification logic
    └── scheduler.js      # Scheduling logic
```

## Troubleshooting

**Issue: "Gmail password rejected"**
- Make sure you're using an app password, not your regular Gmail password
- Verify 2-Step Verification is enabled
- Check that EMAIL_USER matches the Gmail account that generated the app password

**Issue: "Cannot find module"**
- Run `npm install` to ensure all dependencies are installed

**Issue: "No updates found"**
- Verify the CASE_NUMBER is correct
- Check that the website is accessible from your location
- Review console logs for more details

**Issue: "Email not sending"**
- Check your `.env` file has correct Gmail credentials
- Verify RECIPIENT_EMAIL is a valid email address
- Check Gmail security settings haven't blocked the app

## Security Notes

- Never commit your `.env` file to GitHub (it's in `.gitignore`)
- Use app passwords instead of your main Gmail password
- Consider using environment-specific configurations for different deployments
