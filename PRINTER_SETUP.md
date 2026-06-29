# Epson TM-T88V Printer Setup - Cash Drawer Configuration

## Summary
The POS system now uses **zero-space ghost canvas printing** to trigger cash drawer opening. The print job is completely invisible (zero height, zero font size, transparent), and the Epson driver's built-in "Start of Document" feature opens the drawer when any print job starts.

## Prerequisites
- Epson TM-T88V thermal printer connected and installed
- Windows printer driver installed (EPSON TM-T88V Receipt Printer)
- Epson Printer Utility (typically installed with printer drivers)

## Configuration Steps

### Option 1: Using Windows Settings (Easiest)

1. **Open Printer Settings**
   - Go to: **Settings** → **Devices** → **Printers & scanners**
   - Find **EPSON TM-T88V Receipt Printer** in the list
   - Click on it, then click **Printer properties**

2. **Access Printer Properties**
   - A new window should open with printer settings
   - Look for tabs like: **General**, **Device Settings**, **Advanced**, **Ports**, etc.

3. **Find Cash Drawer Settings**
   - Look for a tab labeled:
     - **Device Settings** (most common)
     - **Peripherals**
     - **Hardware** 
     - **Optional Features**
   - Click on it

4. **Configure Drawer Behavior**
   - Find the setting: **"Cash Drawer"** or **"Drawer Kick"** or **"Start of Document"**
   - Change the dropdown to **"OPEN"** or **"Open on Start"**
   - This enables drawer opening when ANY print job starts

5. **Apply Changes**
   - Click **OK** or **Apply**
   - The settings should be saved to the printer

### Option 2: Using Epson Printer Utility

1. **Open Epson Printer Utility**
   - Search for **"Epson Printer Utility"** in Windows Start menu
   - Or: **Control Panel** → **Devices and Printers** → Right-click **EPSON TM-T88V** → **Printer properties**

2. **Navigate to Device Settings**
   - Look for **"Device Settings"** tab
   - Scroll down to find **"Peripherals"** or **"Drawer Kick"** section

3. **Set to "OPEN"**
   - Under **"Drawer Kick"** or **"Peripherals"**:
     - Set **"Start of Document"** to **"OPEN"**
     - Or find **"Drawer Kick"** and set it to **"On"** or **"Yes"**

4. **Save Configuration**
   - Click **OK** to close and save

### Option 3: Using Control Panel (Advanced)

1. **Control Panel** → **Devices and Printers**
2. Right-click **EPSON TM-T88V** → **Printer properties** (or **Preferences**)
3. Click **"Advanced"** (may need to look for a button or link)
4. Find **"Drawer Kick"** or **"Peripherals"** setting
5. Set to **"OPEN"** or **"Yes"**
6. Click **OK** and **Apply**

## How It Works

### Zero-Space Ghost Canvas Method
- The POS system creates an **invisible print document** with:
  - Zero height body (`height: 0px`)
  - Zero font size (`font-size: 0px`)
  - Transparent background
  - No visible content
- When the print job is sent to the printer:
  - The Epson driver detects "Start of Document"
  - The drawer opens immediately (via driver setting)
  - No paper feeds (document is completely invisible)
  - Print job completes with no output

### Why Use "Start of Document" = "OPEN"
- The zero-space print job triggers the printer's drawer kick at document start
- No special characters or fonts needed
- Works with any printer that supports ESC/POS drawer commands
- Completely invisible and uses zero paper

## Verification

After configuring the driver:

1. **Test Drawer Open Button**
   - Open POS system
   - Click the **"Open Drawer"** button
   - The **drawer SHOULD open** immediately

2. **Test Receipt Printing**
   - Scan a product and print a receipt
   - The **drawer WILL open** at start of document (expected behavior with this configuration)

3. **Expected Behavior**
   - ✅ Click "Open Drawer" → drawer opens immediately
   - ✅ Receipts print with drawer opening → both happen
   - ✅ Zero paper feed for drawer (invisible print job)
   - ✅ Minimal paper use (drawer opening doesn't waste paper)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Drawer not opening when clicking button | Check driver setting is set to "OPEN"; restart print spooler (`Services` → `Print Spooler` → Restart) |
| Drawer opens AND receipt prints fine | Correct behavior - drawer opens at start of any document |
| Blank lines before receipt | Normal - driver opens drawer at document start before content |
| "OPEN" option not found | Check for **"Peripherals"** or **"Hardware"** tab instead of **"Device Settings"** |
| Can't find printer settings | Download latest driver from Epson support website |
| Drawer opens too early or late | Check printer firmware version matches driver version |

## Files Modified
- `src/pages/POSPage.tsx` - `openCashDrawer()` function updated with zero-space ghost canvas solution

## References
- Epson TM-T88V Manual: Check sections on "Peripherals" and "Cash Drawer"
- ESC/POS Drawer Control: Uses printer's native "Start of Document" drawer kick
- Browser Print API: Used via `window.print()` to send invisible document to printer
- Ghost Canvas Technique: Zero-height, zero-font-size, transparent body element
