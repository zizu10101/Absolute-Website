# Testing "Balls" Age Group Feature

## Setup
- Dev server running on localhost:3000
- Browser open to http://localhost:3000/admin

## Test Steps

### 1. Add New Product with Ball Sizes
- [ ] Click **+ Add Product** button
- [ ] Enter product name: "Soccer Ball" (or any name)
- [ ] Select category: "Soccer Balls" or "Equipment"
- [ ] Check that "Add Size Variants" section shows

### 2. Create Variant with "Balls" Age Group
- [ ] In the variant section, click **Age Group** dropdown
- [ ] Verify it shows these options:
  - [ ] Adult
  - [ ] Youth
  - [ ] Toddler
  - [ ] **Balls** ← NEW
  - [ ] One Size
- [ ] Select **"Balls"**

### 3. Verify Size Dropdown Shows Ball Sizes
- [ ] Click **Size** dropdown
- [ ] Verify it shows:
  - [ ] Size 1
  - [ ] Size 2
  - [ ] Size 3
  - [ ] Size 4
  - [ ] Size 5
- [ ] Select "Size 3"

### 4. Add Barcode and Quantity
- [ ] Enter Barcode: "BALL-SIZE3-001" (or auto-generate)
- [ ] Enter Quantity: "50"
- [ ] Click **+ Add Variant**
- [ ] Verify variant appears in the list

### 5. Test RapidScan (Optional)
- [ ] Find the variant you just created
- [ ] Click the barcode icon to open RapidScan
- [ ] Verify age group dropdown shows "⚽ Balls (Size 1-5)"
- [ ] Verify size list shows: Size 1, Size 2, Size 3, Size 4, Size 5

### 6. Test Editing Existing Product
- [ ] Open an existing product for editing
- [ ] Click "Edit Variants"
- [ ] Add a new variant
- [ ] Verify age group dropdown includes "Balls" option
- [ ] Select "Balls" and verify size options appear

## Expected Behavior
✓ Age group dropdown has "Balls" option
✓ Selecting "Balls" shows sizes: Size 1-5
✓ Can create and edit variants with "Balls" age group
✓ Sizes persist correctly in database

## Issues Found?
Note any unexpected behavior and describe steps to reproduce.
