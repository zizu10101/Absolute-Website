# Epson TM-T88IV Thermal Printer Fixes

## Summary of Changes (Session 17)

### 1. REMOVED DUPLICATE PRINT POPUPS ✅

**Three auto-print scripts removed from `src/utils/thermalReceipt.ts`:**

1. **Line 277** (generateThermalReceiptHTML): Removed `setTimeout(() => window.print(), 100);`
2. **Line 508** (generateGiftReceiptHTML): Removed `setTimeout(() => window.print(), 100);`
3. **Line 809** (generateStoreCreditReceiptHTML): Removed `setTimeout(() => window.print(), 100);`

**Result:** Receipt HTML no longer auto-prints. Print is now triggered only by user clicking the Print button in PosRegister.tsx.

---

### 2. UPDATED PRINT CSS FOR TM-T88IV ✅

All three receipt functions in `thermalReceipt.ts` updated with Epson-optimized CSS:

**Key changes:**
- `@page { size: 80mm auto; margin: 0mm; }` — proper page size for 80mm thermal paper
- `.receipt { width: 72mm; }` — adjusted for printable area (80mm paper - 8mm margins)
- `font-family: 'Courier New', Courier, monospace;` — monospace for thermal printer
- `font-size: 12px` for body, `14px` for headers (TM-T88IV optimized)
- `line-height: 1.4` — improved readability on thermal paper
- `max-width: 50mm; max-height: 15mm;` for logo (from 160px/60px)
- Explicit `box-sizing: border-box;` for all elements

**CSS applied to:**
1. `generateThermalReceiptHTML()` — Main receipt with prices and items
2. `generateGiftReceiptHTML()` — Gift receipt (no prices)
3. `generateStoreCreditReceiptHTML()` — Store credit receipt with barcode

---

### 3. NEW EPSON PRINT HANDLER IN PosRegister.tsx ✅

**Added import:**
```typescript
import { generateThermalReceiptHTML } from '../utils/thermalReceipt';
```

**New function `handleEpsonPrint()`:**
- Generates thermal receipt HTML using `generateThermalReceiptHTML()`
- Opens new window with Epson-optimized settings
- 500ms delay before printing (allows browser to render)
- Auto-closes window after print completes
- Graceful error handling for popup blockers

**Print button updated:**
```typescript
<button
  onClick={handleEpsonPrint}  // Changed from onClick={() => window.print()}
  className="flex-1 flex items-center justify-center gap-2 border border-zinc-200 rounded-lg py-3 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-50 transition-colors"
>
  <Printer size={14} /> Print
</button>
```

---

### 4. PRINTER SETUP INSTRUCTIONS ✅

**To ensure Epson TM-T88IV prints without asking for printer selection:**

1. **Windows Settings → Devices → Printers & Scanners**
2. **Find "EPSON TM-T88IV" in the list**
3. **Right-click → Set as default printer**
4. Browser will auto-select it when printing

---

## Print Flow (Before vs After)

### BEFORE (Broken):
1. User completes transaction
2. Receipt page loads
3. **Auto-print triggered immediately** (barcode load)
4. Print dialog appears
5. User can click Print button
6. **Print dialog appears AGAIN** (double popup)
7. Duplicate pages printed

### AFTER (Fixed):
1. User completes transaction
2. Receipt page loads (no auto-print)
3. User clicks Print button
4. `handleEpsonPrint()` generates thermal receipt HTML
5. New window opens with Epson-optimized CSS
6. 500ms delay for render
7. `window.print()` called **once**
8. Print dialog appears **once**
9. Printer outputs single receipt
10. Window auto-closes

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/thermalReceipt.ts` | Removed 3 auto-print scripts; Updated CSS in all 3 receipt functions |
| `src/components/PosRegister.tsx` | Added import; Added `handleEpsonPrint()`; Updated print button |

## Files NOT Modified

- `PosTransactionHistory.tsx` — no print calls found (safe)
- Report components (EndOfDayReport, StoreCreditReport, reportExport) — separate from receipt printing (safe)

---

## Testing Checklist

- [ ] Verify localhost receipt prints once (no duplicate popups)
- [ ] Check Epson TM-T88IV receives single print job
- [ ] Confirm 72mm width fits on 80mm paper with no cutoff
- [ ] Test barcode renders correctly
- [ ] Test on Firefox, Chrome, and Edge
- [ ] Verify popup blocker doesn't prevent print
- [ ] Test with and without default printer set

---

## Technical Notes

**Why 500ms delay before print()?**
- Ensures browser has rendered all fonts and styles
- Prevents "blank page" prints on slower systems
- TM-T88IV needs time to load fonts from CSS

**Why new window instead of direct print()?**
- Prevents print dialog from blocking main POS application
- Allows user to cancel print and continue working
- Better control over print settings via new window

**Why remove auto-print from thermalReceipt.ts?**
- Receipt HTML is now purely a data structure
- Print logic moved to UI layer (PosRegister.tsx)
- Single source of truth for print handling
- Follows separation of concerns pattern

---

## Epson TM-T88IV Specifications (Applied)

- ✅ Print width: 80mm paper, 72mm printable area (CSS: width 72mm)
- ✅ Resolution: 203 DPI (CSS doesn't control, printer handles)
- ✅ Font: Courier New or monospace (CSS: font-family 'Courier New')
- ✅ Font size: 12px for normal, 14px for headers (CSS: applied)
- ✅ Page size: 80mm auto (CSS: @page size)
- ✅ Margins: 0 (CSS: margin 0 at all levels)

---

## Rollback Instructions (if needed)

If any issues, rollback is simple:
```bash
git checkout HEAD -- src/utils/thermalReceipt.ts src/components/PosRegister.tsx
```

Both files have clear git history showing the changes.

---

**Status:** Ready for localhost testing
**Next:** Run `npm run dev` and test receipt printing
