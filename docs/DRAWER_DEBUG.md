# Cash Drawer Debug Guide

## What Changed
- ✅ Disabled print fallback on drawer button (testing only)
- ✅ Added detailed console logging to browser
- ✅ Added detailed server-side logging
- ✅ Created printer diagnostic script

## Step 1: Run Printer Diagnostic

```bash
node scripts/check-printer.js
```

This will:
1. List all Windows printers
2. Search for EPSON TM-T88V
3. Test drawer command directly
4. Tell you the exact printer name to use

**Expected Output:**
```
🔍 PRINTER DIAGNOSTIC TOOL

📋 Available Printers:
Total printers found: 1

1. EPSON TM-T88V Receipt (1)

🔎 Searching for Epson TM-T88V:
✓ Found: "EPSON TM-T88V Receipt (1)"

🧪 Testing Drawer Command:
Using printer: "EPSON TM-T88V Receipt (1)"
Sending ESC/POS command: [0x1B, 0x70, 0x00, 0x19, 0xFA]

✓ Drawer command sent successfully!

✅ PRINTER READY FOR POS SYSTEM

Update server.ts line ~1173 with:
  printer: "EPSON TM-T88V Receipt (1)",
```

## Step 2: Update Printer Name (if different)

If the diagnostic found a different printer name:

1. Open `server.ts`
2. Find line ~1173 (search for `EPSON`)
3. Replace printer name:
   ```typescript
   const printerName = "YOUR-PRINTER-NAME-HERE";
   ```
4. Save and restart: `npm run dev`

## Step 3: Start Dev Server

```bash
npm run dev
```

**Expected:**
```
Server running on http://0.0.0.0:3000
🔵 [DRAWER] POST /api/open-drawer ready
```

## Step 4: Test Drawer in POS

1. Open browser: `http://localhost:3173/pos`
2. Enter PIN (if required)
3. Open Developer Console: `F12` or `Ctrl+Shift+I`
4. Click "Drawer" button
5. **Watch console for logs**

## Expected Console Output

### ✅ SUCCESS

**Browser Console:**
```
🔄 Attempting to open drawer via backend...
📨 Response status: 200
📦 Response data: {success: true, message: "Cash drawer opened"}
✓ Cash drawer opened successfully!
```

**Server Console:**
```
🔵 [DRAWER] POST /api/open-drawer called
🔵 [DRAWER] ESC/POS command prepared: <Buffer 1b 70 00 19 fa>
🔵 [DRAWER] Attempting to use printer: EPSON TM-T88V Receipt (1)
✓ [DRAWER] Drawer command sent successfully
```

### ❌ PRINTER NOT FOUND

**Server Console:**
```
🔵 [DRAWER] POST /api/open-drawer called
🔵 [DRAWER] ESC/POS command prepared: <Buffer 1b 70 00 19 fa>
🔵 [DRAWER] Attempting to use printer: EPSON TM-T88V Receipt (1)
❌ [DRAWER] Printer error: Printer not found
```

**Solution:**
1. Run diagnostic: `node scripts/check-printer.js`
2. Copy exact printer name
3. Update `server.ts` line ~1173
4. Restart dev server

### ❌ USB NOT CONNECTED

**Server Console:**
```
❌ [DRAWER] Printer error: Access denied
```

**Solution:**
1. Check USB cable connected to printer
2. Power on printer
3. Run diagnostic: `node scripts/check-printer.js`
4. Try drawer again

## Logging Details

### Browser Console (F12 → Console tab)
```javascript
// Each drawer attempt shows:
🔄 Attempting to open drawer via backend...          // Starting
📨 Response status: 200                               // HTTP status
📦 Response data: {...}                               // Backend response
✓ Cash drawer opened successfully!                    // Success or ❌ error
```

### Server Console (Terminal where npm run dev runs)
```
🔵 [DRAWER] POST /api/open-drawer called            // Request received
🔵 [DRAWER] ESC/POS command prepared: <Buffer ...>  // Command built
🔵 [DRAWER] Attempting to use printer: ...           // Printer name
✓ [DRAWER] Drawer command sent successfully         // Success or ❌ error
```

## Debugging Checklist

- [ ] Printer is connected via USB
- [ ] Printer is powered on
- [ ] Windows driver is installed (Control Panel → Devices and Printers)
- [ ] Diagnostic runs successfully: `node scripts/check-printer.js`
- [ ] Printer name matches in `server.ts` line ~1173
- [ ] Dev server is running: `npm run dev`
- [ ] Console shows request and response
- [ ] No print dialog appears (fallback disabled)

## If Drawer Still Doesn't Open

### Check Windows Printer Settings

1. Control Panel → Devices and Printers
2. Right-click EPSON TM-T88V → Properties
3. Check:
   - Status: "Ready" (green checkmark)
   - No error messages
   - Driver version is current

### Reinstall Driver

1. Download from: https://epson.com/Support
2. Uninstall current driver
3. Restart Windows
4. Install fresh driver
5. Run diagnostic: `node scripts/check-printer.js`

### Test Print from Windows

1. Right-click printer → Print test page
2. Should print text on receipt paper
3. Confirms driver is working
4. Confirms paper is loaded

### Check USB Connection

1. Unplug USB and wait 5 seconds
2. Plug back in
3. Windows should detect it
4. Run diagnostic: `node scripts/check-printer.js`

## What NOT to Do

- ❌ Don't close browser console (you need logs)
- ❌ Don't use print fallback for testing (disabled on purpose)
- ❌ Don't manually print while testing drawer
- ❌ Don't unplug printer during test

## Notes

- **Fallback is DISABLED for testing** - if drawer fails, nothing happens (on purpose)
- **This will be re-enabled** after we verify the backend works
- **Console logs are your friend** - read them carefully
- **Server console is more important** - shows actual printer errors

## Next Steps

1. Run diagnostic script
2. Copy exact printer name
3. Update server.ts if needed
4. Start dev server
5. Test drawer and watch console
6. Share the console output (both browser and server)
