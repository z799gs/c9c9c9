# 🎨 Pixel Chat - Setup Guide

Combined Pixel Art + Chat system for school websites.

## Features

- **32x32 Pixel Art Canvas** - Collaborative drawing
- **Real-time Chat** - Multiple rooms
- **School-Safe Content Filter** - Blocks inappropriate content, competitor sites, distractions
- **Rate Limiting** - 1 pixel per second, prevents spam

---

## Setup Steps

### Step 1: Google Sheets

1. Open your existing Sheet or create new
2. Keep existing "Sayfa1" sheet for chat
3. **Create new sheet** named exactly: `PixelArt`
4. In PixelArt sheet, add headers in row 1:
   ```
   A1: x
   B1: y
   C1: color
   D1: timestamp
   E1: username
   ```

### Step 2: Apps Script

1. Go to your Sheet → Extensions → Apps Script
2. **Delete all old code**
3. Paste entire `google-apps-script.js` content
4. Save

### Step 3: Deploy

1. Click **Deploy → New deployment**
2. Type: Web app
3. Execute as: Me
4. Who has access: **Anyone**
5. Deploy
6. Copy the Web app URL

### Step 4: Test Filter

1. In Apps Script, select `testFilter` function
2. Click Run
3. Check execution log for results

### Step 5: Setup Triggers

1. Select `setupAutoCleanTrigger` function
2. Click Run
3. Grant permissions

### Step 6: GitHub

Upload these files to your repo:
- `pixelchat.js`
- `pixelchat.css`
- `pixelchat-embed.xml`

### Step 7: Update URLs

In `pixelchat.js`, update line ~10:
```javascript
API_URL: 'YOUR_DEPLOYED_APPS_SCRIPT_URL'
```

In `pixelchat-embed.xml`, update:
- jsDelivr URLs with your username/repo
- Apps Script URL

### Step 8: Google Sites

Embed the XML or use HTML:
```html
<div id="pixel-chat-container"></div>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/USER/REPO@main/pixelchat.css">
<script src="https://cdn.jsdelivr.net/gh/USER/REPO@main/pixelchat.js"></script>
<script>
  PixelChatApp.setApiUrl('YOUR_URL');
  PixelChatApp.init('pixel-chat-container');
</script>
```

---

## Blocked Content List

### Profanity & Slurs
All common profanity, racial slurs, and variations

### Social Media & Links
YouTube, TikTok, Instagram, Discord, Snapchat, Twitter, Facebook, etc.

### Competitor/Distraction Sites
- **Games**: Classroom6x, CoolMathGames, Unblocked Games, Poki, etc.
- **Education**: Blooket, Kahoot, Gimkit, Quizlet, Quizizz, Prodigy, IXL
- **Meeting**: WebEx, Zoom, Google Meet, Teams
- **Coding**: Code.org, CodeHS, Scratch, Replit, Codecademy
- **Gaming**: Roblox, Minecraft, Fortnite, Steam
- **Cheating**: Chegg, Course Hero, Brainly, Mathway

### Personal Info
Email addresses, phone numbers

### Spam
Repeated characters (aaaaaaa), ALL CAPS

---

## Color Palette

25 colors available:
- Black, White, Red, Green, Blue
- Yellow, Magenta, Cyan, Orange, Purple
- Sky Blue, Pink, Lime, Teal, Gray
- Silver, Maroon, Dark Green, Navy, Olive
- Purple, Teal, Light Pink, Gold, Brown

---

## Troubleshooting

**"PixelArt sheet not found"**
- Create sheet named exactly `PixelArt`

**Pixels not saving**
- Check Apps Script is deployed
- Check URL is correct
- Check browser console for errors

**Chat not loading**
- Verify "Sayfa1" sheet exists
- Check deployment URL

**Filter not working**
- Run `testFilter` to verify
- Redeploy after changes

---

## Files

| File | Purpose |
|------|---------|
| google-apps-script.js | Backend API |
| pixelchat.js | Frontend logic |
| pixelchat.css | Styles |
| pixelchat-embed.xml | Google Sites embed |
| test.html | Local testing |
