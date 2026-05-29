# Quick Start Guide

## ⚡ Get Running in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```
This installs Playwright, Nodemailer, Node-Schedule, and dotenv.

### Step 2: Create Your .env File
Copy the example to a real file:
```bash
copy .env.example .env
```

### Step 3: Get Your Gmail App Password
1. Go to https://myaccount.google.com/security/apppasswords
2. Select "Mail" and "Windows Computer"
3. Copy the 16-character password
4. Edit `.env` and paste it:
   ```
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   RECIPIENT_EMAIL=where@to-send-notifications.com
   ```

### Step 4: Run the Application
```bash
npm start
```

That's it! The app will:
- ✓ Check the court case immediately
- ✓ Repeat checks every 6 hours
- ✓ Send email when updates are found
- ✓ Keep running in the background

---

## 🔧 Troubleshooting

**"Missing environment variables"**
→ Make sure you created `.env` file and filled in all values

**"Gmail password rejected"**
→ You need an app password, not your regular password
→ See Step 3 above

**"Cannot find module"**
→ Run `npm install` again

**"No results found"**
→ The case number or website might be down
→ Check the console output for details

---

## 📧 Testing Email

Run this to verify email works:
```bash
npm start
```

Wait for the first check to complete. If you have the correct credentials, you'll get an email within a minute.

---

## 🐳 Deploying to Render (Free Hosting)

See README.md for full deployment instructions. In brief:

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Add court monitor"
   git push
   ```

2. Go to https://render.com
3. Click "New +" → "Background Worker"
4. Connect your GitHub repo
5. Set environment variables (same as .env)
6. Deploy!

The app will run continuously on Render's free tier.

---

## 📋 What Gets Saved

- `lastUpdate.json` - Tracks the latest docket entry
- Logs - Displayed in console and visible in Render dashboard

---

## ⏰ How Often Does It Check?

By default: **Every 6 hours**

To change, edit `.env`:
```
CHECK_INTERVAL=3    # Check every 3 hours
CHECK_INTERVAL=12   # Check every 12 hours
```

---

## 🛑 Stopping the Application

Press `Ctrl+C` in the terminal to stop monitoring.

---

## 💡 Pro Tips

1. **Test with a shorter interval first:**
   ```
   CHECK_INTERVAL=1
   ```
   Then restart. Wait 1 hour and you'll see if it works.

2. **Use a dedicated Gmail account** for the app password for better security.

3. **Monitor the logs** - they'll tell you exactly what's happening.

4. **Keep it running** - on Render, the app runs 24/7 for free.

---

For more details, see README.md
