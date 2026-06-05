# Cash Change Calculator - Visual Guide

## User Interface Mockup

### Step 1: Checkout Modal - Payment Methods

```
┌─────────────────────────────────────────────────┐
│  CHECKOUT                          [X]          │
├─────────────────────────────────────────────────┤
│                                                 │
│  Customer: John Smith                           │
│                                                 │
│  [Items shown above - scrollable area]          │
│                                                 │
│  Subtotal:      $75.50                          │
│  Discount:     -$10.00                          │
│  HST (13%):     $8.57                           │
│                                                 │
│  Total Due:    $74.07                           │
│                                                 │
│  Payment Methods:                               │
│  ┌─────────┬──────────┬──────────┬─────────┐    │
│  │ Cash    │  Debit   │  Visa    │Mastercd│    │
│  │         │          │          │        │    │
│  ├─────────┼──────────┼──────────┼─────────┤    │
│  │ Amex    │Store Crd │Gift Card │         │    │
│  └─────────┴──────────┴──────────┴─────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
        ↓ Click "Cash" button
```

---

### Step 2: Cash Calculator Modal Opens

```
┌──────────────────────────────────────────────────┐
│  CASH PAYMENT                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  Total Due: $74.07                              │
│                                                  │
│  Amount Tendered                                │
│  ┌──────────────────────────────────────────┐   │
│  │ [                                      ] │   │  ← Input field (auto-focused)
│  │  (18pt font, large for counter)          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Quick Select                                   │
│  ┌─────────┬──────────┬──────────┬──────────┐   │
│  │ Exact   │  +$5     │  +$10    │  +$20    │   │
│  │ $74.07  │  $75     │  $80     │  $80     │   │
│  ├─────────┼──────────┼──────────┼──────────┤   │
│  │ +$50    │  +$100   │          │          │   │
│  │ $100    │  $100    │          │          │   │
│  └─────────┴──────────┴──────────┴──────────┘   │
│                                                  │
│  Change Display Area (empty - waiting for input)│
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  │  (change calculation shown when typing)  │   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────┬──────────────────────┐    │
│  │ Cancel           │ Complete Sale (OFF)  │    │
│  └──────────────────┴──────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
        ↓ Cashier types "80" or clicks "+$5"
```

---

### Step 3: Amount Entered - Change Calculated (Green)

```
┌──────────────────────────────────────────────────┐
│  CASH PAYMENT                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  Total Due: $74.07                              │
│                                                  │
│  Amount Tendered                                │
│  ┌──────────────────────────────────────────┐   │
│  │             80                           │   │  ← User entered 80
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Quick Select                                   │
│  ┌─────────┬──────────┬──────────┬──────────┐   │
│  │ Exact   │  +$5     │  +$10    │  +$20    │   │
│  │ $74.07  │  $75     │  $80     │  $80     │   │
│  ├─────────┼──────────┼──────────┼──────────┤   │
│  │ +$50    │  +$100   │          │          │   │
│  │ $100    │  $100    │          │          │   │
│  └─────────┴──────────┴──────────┴──────────┘   │
│                                                  │
│  Change Display Area                            │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  │          Change Due                      │   │
│  │                                          │   │
│  │            $5.93                         │   │  ← LARGE GREEN TEXT (24pt)
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────┬──────────────────────┐    │
│  │ Cancel           │ Complete Sale ✓      │    │  ← BUTTON NOW ENABLED
│  └──────────────────┴──────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
        ↓ Click "Complete Sale"
```

---

### Step 4: Amount Short (Red Warning)

```
┌──────────────────────────────────────────────────┐
│  CASH PAYMENT                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  Total Due: $74.07                              │
│                                                  │
│  Amount Tendered                                │
│  ┌──────────────────────────────────────────┐   │
│  │             50                           │   │  ← Not enough
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Quick Select                                   │
│  ┌─────────┬──────────┬──────────┬──────────┐   │
│  │ Exact   │  +$5     │  +$10    │  +$20    │   │
│  │ $74.07  │  $75     │  $80     │  $80     │   │
│  ├─────────┼──────────┼──────────┼──────────┤   │
│  │ +$50    │  +$100   │          │          │   │
│  │ $100    │  $100    │          │          │   │
│  └─────────┴──────────┴──────────┴──────────┘   │
│                                                  │
│  Amount Display Area                            │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  │          Amount Short                    │   │
│  │                                          │   │
│  │            $24.07                        │   │  ← LARGE RED TEXT (24pt)
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────┬──────────────────────┐    │
│  │ Cancel           │ Complete Sale (OFF)  │    │  ← BUTTON DISABLED
│  └──────────────────┴──────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
        ↓ Cashier clicks "+$50" to fix
```

---

### Step 5: Transaction Processing

```
┌──────────────────────────────────────────────────┐
│  CASH PAYMENT                                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  Total Due: $74.07                              │
│                                                  │
│  Amount Tendered                                │
│  ┌──────────────────────────────────────────┐   │
│  │             100                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Quick Select                                   │
│  ┌─────────┬──────────┬──────────┬──────────┐   │
│  │ Exact   │  +$5     │  +$10    │  +$20    │   │
│  │ $74.07  │  $75     │  $80     │  $80     │   │
│  ├─────────┼──────────┼──────────┼──────────┤   │
│  │ +$50    │  +$100   │          │          │   │
│  │ $100    │  $100    │          │          │   │
│  └─────────┴──────────┴──────────┴──────────┘   │
│                                                  │
│  Change Display Area                            │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │                                          │   │
│  │          Change Due                      │   │
│  │                                          │   │
│  │            $25.93                        │   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────┬──────────────────────┐    │
│  │ Cancel           │ Processing...  ⟳    │    │  ← Spinner showing
│  └──────────────────┴──────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
        ↓ Transaction saved to database
```

---

### Step 6: Receipt Displays

```
┌─────────────────────────────────────────────────┐
│  SALE COMPLETE                        [x]       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✓ SUCCESS                                      │
│  2024-06-10 14:32  •  Cash                      │
│                                                 │
│  TXN: ABC12345                                  │
│  ║║║║║║║║║║║║║║║║ (barcode)                     │
│                                                 │
│  Items:                                         │
│  • Nike Phantom Jersey - L  ×1    $89.99       │
│  • Soccer Ball FIFA Pro     ×1    $35.00       │
│  • Shin Guards              ×2   -$10.00 (disc)│
│                                                 │
│  ─────────────────────────────────────────     │
│  Subtotal:                        $75.50       │
│  Discount:                       -$10.00       │
│  HST (13%):                        $8.57       │
│  ─────────────────────────────────────────     │
│  TOTAL:                           $74.07       │
│                                                 │
│  CASH RECEIVED:                  $100.00       │
│  ═════════════════════════════════════════     │
│  CHANGE DUE:                     $25.93        │  ← GREEN TEXT
│                                                 │
│  ┌─────────────────┬───────────────────────┐   │
│  │ 🖨 Print        │ New Transaction      │   │
│  └─────────────────┴───────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Application Flow Diagram

```
                            START
                              ↓
                   ┌──────────────────────┐
                   │  User Scans Items    │
                   │  or Clicks Products  │
                   └──────────────────────┘
                              ↓
                   ┌──────────────────────┐
                   │   Items in Cart      │
                   │   Total: $74.07      │
                   └──────────────────────┘
                              ↓
                   ┌──────────────────────┐
                   │ Click Payment Method │
                   │  (Cash, Card, etc)   │
                   └──────────────────────┘
                              ↓
                       ┌──────┴──────┐
                       ↓             ↓
                   ┌─────────┐  ┌──────────────┐
                   │  CASH   │  │ CARD/OTHER   │
                   └─────────┘  └──────────────┘
                       ↓             ↓
         ┌─────────────────────┐   └─────────────┐
         │ Show Cash           │                 │
         │ Calculator Modal    │   Process Card  │
         └─────────────────────┘   Immediately  │
                ↓                                 │
         ┌─────────────────────┐                 │
         │ Enter Amount        │                 │
         │ Tendered            │                 │
         └─────────────────────┘                 │
                ↓                                 │
         ┌─────────────────────┐                 │
         │ Calculate Change    │                 │
         │ (Real-time)         │                 │
         └─────────────────────┘                 │
                ↓                                 │
         ┌─────────────────────┐                 │
         │ Valid Amount?       │                 │
         └─────────────────────┘                 │
                ↓                                 │
         ┌─────────────────────┐                 │
         │ Click Complete Sale │                 │
         │ (if enough money)   │                 │
         └─────────────────────┘                 │
                ↓                                 │
         ┌─────────────────────────────────────┐ │
         │ processPayment()                    │ │
         │ - Save transaction with:            │ │
         │   • tendered_amount: $100.00        │ │
         │   • change_given: $25.93            │ │
         │ - Deduct stock                      │ │
         │ - Create receipt                    │ │
         └─────────────────────────────────────┘ │
                ↓                                 │
                └────────┬────────────────────────┘
                         ↓
              ┌──────────────────────┐
              │ Show Receipt with:   │
              │ • Total Due: $74.07  │
              │ • Cash: $100.00      │
              │ • Change: $25.93     │
              └──────────────────────┘
                         ↓
              ┌──────────────────────┐
              │ Print or New Trans   │
              └──────────────────────┘
                         ↓
                       END
```

---

## State Diagram

```
                   showCashCalculator
                          ↓
                    ┌──────────────┐
            YES     │  Is "Cash"?  │
        ┌──────────→│              │
        │           └──────────────┘
        │                  ↓
        │                  NO
        │           (show immediately,
        ↓           save transaction)
    ┌─────────────────────────────┐
    │ Open Cash Calculator Modal  │
    │ • setCashTendered('')       │
    │ • showCashCalculator = true │
    └─────────────────────────────┘
             ↓
    ┌─────────────────────────────┐
    │ Cashier Enters Amount       │
    │ or Clicks Preset            │
    │ • setCashTendered(number)   │
    └─────────────────────────────┘
             ↓
    ┌─────────────────────────────┐
    │ Real-Time Calculation       │
    │ change = tendered - total   │
    │ Show green/red display      │
    └─────────────────────────────┘
             ↓
    ┌─────────────────────────────┐
    │ Valid Amount?               │
    │ (cashTendered >= grandTotal)│
    └─────────────────────────────┘
             ↓
         YES ↓ NO
         ┌───┴──────┐
         ↓          ↓
    ENABLED    DISABLED
    (can click) (grayed out)
         ↓
    ┌─────────────────────────────┐
    │ Click "Complete Sale"       │
    │ • processPayment()          │
    │ • Save to DB with:          │
    │   - tendered_amount         │
    │   - change_given            │
    │ • Close modal               │
    │ • Show receipt              │
    └─────────────────────────────┘
         ↓
    TRANSACTION COMPLETE
```

---

## Database Data Flow

```
React Component              →  Payment Processing        →  Database
┌──────────────────┐        ┌──────────────────┐        ┌──────────────┐
│ cashTendered     │        │ processPayment() │        │ transactions │
│  100.00          │───────→│                  │───────→│ table        │
│                  │        │ Validates        │        │ tendered_    │
│ grandTotal       │        │ • Amount >= total│        │ amount: 100  │
│  74.07           │        │ • Valid number   │        │ change_given:│
│                  │        │                  │        │  25.93       │
│ selectedCustomer │        │ Calculates       │        │              │
│ cart items       │        │ • change = $100 │        │ Other fields │
│ ...              │        │   - $74.07       │        │ unchanged    │
└──────────────────┘        │ • change = 25.93│        │              │
                            │                  │        │              │
                            │ Saves to API     │        │              │
                            │ /api/transactions│        │              │
                            │                  │        │              │
                            │ Deducts stock    │        │ product_     │
                            │ Updates receipt  │        │ variants     │
                            └──────────────────┘        │ (stock qty)  │
                                                        └──────────────┘
```

---

## Validation Flow

```
Input: cashTendered = 50.00, grandTotal = 74.07

                   ┌─────────────────────┐
                   │ Valid Tendered       │
                   │ Amount?              │
                   └─────────────────────┘
                          ↓
                ┌──────────┴──────────┐
                ↓                     ↓
          ┌──────────┐          ┌────────────┐
          │ Empty?   │          │ Is number? │
          │ ('') →   │          │ (string → ) │
          │ NO ✓     │          │ NO ✗       │
          └──────────┘          └────────────┘
                ↓                     ↓
          ┌──────────┐          ┌────────────┐
          │ >= Total?│          │ Disable    │
          │ 50 >= 74 │          │ button     │
          │ NO ✗     │          └────────────┘
          └──────────┘
                ↓
          ┌──────────────────────┐
          │ Disable button       │
          │ Show "Amount Short"  │
          │ in RED               │
          └──────────────────────┘

---

Input: cashTendered = 100.00, grandTotal = 74.07

                   ┌─────────────────────┐
                   │ Valid Tendered       │
                   │ Amount?              │
                   └─────────────────────┘
                          ↓
                ┌──────────┴──────────┐
                ↓                     ↓
          ┌──────────┐          ┌────────────┐
          │ Empty?   │          │ Is number? │
          │ (100)→   │          │ (100) →    │
          │ NO ✓     │          │ YES ✓      │
          └──────────┘          └────────────┘
                ↓                     ↓
          ┌──────────┐          ┌────────────┐
          │ >= Total?│          │ Enable     │
          │ 100 >= 74│          │ button     │
          │ YES ✓    │          └────────────┘
          └──────────┘
                ↓
          ┌──────────────────────┐
          │ Enable button        │
          │ Show "Change Due"    │
          │ in GREEN             │
          │ $25.93               │
          └──────────────────────┘
```

---

## Summary: Three Easy Steps for Cashiers

```
┌─────────────────────────────────────────────────┐
│  CASH PAYMENT - 3 SIMPLE STEPS                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  STEP 1: Select "Cash"                          │
│          └→ Calculator modal appears            │
│                                                 │
│  STEP 2: Enter Amount (Keyboard or Preset)      │
│          └→ See change calculate instantly      │
│                                                 │
│  STEP 3: Click "Complete Sale"                  │
│          └→ Transaction saved, receipt shown    │
│                                                 │
│  Done! Customer gets change. Receipt printed.   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

**That's it!** The cash calculator makes it easy and professional.
