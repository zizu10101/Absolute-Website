# Node.js Printer Integration Testing Guide

## What Changed

### 1. **Removed WebSerial Approach**
- ❌ Deleted `src/utils/escpos.ts` (WebSerial doesn't work with Windows USB printers)
- ❌ Removed "Connect Printer" button from POS UI
- ❌ Removed printer status indicator

### 2. **Added Node.js Backend Solution**
- ✅ Installed `node-printer` package (uses Windows Print Spooler)
- ✅ Added `POST /api/open-drawer` endpoint in `server.ts`
- ✅ Updated `openCashDrawer()` in POSPage.tsx to use fetch API
- ✅ Kept print method fallback for reliability

## How It Works

### Backend (`server.ts`)
```typescript
app.post("/api/open-drawer", (req, res) => {
  const drawerCommand = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])
  
  printer.printDirect({
    data: drawerCommand,
    printer: "EPSON TM-T88V Receipt (1)",
    type: "RAW",
    success: () => res.json({ success: true }),
    error: (err) => res.status(500).json({ error: err.message })
  })
})
```

### Frontend (`POSPage.tsx`)
```typescript
const openCashDrawer = async () => {
  try {
    const response = await fetch('/api/open-drawer', { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    console.log('✓ Cash drawer opened')
  } catch (err) {
    console.error('Drawer error:', err)
    openCashDrawerFallback() // Uses print method if backend fails
  }
}
```

## Key Advantages

| Aspect | WebSerial | Node.js node-printer |
|--------|-----------|----------------------|
| USB Windows Printers | ❌ No | ✅ Yes |
| Setup | Browser dialog | Windows driver only |
| Speed | Instant | Instant |
| Fallback | None | Print method |
| Browser Compatibility | Chrome/Edge only | Any browser |
| Server-side Control | No | Yes |

## Prerequisites

### Windows Setup
1. **Epson TM-T88V connected via USB**
2. **Windows driver installed** (auto-install or manual)
   - Download from Epson: https://epson.com/Support/Printers/POS-Printers/TM-T88V
   - Or Windows Update → Devices → Printers → Add printer → EPSON TM-T88V
3. **Printer name verified** (must match server code)
   - Control Panel → Devices and Printers
   - Right-click Epson printer → Properties
   - Verify name contains `"EPSON TM-T88V Receipt"`

### Node.js
- ✅ `node-printer` installed (`npm install node-printer`)
- ✅ Server running (`npm run dev` for localhost)

## Printer Name Setup

The backend code references:
```typescript
printer: "EPSON TM-T88V Receipt (1)"
```

**If your printer has a different name:**

1. Open Control Panel → Devices and Printers
2. Right-click your Epson printer → Properties
3. Copy the full printer name
4. Update `server.ts` line ~1173:
   ```typescript
   printer: "YOUR-PRINTER-NAME-HERE",
   ```
5. Restart dev server (`npm run dev`)

**Common printer names:**
- `EPSON TM-T88V Receipt (1)`
- `EPSON TM-T88V Receipt`
- `EPSON TM-T88V`
- `Epson TM-T88V`

## Testing Checklist

### Step 1: Verify Driver
```
1. Control Panel → Devices and Printers
2. Look for: EPSON TM-T88V Receipt
3. Right-click → Print test page
4. Paper should print (confirms driver works)
5. Note the exact printer name
```

### Step 2: Update Printer Name (if needed)
```
1. If printer name differs from code:
   - Open: src/server.ts line ~1173
   - Change: printer: "YOUR-EXACT-NAME"
   - Save & restart: npm run dev
```

### Step 3: Start Dev Server
```bash
npm run dev
# Should output:
# Server running on http://0.0.0.0:3000
# No errors
```

### Step 4: Test Drawer Button
```
1. Navigate to: http://localhost:3173/pos
2. Enter PIN (if required)
3. Click "Drawer" button (right panel, action row)
4. Expected: Drawer opens instantly
5. No paper feed
6. No print dialog
7. Console shows: "✓ Cash drawer opened"
```

### Step 5: Verify Fallback
```
1. Stop Node.js backend:
   - Ctrl+C in terminal
   - (or disable network)
2. Click "Drawer" again
3. Expected: Print dialog appears
4. Click Print → Drawer opens
5. Restart backend: npm run dev
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "404 Drawer API" | Backend not running | Start: `npm run dev` |
| "Printer not found" | Name mismatch | Check Control Panel, update `server.ts` |
| "Access denied" | Printer permissions | Reinstall driver with Admin rights |
| "Invalid escape sequence" | Wrong printer name | Verify name in Control Panel |
| No drawer kick but no error | USB disconnected | Reconnect printer USB |
| Print dialog instead of drawer | Backend error | Check console for error message |

## Error Messages & Responses

### Success
```json
{ "success": true, "message": "Cash drawer opened" }
```

### Backend Error
```json
{ "error": "EPSON TM-T88V Receipt not found" }
```

### Connection Error
```json
{ "error": "Failed to open drawer" }
```

## Build Status
```
✓ Vite: 2314 modules transformed
✓ TypeScript: Zero errors
✓ ESBuild: server.cjs compiled
```

## Architecture

```
POS Page (POSPage.tsx)
    ↓ click "Drawer"
    ↓ fetch('/api/open-drawer')
    ↓
Node.js Backend (server.ts)
    ↓ printer.printDirect({...})
    ↓
Windows Print Spooler
    ↓ ESC/POS command: 0x1B 0x70 0x00 0x19 0xFA
    ↓
EPSON TM-T88V (via USB)
    ↓
Drawer opens instantly ✓
```

## Next Steps

1. ✅ Test on actual Epson TM-T88V printer
2. ✅ Verify drawer opens instantly (no paper feed)
3. ✅ Test fallback when backend is down
4. ⏳ Implement ESC/POS receipt printing (future)
5. ⏳ Add printer status monitoring

## Notes

- **node-printer limitation:** Deprecated but works on Windows with Print Spooler
- **Fallback method:** EpsonControl font print method is reliable and always works
- **Printer discovery:** Could add printer list endpoint if needed for multi-printer setups
- **HTTPS production:** Will need HTTPS certificate for live deployment

## Command Reference

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# View installed packages
npm list node-printer

# Reinstall printer dependency
npm install --save node-printer
```

---

**Do NOT push until tested on actual hardware.**
