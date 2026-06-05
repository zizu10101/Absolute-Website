# Cash Change Calculator - Feature Documentation

**Date:** June 2024  
**Status:** ✅ Complete and tested  
**Build Status:** ✅ Passes TypeScript compilation

---

## Overview

Added a professional cash change calculator to the POS checkout flow. When cashiers select "Cash" as the payment method, they can:

1. **Enter the amount tendered** via keyboard or preset buttons
2. **See change automatically calculated** in real-time
3. **Complete the sale** with tendered amount and change recorded
4. **Print receipts** showing cash tendered and change due

---

## Features

### 1. **Amount Tendered Input**
- Large input field (18pt font) for easy visibility at the counter
- Accepts manual keyboard entry
- Clears when modal opens for fresh entry
- Supports decimal amounts

### 2. **Quick Preset Buttons**
Six quick-select buttons for common amounts:
- **Exact** — Pay exactly the total amount
- **+$5** — Next $5 increment above total
- **+$10** — Next $10 increment above total
- **+$20** — Next $20 increment above total
- **+$50** — Next $50 increment above total
- **+$100** — Next $100 increment above total

**Example:** If total is $23.50, buttons show: Exact ($23.50), +$5 ($25), +$10 ($30), +$20 ($40), +$50 ($50), +$100 ($100)

### 3. **Real-Time Change Calculation**
- **Change Due** (green) — displays when amount ≥ total
- **Amount Short** (red) — displays when amount < total
- Large font (24pt) for easy visibility
- Updates as cashier types or clicks preset buttons

### 4. **Validation & Safety**
- "Complete Sale" button **disabled** until valid amount entered
- Button only enables when tendered amount ≥ total
- Prevents incomplete transactions
- Shows spinner during processing

### 5. **Receipts with Cash Info**
Receipts now include:
- "Cash Received: $X.XX"
- "Change Due: $X.XX" (in green)
- Prints on thermal receipt
- Available for historical reference

---

## How It Works

### Checkout Flow for Cash Payments

1. **Cashier clicks "Cash" button** in payment methods
2. **Cash Calculator modal opens**
   - Shows total due at top
   - Input field ready for amount (auto-focused)
3. **Cashier enters tendered amount**
   - Via keyboard: type the amount directly
   - Via presets: click a button (Exact, +$5, +$10, etc.)
4. **Change calculated automatically**
   - If amount ≥ total: shows "Change Due: $X.XX" in green
   - If amount < total: shows "Amount Short: $X.XX" in red
5. **Cashier clicks "Complete Sale"**
   - Button disabled until valid amount
   - Processes transaction with tendered amount and change
   - Saves to database with `tendered_amount` and `change_given`
   - Shows receipt with cash information
6. **Receipt shows:**
   - Total Due
   - Cash Received
   - Change Due
   - All line items and calculations

### Other Payment Methods

**Card payments** (Debit, Visa, Mastercard, Amex):
- No change calculator needed
- Process immediately when clicked
- No `tendered_amount` or `change_given` stored

**Gift Card & Store Credit**:
- No change calculator
- Process like card payments

---

## Database Changes

### New Columns in `transactions` Table

```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tendered_amount NUMERIC(10, 2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS change_given NUMERIC(10, 2);
```

### Data Model

```sql
-- Example cash transaction
{
  id: "txn-12345",
  payment_method: "Cash",
  total_amount: 23.50,
  tendered_amount: 50.00,      -- NEW: Amount cashier received
  change_given: 26.50,           -- NEW: Change owed to customer
  status: "completed",
  created_at: "2024-06-10T14:32:00Z"
}

-- Example card transaction (no cash columns used)
{
  id: "txn-12346",
  payment_method: "Visa",
  total_amount: 45.99,
  tendered_amount: NULL,       -- Not used for card
  change_given: NULL,           -- Not used for card
  status: "completed",
  created_at: "2024-06-10T14:35:00Z"
}
```

---

## Setup Instructions

### 1. **Run Database Migration**

In Supabase SQL Editor, run:
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS tendered_amount NUMERIC(10, 2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS change_given NUMERIC(10, 2);
```

Or use the provided SQL file:
```bash
cat CASH_CHANGE_CALCULATOR_SETUP.sql | # In Supabase dashboard SQL editor
```

### 2. **Verify Columns Were Added**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND column_name IN ('tendered_amount', 'change_given');
```

Should return two rows with `numeric` data type.

### 3. **Restart Dev Server**

```bash
npm run dev
```

Changes will be live immediately (no new build needed for frontend).

---

## Code Changes

### Files Modified

| File | Changes |
|------|---------|
| `src/components/PosRegister.tsx` | Added cash calculator modal, state management, payment processing |
| Database | Added `tendered_amount` and `change_given` columns |

### Key Implementation Details

#### State Variables Added
```typescript
const [showCashCalculator, setShowCashCalculator] = useState(false);
const [cashTendered, setCashTendered] = useState<number | ''>('');
const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(null);
```

#### Receipt Interface Updated
```typescript
interface Receipt {
  // ... existing fields ...
  tenderedAmount?: number;
  changeGiven?: number;
}
```

#### New Function: `processPayment()`
- Extracted from original `handleConfirmSale()`
- Handles both cash and non-cash payments
- Accepts optional `tenderedAmount` and `changeGiven` parameters
- Saves these to transaction payload for cash payments

#### Updated Function: `handleConfirmSale()`
- Checks if payment method is "Cash"
- If cash: opens calculator modal instead of processing immediately
- If non-cash: calls `processPayment()` directly
- Awaits user input for cash before processing

---

## User Experience

### For Cashiers

**Traditional Card Payment:**
1. Click "Visa" button
2. Sale processes immediately
3. Receipt shows card transaction
4. Simple and fast

**Cash Payment (New):**
1. Click "Cash" button
2. Calculator modal opens with total visible
3. Enter amount received (keyboard or presets)
4. See change calculated automatically
5. Click "Complete Sale" when ready
6. Receipt shows cash tendered and change due
7. Professional and transparent

### For Customers

**Receipt Improvements:**
- See amount cash received
- See change due clearly printed
- Can verify transaction accuracy
- Professional appearance for physical receipt

---

## Testing Checklist

- [x] TypeScript compilation passes
- [x] Cash calculator modal appears when "Cash" clicked
- [x] Input field auto-focuses
- [x] Preset buttons calculate correct amounts
- [x] Change/shortage calculates correctly
- [x] Complete button disabled until valid amount
- [x] Complete button enabled with valid amount
- [x] Transaction saves with tendered_amount and change_given
- [x] Receipt displays cash information
- [x] Non-cash payments unaffected
- [x] Receipt prints correctly with cash details
- [x] Multiple transactions work correctly

---

## Edge Cases Handled

✅ **Exact Amount Payment** — Shows "Change Due: $0.00"
✅ **Over-Payment** — Shows correct change amount
✅ **Decimal Amounts** — Handles cents correctly
✅ **Fast Payments** — Exact change button for quick sales
✅ **Large Amounts** — No upper limit on tendered amount
✅ **Modal Close** — Properly resets state
✅ **Multiple Transactions** — Cash state clears between sales
✅ **Cancelled Transactions** — Cancel button closes without saving

---

## Preset Button Logic

Preset buttons automatically calculate the next increment above the total:

```javascript
{
  label: '+$5',
  amount: Math.ceil(grandTotal / 5) * 5
}
```

**Examples:**
- Total $12.50 → +$5 = $15
- Total $14.99 → +$5 = $15
- Total $15.00 → +$5 = $15 (exact same level)
- Total $20.01 → +$5 = $25
- Total $48.99 → +$10 = $50
- Total $50.00 → +$10 = $50 (exact same level)

---

## Future Enhancements

### Optional Additions
1. **Number Pad UI** — On-screen numpad for tablet/kiosk mode (tappable buttons)
2. **Voice Announcement** — Audio cue for change amount (accessibility)
3. **Cash Drawer Integration** — Auto-open cash drawer on receipt
4. **Tip Processing** — Add tip line during cash payment
5. **Refund Handling** — Cash refunds show on transaction
6. **Statistical Reports** — Track cash vs card payments
7. **Denomination Breakdown** — Show cash breakdown ($20s, $10s, $5s, $1s)

### Potential Improvements
- Remember last tendered amount per customer
- Suggest standard amounts based on historical patterns
- Add "Manual Entry" mode for special amounts
- Integrate with receipt printer for thermal formatting

---

## FAQ

### Q: Can customers pay less than total with cash?
**A:** No. The "Complete Sale" button is disabled until tendered amount ≥ total. This prevents accepting insufficient payment.

### Q: What if cashier enters 0?
**A:** Shows "Amount Short" in red. Button remains disabled. Safe error handling.

### Q: Does this affect card payments?
**A:** No. Card payments (Visa, Mastercard, etc.) process immediately without the calculator, unchanged from before.

### Q: Are old transactions affected?
**A:** No. The new columns are nullable, so existing transactions work fine. New cash transactions populate these fields.

### Q: What about gift cards?
**A:** Gift cards process like card payments. No change calculator needed. They're prepaid.

### Q: Can the modal be cancelled?
**A:** Yes. Click "Cancel" button to close the calculator and return to checkout without processing the sale.

### Q: Is change printed on receipts?
**A:** Yes. Receipts show:
- Total Due
- Cash Received
- Change Due (in green)
All in the totals section.

---

## Troubleshooting

### Cash Calculator Not Appearing
- Verify database migration ran (check columns exist)
- Restart dev server: `npm run dev`
- Check browser console for errors

### Preset Buttons Not Calculating Correctly
- Verify math: should be `Math.ceil(grandTotal / increment) * increment`
- Check that `grandTotal` is properly calculated with discounts and tax

### Change Not Saving to Database
- Verify `tendered_amount` and `change_given` columns exist
- Check Supabase RLS policies allow writes
- Look at browser console network tab for API errors

### Receipt Not Showing Cash Info
- Verify `receipt` object has `tenderedAmount` and `changeGiven` fields
- Check that `processPayment()` is passing these values to `setReceipt()`

---

## Performance Notes

✅ **Modal Performance**
- Lightweight modal with simple input
- No expensive calculations
- Smooth animations with Framer Motion
- No performance impact on POS system

✅ **Database**
- Simple NUMERIC columns
- No additional indexes needed
- No data migration overhead

✅ **UX**
- Auto-focus on input for fast entry
- Real-time calculations (no debounce needed)
- Responsive button clicks
- Fast transaction processing

---

## Security Notes

✅ **No Security Issues**
- All calculations client-side (safe)
- Tendered amount just a number (no risk)
- Change is calculated, not user-input (verified)
- Standard numeric validation
- RLS still enforces data access control

---

**Version:** 1.0  
**Status:** ✅ Production Ready  
**Last Updated:** June 2024
