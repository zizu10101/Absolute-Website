# Gift Card Tab Implementation - Complete Guide

## Overview

The gift card feature has been redesigned with a dedicated **GC tab** in the POS system containing three integrated sub-tabs: **Sell**, **Redeem**, and **History**. This consolidates all gift card operations into a single organized interface.

---

## Architecture

### New Component: `GiftCardTab.tsx`

A comprehensive React component (900+ lines) that manages all three gift card operations:

```
GiftCardTab
├── TAB 1: SELL GIFT CARD
│   ├── Amount selection (presets + custom)
│   ├── Customer search/creation
│   ├── Card number (auto-generate or manual)
│   └── Issue button
│
├── TAB 2: REDEEM GIFT CARD
│   ├── Card number input (scan or type)
│   ├── Card lookup & balance display
│   ├── Amount input (partial redemption support)
│   ├── Real-time change calculation
│   └── Apply to Cart button
│
├── TAB 3: GC HISTORY
│   ├── Searchable table of all cards
│   ├── Status filters (All, Active, Depleted)
│   ├── Expandable transaction history
│   ├── Summary statistics
│   └── Per-card Redeem buttons
│
└── Redeem Modal (for history rows)
    ├── Card details display
    ├── Amount input
    └── Apply to Current Cart button
```

### Integration Points

**POSPage.tsx Changes:**
- Replaced `GiftCardModal` + `GiftCardRedeemModal` imports with single `GiftCardTab`
- Added `'gc'` tab to posTab state type: `'register' | 'history' | 'customers' | 'gc'`
- Removed `showGiftCardModal` and `showGiftCardRedeemModal` state variables
- Updated barcode scanner focus logic (removed !showGiftCardModal check)
- Added GC tab rendering block
- Added "Gift Cards" button to bottom tab bar
- Updated "Redeem Gift Card" button in checkout to switch to gc tab

---

## Features & Functionality

### 1. SELL GIFT CARD Tab

**Amount Selection**
- 4 preset buttons: $25, $50, $100, $150
- Custom amount input ($ input with decimal support)
- Real-time amount calculation shown in preview

**Customer Management**
- Optional customer linking
- Real-time customer search (debounced 300ms)
- Inline customer creation with name/phone/email
- "Create new customer instead" toggle for quick entry

**Card Number**
- Auto-generate toggle (default: enabled)
- Random 16-digit generation with preview button
- Manual entry option (16-char limit, uppercase, alphanumeric)

**Issuance**
- Preview section shows: amount, customer, card details
- Issue button disabled until valid amount selected
- Success notification with gift card added to cart
- Gift card items marked as non-taxable automatically

**Data Saved:**
- `gift_cards` table: card_number, initial_balance, current_balance, customer_id, is_active
- `gift_card_transactions` table: issue event with initial amount

---

### 2. REDEEM GIFT CARD Tab

**Card Lookup**
- Input field accepts scanned or typed card numbers
- 16-character limit, uppercase conversion
- Enter key triggers lookup
- "Look Up" button with loading state

**Card Display**
- Card number (formatted)
- Holder name (if linked to customer)
- Current balance in red (#b90014)
- Issue date

**Amount Selection**
- Dollar input with decimal support
- Min: $0, Max: card balance
- Default: minimum of cart total and card balance
- Real-time validation messages:
  - ✅ Green: "Full payment from gift card"
  - ⚠️ Amber: "Partial redemption: $X still due"
  - ❌ Red: "Exceeds card balance"

**Apply to Cart**
- Disabled if:
  - No items in cart
  - Amount > card balance
  - Amount ≤ 0
- Updates cart with redeemed amount
- Closes modal on success

**Error Handling**
- Card not found
- Card inactive
- Zero balance
- Invalid amounts

---

### 3. GC HISTORY Tab

**Table Display**
- Card number (monospace font)
- Customer name (linked customer or blank)
- Status badge: Active (green), Depleted (gray), Inactive (red)
- Current balance / Initial balance
- Issue date
- Chevron icon (expand/collapse)

**Search & Filter**
- Search input: searches card number + customer name (case-insensitive)
- Status filter buttons: All, Active, Depleted
  - "Active" = is_active AND balance > 0
  - "Depleted" = NOT is_active OR balance = 0
- Real-time filtering as you type

**Expandable Transaction History**
- Shows on row click or chevron click
- Transaction list with columns:
  - Type: issued, redeemed, refunded, top-up
  - Date/time: full timestamp
  - Amount: ± with color coding (positive = green, negative/deduction = dark)
- Max height 160px with scrollbar for many transactions

**Per-Card Actions**
- "Redeem This Card" button (visible if active and balance > 0)
- Opens redemption modal with card pre-selected
- Shows current balance
- Amount input with cart total awareness
- "Apply to Current Cart" button (disabled if no items in cart)

**Summary Section**
- Visible when cards exist
- Grid layout showing:
  - Total Cards: count
  - Issued: sum of all initial_balance
  - Remaining: sum of all current_balance
- Updated in real-time as history changes

**Refresh Functionality**
- Refresh button in header (icon only)
- Auto-fetches latest gift card data
- Preserves search/filter state
- Shows loading spinner while fetching

---

## State Management

### Sell Tab State
```typescript
amount: number                  // Selected preset amount
customAmount: string            // Custom $ input
selectedCustomer: Customer      // Linked customer object
searchTerm: string              // Customer search input
searchResults: Customer[]       // Search result list
isSearching: boolean            // Search loading state
isDropdownOpen: boolean         // Customer dropdown visibility
showCreateMode: boolean         // Toggle customer creation form
newCustomerName: string         // New customer name
newCustomerPhone: string        // New customer phone
newCustomerEmail: string        // New customer email
cardNumber: string              // Manual card number
autoGenerate: boolean           // Toggle auto-generation
isIssuing: boolean              // Issuance loading state
sellError: string | null        // Error message
```

### Redeem Tab State
```typescript
redeemCardNumber: string        // Card lookup input
redeemAmount: number            // Redemption amount
redeemCardData: any | null      // Lookup result
isRedeemLoading: boolean        // Lookup loading state
isRedeeming: boolean            // Redemption loading state
redeemError: string | null      // Error message
showRedeemModal: boolean        // History redeem modal visibility
selectedCardForRedeem: any      // Selected card for redemption
```

### History Tab State
```typescript
giftCards: GiftCard[]           // All gift cards
isHistoryLoading: boolean       // Fetch loading state
historySearchQuery: string      // Search input
statusFilter: 'all'|'active'|'depleted'  // Active filter
expandedCardId: string | null   // Currently expanded card
```

---

## Supabase Queries

### Fetch All Gift Cards with Transactions
```typescript
const { data, error } = await supabase
  .from('gift_cards')
  .select(`
    *,
    customers (first_name, last_name, email),
    gift_card_transactions (*)
  `)
  .order('created_at', { ascending: false });
```

### Issue Gift Card
```typescript
const { data: giftCard } = await supabase
  .from('gift_cards')
  .insert({
    card_number: generatedCardNumber,
    initial_balance: finalAmount,
    current_balance: finalAmount,
    customer_id: selectedCustomer?.id || null,
    is_active: true,
    created_at: new Date().toISOString(),
  })
  .select()
  .single();

// Record transaction
await supabase
  .from('gift_card_transactions')
  .insert({
    gift_card_id: giftCard.id,
    amount: finalAmount,
    transaction_type: 'issue',
    created_at: new Date().toISOString(),
  });
```

### Lookup Gift Card
```typescript
// Via API endpoint: /api/gift-cards/lookup?card_number=...
const res = await fetch(`/api/gift-cards/lookup?card_number=${encodeURIComponent(cardNumber)}`);
const result = await res.json();
// Returns: { data: { card_number, current_balance, customers, ... } }
```

### Redeem Gift Card
```typescript
// Via API endpoint: /api/gift-cards/redeem (POST)
const res = await fetch('/api/gift-cards/redeem', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    card_number: cardNumber,
    amount: redemptionAmount,
    transaction_id: null,
  }),
});
// Deducts from current_balance and records transaction
```

---

## User Interface Details

### Color Scheme (Brand Colors)
- Primary Red: `#b90014` (active states, buttons, highlights)
- Dark Background: `#1a2236`, `#0f1117` (register tab theme)
- Success: emerald green (active status badges)
- Warning: amber (partial redemption)
- Error: red (inactive status, errors)
- Neutral: zinc grays (text, borders, secondary states)

### Tab Header
- 3 buttons: "💳 Sell", "💰 Redeem", "📊 History"
- Active tab: red (#b90014) background
- Inactive: gray text
- Bottom border accent on active tab

### Responsive Design
- Full height component (flex: 1)
- Scrollable content area (overflow-y-auto)
- Mobile-friendly inputs and buttons
- Touch-optimized padding (3-4 units)

### Loading States
- Spinner animations on fetch/submit
- Disabled buttons during async operations
- Loading text: "Issuing...", "Redeeming...", "..."

### Error Handling
- Error banners with icon (AlertCircle)
- Context-specific messages
- Auto-clear on successful action (2s delay)
- Input validation feedback

---

## Integration with POS Cart

### Gift Card as Cart Item
When issued, gift card is added to cart with special properties:
```typescript
{
  id: `gc-${giftCard.id}`,
  name: `Gift Card - $${amount.toFixed(2)}`,
  price: amount,
  quantity: 1,
  category: 'Gift Card',
  type: 'gift_card',
  taxable: false,  // Critical: excludes from HST
  originalPrice: amount,
  giftCardData: giftCard,  // Metadata
}
```

### Redemption Integration
- Cart total used for default redemption amount
- Redeemed amount added to transaction payment
- Cart items shown when redeeming from history
- Warning if cart is empty

---

## Testing Checklist

### SELL Tab
- [ ] Click preset amounts ($25, $50, $100, $150)
- [ ] Enter custom amount
- [ ] Search for existing customer (debounced)
- [ ] Create new customer inline
- [ ] Remove selected customer
- [ ] Auto-generate card number
- [ ] Preview card number
- [ ] Enter manual card number (max 16 chars)
- [ ] Issue gift card (appears in cart)
- [ ] Verify gift card is non-taxable
- [ ] Test with no customer selected
- [ ] Test amount validation

### REDEEM Tab
- [ ] Scan/type valid card number
- [ ] Look up card (shows balance, customer)
- [ ] Enter redemption amount
- [ ] Verify full payment indicator (green)
- [ ] Verify partial redemption indicator (amber)
- [ ] Verify exceed balance indicator (red)
- [ ] Apply to cart (disabled if no items)
- [ ] Apply to cart with partial amount
- [ ] Try invalid card number
- [ ] Try inactive card
- [ ] Try depleted card
- [ ] Enter amount > balance
- [ ] Clear lookup and try again

### HISTORY Tab
- [ ] Scroll through all cards
- [ ] Search by card number
- [ ] Search by customer name
- [ ] Filter: All, Active, Depleted
- [ ] Expand card to show transactions
- [ ] Verify transaction details (type, date, amount)
- [ ] Click "Redeem This Card" on active card
- [ ] Redeem modal opens with card pre-selected
- [ ] Amount defaults to min(cart_total, card_balance)
- [ ] Apply redemption from modal
- [ ] Verify summary (total cards, issued, remaining)
- [ ] Refresh button updates data
- [ ] Expand/collapse works smoothly

### POS Integration
- [ ] GC button in register tab switches to gc tab
- [ ] Bottom tab bar includes "Gift Cards" button
- [ ] "Redeem Gift Card" button in checkout → opens gc/redeem
- [ ] Cart awareness (show total, disable if empty)
- [ ] Issued gift cards appear in cart
- [ ] Redeemed amount applies to payment
- [ ] Receipt shows gift card transaction

---

## Performance Considerations

### Data Fetching
- History tab fetches only when tab becomes active
- Search results limited to 5 customers (dropdown)
- Gift card transactions fetched per-card on expand
- Query uses indexes on card_number, customer_id

### Debouncing
- Customer search: 300ms delay
- Prevents excessive API calls while typing

### Rendering
- Memoized filtered cards list
- Conditional rendering of transaction history
- AnimatePresence for modal transitions

---

## Known Limitations

1. **Gift Card Numbers**
   - Not validated for duplicates (relies on DB constraint)
   - No PIN/password protection
   - No expiration logic (expires_at field available but not used)

2. **Redemption**
   - No refund-to-original-card logic
   - Can't partially refund multiple cards
   - No balance notifications/alerts

3. **History Export**
   - No CSV/PDF export
   - No print-friendly view
   - Limited to current session visibility

4. **Branding**
   - Card numbers not customizable (format fixed)
   - No gift card template/design selection

---

## Future Enhancements

1. **Advanced Features**
   - Gift card expiration dates
   - Balance notifications
   - Bulk issuance (upload CSV)
   - Gift card templates (design selection)

2. **Analytics**
   - Sales analytics by gift card
   - Top-up history tracking
   - Redemption patterns
   - Revenue forecasting

3. **Security**
   - PIN protection on cards
   - Audit logging for all gift card operations
   - Fraud detection (rapid redemptions)
   - Rate limiting on lookups

4. **UX Improvements**
   - Gift card preview/visual design
   - QR code generation and scanning
   - Email delivery of gift cards
   - Customer notifications on partial redemptions

---

## Files Changed

### New Files
- `src/components/GiftCardTab.tsx` (900+ lines)

### Modified Files
- `src/pages/POSPage.tsx`
  - Updated imports
  - Changed posTab type to include 'gc'
  - Removed showGiftCardModal/showGiftCardRedeemModal state
  - Updated barcode scanner logic
  - Added GC tab rendering
  - Added Gift Cards bottom tab button
  - Updated redeem button in checkout
  - Removed GiftCardModal/GiftCardRedeemModal rendering

### Existing Files (No Changes)
- `src/components/GiftCardModal.tsx` (kept for backwards compatibility)
- `src/components/GiftCardRedeemModal.tsx` (kept for backwards compatibility)
- `src/components/GiftCardsAdmin.tsx` (admin dashboard)
- `src/components/CustomerGiftCards.tsx` (customer profile)

---

## Commit Information

**Commit Hash**: `cb19c1d`  
**Date**: 2026-06-10  
**Message**: feat: redesign gift card feature with dedicated GC tab (sell, redeem, history)

---

## Support & Troubleshooting

### Common Issues

**Gift card not appearing in cart after issue**
- Check browser console for errors
- Verify gift card ID format in response
- Confirm Supabase transaction records creation

**Redemption fails with "Card not found"**
- Verify card number is correct
- Check gift card is in Supabase
- Confirm card_number column value matches input

**Search results not appearing**
- Wait for debounce (300ms)
- Check customer spelling
- Verify customer_id is not null

**Modal closes unexpectedly**
- Check for navigation/tab changes
- Verify cart state (items required for redeem)
- Look for error messages in console

---

## Questions?

For implementation details or issues:
1. Check browser console (F12)
2. Review Supabase logs
3. Check POSPage and GiftCardTab state
4. Verify API endpoints are working

