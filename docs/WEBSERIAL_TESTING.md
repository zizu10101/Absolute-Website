# WebSerial API Testing Guide for Epson TM-T88V

## What Was Changed

### 1. **New ESC/POS Helper** (`src/utils/escpos.ts`)
- Native ESC/POS command constants for Epson printer control
- `EpsonPrinter` class for WebSerial communication
- Methods: `connect()`, `openDrawer()`, `cut()`, `printText()`, `disconnect()`
- Singleton instance exported as `printer`

### 2. **Updated POSPage.tsx**
- Imported `printer` from `src/utils/escpos.ts`
- Added printer connection state management (`printerConnected`, `printerError`)
- New `connectPrinter()` function to establish USB connection
- Updated `openCashDrawer()` to use WebSerial with fallback to print method
- Added printer status indicator in right panel with "Connect Printer" button
- Error handling and localStorage persistence

### 3. **index.html**
- Kept Epson ePOS SDK script tag (backward compatible, not used by WebSerial)

## How WebSerial Works

**WebSerial API** is a native browser API (Chrome/Edge) that allows direct USB communication:

1. **User clicks "Connect Printer"** → Browser shows USB port selector dialog
2. **User selects Epson TM-T88V** → Port opens at 115200 baud
3. **Browser remembers the port** → No dialog on next connection (same browser session)
4. **Click "Open Drawer"** → Sends ESC/POS drawer kick command directly via USB
5. **No paper feed** → Drawer-only command, receipt printing separate

## Prerequisites

### Browser Support
- ✅ Chrome/Chromium 89+
- ✅ Edge 89+
- ❌ Firefox (no WebSerial support)
- ❌ Safari (no WebSerial support)

### USB Setup
1. **Printer connected via USB** to POS computer
2. **Windows driver installed** (Epson auto-installs via Windows Update)
3. **No additional software required** (WebSerial is native)

### Site Security
- ✅ Localhost: Works immediately
- ✅ HTTPS sites: Works immediately
- ❌ HTTP (non-localhost): Blocked for security

## Testing Checklist

### Step 1: Connect Printer
```
1. Start: npm run dev
2. Navigate to: http://localhost:5173/pos
3. Enter PIN (if required)
4. Look for "Printer: Not Connected" status in right panel
5. Click "Connect Printer" button
6. Browser shows: "Select a port" dialog
7. Choose: "EPSON TM-T88V" (or similar)
8. Status changes to: "Printer: Connected" ✓ GREEN
```

### Step 2: Open Drawer
```
1. Click "Drawer" button in action row (right panel)
   - ✓ IDEAL: Drawer opens instantly, NO paper feed
   - If error: Check error message in red box
   - If fallback: Will use print method (slower)
```

### Step 3: Persistence
```
1. Refresh page (F5)
2. Printer status should remain: "Connected"
3. Click Drawer again - should work immediately
4. Storage key: localStorage.printerConnected = 'true'
```

### Step 4: Disconnect & Reconnect
```
1. Navigate away from /pos or close browser
2. Return to /pos
3. Status shows: "Not Connected"
4. Click "Connect Printer" again
5. Should connect without selecting port (remembers device)
```

## Error Messages & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Printer not connected" | No USB connection | Connect USB cable, click "Connect Printer" |
| "Port selector closed" | User clicked X | Click "Connect Printer" again |
| "Failed to connect" | Driver issue | Reinstall Windows Epson driver |
| "Drawer: Printer not connected" | Clicked drawer before connecting | Connect first, then drawer |
| "Drawer error" | Connection lost | Reconnect printer via button |

## Fallback Behavior

If WebSerial fails for ANY reason:
1. Drawer command → Print method (EpsonControl font)
2. User sees error message in red
3. Print dialog opens (slower but reliable)
4. Drawer still opens via printer driver

## Database / Persistence

- **localStorage key:** `printerConnected` (boolean)
- **State stored in:** React state + localStorage
- **Persists across:** Page reloads, NOT across browser restart

## Receipt Printing (Future)

Current implementation:
- ✅ Drawer kick: WebSerial (instant, native USB)
- ⏳ Receipt printing: Still via `window.print()` (HTML → printer driver)

To implement ESC/POS receipt printing:
1. Convert receipt HTML to ESC/POS byte commands
2. Use `printer.printText()` or create `printer.printReceipt()`
3. Add paper-cut commands after each receipt
4. Test alignment on 80mm thermal paper

## Code Overview

### File: `src/utils/escpos.ts`
```typescript
export const printer = new EpsonPrinter()

// Usage:
await printer.connect()     // Show USB selector
await printer.openDrawer()  // Send drawer kick
await printer.disconnect()  // Close port
```

### File: `src/pages/POSPage.tsx`
```typescript
const connectPrinter = async () => {
  const connected = await printer.connect()
  if (connected) localStorage.setItem('printerConnected', 'true')
}

const openCashDrawer = async () => {
  if (!printerConnected) return openCashDrawerFallback()
  await printer.openDrawer()
}
```

## Testing on Real Hardware

1. **Epson TM-T88V connected via USB**
2. **Windows 10/11 with latest Epson driver**
3. **Chrome/Edge browser**
4. **Click "Connect Printer"** → Select from port list
5. **Click "Drawer"** → Should open instantly

Expected results:
- ✓ Drawer opens with NO paper feed
- ✓ No print dialog appears
- ✓ Instant response (no delay)
- ✓ Connection persists across page reloads

## Known Limitations

1. **Chrome-only** (WebSerial API not in Firefox/Safari)
2. **Single printer** (connects to one port at a time)
3. **Localhost only** for testing (HTTPS required in production)
4. **Connection lost if printer powered off** (can reconnect)
5. **No access to printer status** (online/offline state)

## Next Steps

1. ✅ Test drawer kick on real hardware
2. ⏳ Implement ESC/POS receipt printing
3. ⏳ Add paper-cut commands between receipts
4. ⏳ Add connection status in receipt
5. ⏳ Handle connection loss gracefully

## Security Notes

- WebSerial API **requires user consent** via browser dialog
- Port selection is **per-domain** (different for localhost vs production)
- Browser **remembers port** but user can revoke access
- Connection is **direct USB**, bypasses printer driver
- No internet connection needed (USB only)

---

**Do NOT push to production until tested on real hardware.**
