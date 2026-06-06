# Returns Feature - Setup & Usage Guide

## Overview

The Returns feature allows POS staff to process item returns directly from the register. When a customer returns items, you can:
1. Look up the original invoice by scanning the barcode or entering the invoice number
2. Select which items to return
3. Choose whether to refund to the original payment method or issue store credit
4. Process refunds and store credit in a single transaction

## Setup Instructions

### 1. Create the Returns Table in Supabase

Run the migration SQL in your Supabase SQL editor:

**Path:** `migrations/create_returns_table.sql`

Or copy this SQL and run it:
```sql
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  store_credit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  items JSONB[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT returns_positive_amounts CHECK (refund_amount >= 0 AND store_credit_amount >= 0)
);

CREATE INDEX IF NOT EXISTS returns_transaction_id_idx ON returns(transaction_id);
CREATE INDEX IF NOT EXISTS returns_created_at_idx ON returns(created_at DESC);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access" ON returns
  FOR ALL USING (true)
  WITH CHECK (true);
```

### 2. Server Already Updated

The API endpoint `/api/returns` is already registered in `server.ts` and will:
- Create a return record
- Restore inventory for returned items
- Issue store credit (if selected)
- Create a refund audit record

## Usage in POS

### Accessing the Returns Tab

1. Open the POS system (`/pos`)
2. Enter PIN (2024)
3. Click the "↩️ Returns" button in the bottom tab bar (between "🎟 Store Credit" and others)

### Processing a Return

#### Step 1: Search for Invoice
- **Option A:** Scan the transaction barcode from the receipt
- **Option B:** Manually type the invoice number
- Click "Search" or press Enter

#### Step 2: Invoice Found
The system displays:
- Invoice number
- Transaction date
- Payment method used
- Original total amount
- All items purchased on that invoice

#### Step 3: Select Items to Return
For each item you want to return:
1. ✓ Check the checkbox to select it
2. The return amount automatically calculates (including tax)
3. Once selected, two buttons appear:
   - **Refund** (orange): Refund to original payment method
   - **Store Credit** (blue): Issue as store credit

#### Step 4: Review & Process
At the bottom of the screen:
- See total refund amount (to original payment method)
- See total store credit to be issued
- Click "Process Return" when ready

#### Step 5: Confirmation
- Return is processed
- Inventory restored for returned items
- Refunds initiated
- Store credits issued (if applicable)
- Success message displayed
- Form resets for next return

## Return Amount Calculation

The return amount includes:
1. **Item price**: Original price paid for the item
2. **Proportional tax**: If the original transaction was taxed (HST 13%), the return includes the item's portion of that tax
3. **Proportional discount**: If an order-level discount was applied, it's proportionally applied to the return

**Example:**
- Original purchase: $100 (taxable) + $13 HST = $113 total
- Return 1 item at $100:
  - Tax portion: $13 × ($100/$100) = $13
  - Return amount: $100 + $13 = $113

## Features

### ✅ What Works
- **Invoice lookup** by barcode scan or manual entry
- **Multi-item selection** - return some or all items from an invoice
- **Flexible payment options** - refund, store credit, or combination
- **Automatic tax calculation** - includes proportional HST
- **Automatic discount application** - proportional to returned items
- **Inventory restoration** - stock is automatically replenished
- **Store credit issuance** - automatic creation with reason "Return"
- **Audit trail** - all returns recorded with detailed information

### ⚠️ Limitations
- Returns must be processed within the same register session
- Customer must have original invoice (barcode or invoice number)
- Partial returns of multi-quantity items not yet supported (takes full qty or none)
- No return reason tracking (could be enhanced)

## Troubleshooting

### Invoice Not Found
- **Issue:** "Invoice not found" error when searching
- **Solution:** 
  - Verify the invoice number is correct
  - Make sure the transaction exists in the system
  - Try scanning the barcode from the receipt instead

### Empty Items List
- **Issue:** Invoice found but no items showing
- **Solution:**
  - Check that the transaction was saved with items
  - The items array might be empty (contact support)

### Return Processing Failed
- **Issue:** Error when clicking "Process Return"
- **Solution:**
  - Ensure customer exists in system (if issuing store credit)
  - Check that selected items are valid
  - Try again or refresh the page

## Database Schema

### Returns Table
```sql
returns:
  id (UUID) - Primary key
  transaction_id (UUID) - Reference to original transaction
  refund_amount (DECIMAL) - Amount to refund to original payment method
  store_credit_amount (DECIMAL) - Amount to issue as store credit
  items (JSONB[]) - Array of returned items with details
  created_at (TIMESTAMP) - When return was processed
```

### Related Updates
- **transactions** - Refund records created with type='refund'
- **product_variants** - Stock quantities restored
- **store_credits** - New store credit records created (if applicable)
- **store_credit_transactions** - Transactions recorded for audit trail

## Future Enhancements

Potential improvements for future versions:
1. **Partial quantity returns** - Return some units of a multi-unit item
2. **Return reasons** - Track why items were returned (defect, wrong size, etc.)
3. **Exchange processing** - Process returns that become new sales
4. **Return windows** - Enforce return time limits (30-day returns)
5. **Return analytics** - Reports on return reasons and patterns
6. **Return approvals** - Manager approval for high-value returns
7. **Gift card/SC distribution** - Split return across multiple payment methods

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review the Supabase dashboard for data consistency
3. Check browser console for error messages
4. Contact development team with detailed error descriptions
