# Customer Profile - Returns Integration

## ✅ What Was Added

Integrated the Returns system directly into the Customer Profile transaction history. Customers can now process returns right from their profile view without navigating to the POS.

---

## 📋 Changes Made

### 1. **ReturnsModal Enhanced** (`src/components/ReturnsModal.tsx`)

Added optional props for pre-filling and skipping the lookup step:

```typescript
interface ReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledTransactionId?: string;      // Pre-fill transaction ID
  prefilledCustomerId?: string;          // Pre-fill customer ID
  onComplete?: () => void;               // Callback after return completes
}
```

**Behavior:**
- If `prefilledTransactionId` is provided, modal starts at Step 2 (item selection)
- Lookup step (Step 1) is skipped
- Transaction auto-loads on modal open
- `onComplete` callback fires after return is processed

### 2. **PosCustomerManager Updated** (`src/components/PosCustomerManager.tsx`)

**New Imports:**
- `ReturnsModal` component
- `Undo2`, `ChevronDown`, `ChevronUp` icons
- `supabase` for querying return records

**New State:**
```typescript
const [showReturnsModal, setShowReturnsModal] = useState(false);
const [returnsTransactionId, setReturnsTransactionId] = useState<string | null>(null);
const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
const [returnRecords, setReturnRecords] = useState<Record<string, any>>({});
```

**New Functions:**
- `loadCustomerTransactions()` - Now loads return records for each transaction
- `openReturnsModal(txId)` - Opens returns modal with specific transaction
- `handleReturnsComplete()` - Refreshes customer data after return

**Updated Transaction History Display:**

1. **Expandable Transactions**
   - Click transaction row to expand/collapse
   - Shows additional details when expanded

2. **Status Badges**
   - `completed` → green "COMPLETED"
   - `voided` → red "VOIDED"
   - `refunded` → orange "REFUNDED"
   - `returned` → blue "RETURNED"
   - `partial_return` → purple "PARTIAL RETURN"

3. **Return Summary**
   - When expanded, shows return details if one exists:
     - Refund method (Store Credit / Original Payment)
     - Return amount
     - Return date
     - Number of items returned

4. **Return Button**
   - "Process Return" button appears when:
     - Transaction status is 'completed'
     - No return exists for the transaction
   - Opens ReturnsModal with transaction pre-filled
   - Customer stays on profile

---

## 🎯 User Workflow

### From Customer Profile:

1. **Open Customer Profile**
   - View customer details and stats
   - See Purchase History section at bottom

2. **View Transaction**
   - Completed transactions show status badge
   - Can click to expand and see more details

3. **Expand Transaction (Click Row)**
   - If transaction already has a return:
     - See return summary (method, amount, date)
   - If transaction is completed and no return:
     - See "Process Return" button

4. **Click Process Return**
   - ReturnsModal opens
   - Transaction ID pre-filled
   - Customer ID pre-filled (from profile context)
   - Item selection screen displays immediately
   - No need to scan/type invoice number

5. **Complete Return in Modal**
   - Select items to return
   - Choose refund method
   - Confirm and process
   - Receipt prints

6. **Return to Profile**
   - Modal closes
   - Customer transaction history auto-refreshes
   - Transaction shows new "RETURNED" status
   - Return summary appears when expanded

---

## 🔄 Data Flow

### On Return Completion:

1. **ReturnsModal** processes the return and calls `onComplete()`
2. **handleReturnsComplete()** fires, which calls `loadCustomerTransactions()`
3. **loadCustomerTransactions()** refreshes:
   - Customer transaction list
   - Return records for each transaction (via Supabase query)
4. UI updates to show:
   - New transaction status
   - Return summary in expanded view

---

## 📊 Transaction Status Flow

```
Customer makes purchase
         ↓
   COMPLETED ← Transaction saved
         ↓
   [Options: Void, Refund, Return]
         ↓
   RETURNED ← Return processed
   (shows return summary)
```

---

## 🎨 UI Components

### Transaction Row (Collapsed)
```
┌─ [Date] [Icon] ─────────────────────────┐
│ TXN ID · Payment Method                 │
│ N item(s)                    $XXX.XX    │
│                              [COMPLETED]│
└─────────────────────────────────────────┘
```

### Transaction Row (Expanded)
```
┌─ [Date] ▲ ──────────────────────────────┐
│ TXN ID · Payment Method                 │
│ N item(s)                    $XXX.XX    │
│                              [COMPLETED]│
├─────────────────────────────────────────┤
│ ┌─ Return Details (if exists) ────────┐ │
│ │ Refund: Store Credit                │ │
│ │ Amount: $XXX.XX                     │ │
│ │ Date: MM/DD/YYYY                    │ │
│ │ Items: 2 returned                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Process Return Button] (if no return) │
└─────────────────────────────────────────┘
```

---

## ✨ Features

✅ **Deep Linking**
- Transactions pre-fill with ID and customer
- No manual lookup needed
- Skip straight to item selection

✅ **Context Awareness**
- Modal knows which customer we're viewing
- Returns associated with that customer only
- Refresh happens automatically

✅ **Visual Feedback**
- Status badges show transaction state
- Return summary visible when expanded
- Clear button indication ("Process Return")

✅ **Seamless Integration**
- Reuses existing ReturnsModal
- No duplicate code
- Single source of truth for return logic

✅ **Auto-Refresh**
- After return completes, customer history updates
- New status and return details appear immediately
- No manual refresh needed

---

## 🔍 Return Record Lookup

When loading customer transactions, the system also queries return records:

```typescript
const { data: returnData } = await supabase
  .from('returns')
  .select('*')
  .eq('transaction_id', tx.id)
  .single();
```

This allows the UI to show:
- Whether a return exists for the transaction
- Return details (method, amount, date, items)
- Updated status badge

---

## 🎯 Edge Cases Handled

✅ **Already Returned**
- Return button only shows for `status === 'completed'` transactions without a return
- If return exists, show summary instead of button
- Prevents duplicate returns

✅ **Voided/Refunded Transactions**
- Return button hidden (status is not 'completed')
- Can't return already-voided or refunded transactions

✅ **No Transactions**
- Shows "No transactions yet" message
- Return button never appears

✅ **Return Query Fails**
- Gracefully handles if return lookup fails
- Still shows transaction, just no return summary
- Button still appears if applicable

---

## 🧪 Testing Checklist

- [ ] Open customer profile
- [ ] See transaction history
- [ ] Click to expand transaction
- [ ] Click "Process Return" button
- [ ] ReturnsModal opens with transaction pre-filled
- [ ] Item selection shows (Step 2)
- [ ] No lookup form visible (Step 1 skipped)
- [ ] Complete return in modal
- [ ] Return to profile
- [ ] Transaction shows "RETURNED" status
- [ ] Return summary appears when expanded
- [ ] Can't click "Process Return" again (button hidden)

---

## 📱 Responsive Behavior

- Transaction rows stack vertically on mobile
- Expand/collapse works on touch
- Return button full-width when expanded
- All text readable at small sizes

---

## 🔐 Security Notes

- ReturnsModal validates transaction exists and is completed
- Customer ID from profile context (can't be manipulated)
- Return records queried by transaction ID
- Supabase RLS policies still enforce access control

---

## 📈 Performance

- Return records loaded once per profile view
- Minimal additional queries (one per transaction)
- Expandable sections don't reload data
- Auto-refresh after return is efficient (standard pattern)

---

## 🚀 Deployment

No database changes needed. Works with existing:
- `returns` table
- `transactions` table
- RLS policies

Simply deploy updated components.

---

## 📝 Files Modified

1. **`src/components/ReturnsModal.tsx`**
   - Added optional props: prefilledTransactionId, prefilledCustomerId, onComplete
   - Auto-load transaction if ID provided
   - Skip Step 1 when prefilled
   - Call onComplete callback after return

2. **`src/components/PosCustomerManager.tsx`**
   - Import ReturnsModal, supabase, additional icons
   - Add state for returns modal and expanded transactions
   - Update loadCustomerTransactions to load return records
   - Add openReturnsModal and handleReturnsComplete functions
   - Update transaction history rendering:
     - Make expandable
     - Add return summary
     - Add process return button
     - Update status badges
   - Render ReturnsModal with proper props

---

## ✅ Integration Complete

The return processing system is now fully integrated into the customer profile experience. Staff can process returns directly from the customer view without navigating to the POS.

**All logic reuses existing ReturnsModal — no duplicate code!**
