# QZ Tray Integration Setup Guide

## Overview
QZ Tray enables silent thermal printing directly to Epson TM-T88IV without showing browser print dialogs. This requires:
1. QZ Tray desktop application (running on user's machine)
2. JavaScript library (`qz-tray` npm package) - ✅ Already installed
3. Exact printer name matching Windows settings

## Installation Status
- ✅ `npm install qz-tray` completed
- ✅ `src/utils/qzPrint.ts` created with functions:
  - `connectQZ()` - Connect to QZ Tray websocket
  - `getPrinterList()` - Get available printers
  - `printReceipt()` - Print single receipt
  - `printWithCut()` - Print with auto-cut command
  - `printDualCopyWithCut()` - Print 2 copies with auto-cut between

## Required: Find Exact Printer Name

### Step 1: Get Printer Name from Windows

1. Open **Settings** → **Devices** → **Printers & scanners**
2. Find your Epson printer in the list
3. **Copy the exact name** shown (e.g., "EPSON TM-T88IV", "EPSON TM-T88IV Receipt Printer", etc.)
4. Provide this name to use in the code

### Step 2: Download QZ Tray Application

QZ Tray is a local service that runs on user's machine. Users will need to:

1. Download from: https://qz.io/download
2. Choose "QZ Tray" (the main application)
3. Install and run on Windows
4. Allow through Windows Firewall when prompted
5. QZ Tray runs in system tray on localhost:8383

**Note:** This is required on each machine that will print silently. Operators will need to have QZ Tray running.

## Next Steps

### 1. Get the Printer Name
Tell me the exact printer name from Windows Settings, then I will:
- Update `src/utils/qzPrint.ts` with the correct printer name
- Create environment variable for printer name
- Update PosRegister.tsx to use QZ Tray

### 2. Update PosRegister.tsx
Replace `window.open()` print with QZ Tray functions:
```typescript
import { printDualCopyWithCut } from '../utils/qzPrint'

const handlePrint = async (copies: number) => {
  try {
    const html = copies === 2 
      ? generateDualCopyReceiptHTML(...)
      : generateThermalReceiptHTML(...)
    
    const success = await printDualCopyWithCut(html, 'EXACT_PRINTER_NAME')
    
    if (!success) {
      // Fallback to browser print if QZ Tray fails
      console.warn('QZ Tray failed, falling back to browser print')
      window.open('', '_blank', 'width=300,height=600')
      // ... browser print logic
    }
  } catch (error) {
    console.error('Print error:', error)
    // Fallback to browser print
  }
}
```

### 3. Testing
1. Install QZ Tray application on Windows
2. Run QZ Tray (should appear in system tray)
3. Test print from POS system
4. Verify silent printing (no dialog)
5. Verify 2-copy auto-cut works

## How QZ Tray Works

```
Browser calls printDualCopyWithCut(html, printerName)
         ↓
JavaScript library connects to QZ Tray (localhost:8383)
         ↓
QZ Tray service communicates with Windows printer drivers
         ↓
Epson TM-T88IV receives print job directly
         ↓
Receipt prints silently with auto-cut
         ↓
No browser dialog needed!
```

## Architecture

### Current Files
- `src/utils/qzPrint.ts` - QZ Tray utility functions
- `src/pages/POSPage.tsx` - Main POS (uses window.open)
- `src/components/PosRegister.tsx` - Register component (will be updated)

### Will Update
- `src/components/PosRegister.tsx` - Replace window.open with QZ Tray
- `src/pages/POSPage.tsx` - Replace window.open with QZ Tray
- `src/components/PosTransactionHistory.tsx` - Replace window.open with QZ Tray
- `src/components/GiftReceiptModal.tsx` - Replace window.open with QZ Tray

### Fallback Logic
If QZ Tray is not available or fails:
1. Try QZ Tray print
2. If fails, log warning
3. Fall back to browser print (window.open with dialog)
4. User can still print but with dialog

## Advantages Over Browser Print

| Feature | Browser Print | QZ Tray |
|---------|---------------|---------|
| Silent Printing | ❌ Always shows dialog | ✅ No dialog |
| Auto-Cut | ⚠️ Via CSS (unreliable) | ✅ ESC/POS commands |
| Default Printer | ❌ Shows selection | ✅ Direct to printer |
| Control | Limited | ✅ Full ESC/POS control |
| Installation | None | ⚠️ Requires app |

## QZ Tray Features Used

1. **HTML Printing** - Sends receipt HTML directly
2. **Raw ESC/POS Commands** - Auto-cut and other printer features
3. **Margin Control** - Ensures no wasted paper (0mm margins)
4. **Paper Width** - Set to 80mm (Epson TM-T88IV standard)

## Security Notes

- QZ Tray requires user approval when app is first launched
- All printing stays local (no cloud)
- Users fully control their printer
- Only works on machines where QZ Tray is installed

## Environment Variables (Optional)

Could add to `.env`:
```
VITE_PRINTER_NAME=EPSON TM-T88IV
VITE_USE_QZ_TRAY=true
```

Then update code to read from environment:
```typescript
const printerName = import.meta.env.VITE_PRINTER_NAME || 'EPSON TM-T88IV'
```

## Testing Checklist

- [ ] QZ Tray application installed on Windows
- [ ] QZ Tray running in system tray
- [ ] Exact printer name obtained from Windows Settings
- [ ] `printDualCopyWithCut()` called on print action
- [ ] No browser print dialog appears
- [ ] Receipt prints successfully
- [ ] Auto-cut works between copies
- [ ] Fallback to browser print works if QZ Tray unavailable
