# APPLICATION TROUBLESHOOTING GUIDE

## ✅ SERVERS ARE RUNNING CORRECTLY

Both servers are confirmed to be running:
- **Frontend**: http://localhost:5173 (Port 5173) ✅
- **Backend**: http://localhost:5001 (Port 5001) ✅

---

## 🔧 TROUBLESHOOTING STEPS

### Step 1: Open the Application

1. **Open your web browser** (Chrome, Edge, or Firefox recommended)
2. **Navigate to**: `http://localhost:5173`
3. **Wait 5-10 seconds** for the page to load

### Step 2: Clear Browser Cache

If you see a blank page or old content:

**Option A: Hard Refresh**
- Press `Ctrl + Shift + R` (Windows)
- Or `Ctrl + F5`

**Option B: Clear Cache Completely**
1. Press `F12` to open DevTools
2. Right-click the **Refresh** button (next to address bar)
3. Select **"Empty Cache and Hard Reload"**
4. Close DevTools

### Step 3: Check for Errors

1. Press `F12` to open Developer Tools
2. Click the **Console** tab
3. Look for **red error messages**
4. Take a screenshot if you see errors

### Step 4: Check Network Tab

1. Keep DevTools open (F12)
2. Click the **Network** tab
3. Refresh the page (`Ctrl + R`)
4. Look for failed requests (shown in red)
5. Check if API calls to `localhost:5001` are failing

### Step 5: Verify Login Page Loads

You should see:
- **Logo**: Thiagarajar Mills logo
- **Title**: "Contract Lifecycle Management"
- **Input fields**: Username and Password
- **Button**: "Sign In"
- **Demo credentials** shown at bottom

---

## 🚨 COMMON ISSUES & SOLUTIONS

### Issue 1: Blank White Page

**Solution:**
1. Clear browser cache (Step 2 above)
2. Close ALL browser tabs
3. Restart browser
4. Try again: `http://localhost:5173`

### Issue 2: "Cannot GET /" Error

**Solution:**
- Frontend server stopped
- Restart it:
```bash
cd client
npm run dev
```

### Issue 3: Network Errors / API Failures

**Solution:**
- Backend server stopped
- Restart it:
```bash
cd server
npm start
```

### Issue 4: "ERR_CONNECTION_REFUSED"

**Solution:**
1. Check if servers are running:
```bash
netstat -ano | findstr "5173 5001"
```

2. If not listed, start both servers (see below)

### Issue 5: Old Logo/Name Still Showing

**Solution:**
- Clear browser cache completely
- Force reload: `Ctrl + Shift + R`
- The new Thiagarajar Mills logo should appear

---

## 🔄 RESTART SERVERS (If Needed)

### Stop All Node Processes (Clean Restart)

```bash
# Kill all node processes
taskkill /F /IM node.exe

# Wait 5 seconds, then restart
```

### Start Backend Server

**Terminal 1**:
```bash
cd "c:\Users\vaish\Downloads\cotton mills\tce-mills-main - copy backup\server"
npm start
```

**Expected output:**
```
Server running on port 5001
Database opened successfully
```

### Start Frontend Server

**Terminal 2**:
```bash
cd "c:\Users\vaish\Downloads\cotton mills\tce-mills-main - copy backup\client"
npm run dev
```

**Expected output:**
```
VITE ready in XXX ms
Local: http://localhost:5173/
```

---

## 📱 ACCESS THE APPLICATION

Once both servers are running:

1. **URL**: http://localhost:5173
2. **Login Credentials**:
   - **Manager**: username: `manager`, password: `manager`
   - **Chairman**: username: `chairman`, password: `chairman`

---

## ✅ VERIFICATION CHECKLIST

- [ ] Servers are running (check with `netstat -ano | findstr "5173 5001"`)
- [ ] Browser opened to `http://localhost:5173`
- [ ] Login page displays correctly
- [ ] Thiagarajar Mills logo is visible
- [ ] Can enter username and password
- [ ] Can click "Sign In" button

---

## 📞 WHAT TO REPORT IF STILL NOT WORKING

Please provide:

1. **What you see on screen** (describe or screenshot)
2. **Browser console errors** (F12 → Console tab → red errors)
3. **Network tab status** (F12 → Network tab → failed requests in red)
4. **Server terminal output** (any errors in terminal windows)

This will help diagnose the exact issue!
