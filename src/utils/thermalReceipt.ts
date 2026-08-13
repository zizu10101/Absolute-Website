// Shared thermal receipt layout: 80mm paper, 72mm centered content column (4mm gutter
// each side), black logo header (no store-name text — the logo carries that), a
// two-column metadata block, an items table, totals, a payment-methods breakdown, a
// centered barcode, and a centered footer. Every generator below composes the same
// building blocks so all receipt types stay visually consistent.

const RECEIPT_LOGO = '/logo-black.png';
const STORE_ADDRESS = '5600 Rose Cherry Place, Mississauga, ON L4Z 4B6';
const STORE_PHONE = 'Tel: 905-593-3600';

const formatReceiptDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

const formatReceiptTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const money = (n: number): string => `$${n.toFixed(2)}`;

const STANDARD_FOOTER = [
  'Thank you for shopping with',
  'Absolute Soccer!',
  'Exchange or refund within 14 days of purchase.',
  'Items must be unworn or unused, in their',
  'original packaging, and accompanied by a receipt.',
];

const RECEIPT_STYLES = `
    * { margin: 0; padding: 0; box-sizing: border-box; font-weight: 700 !important; }
    @page { size: 80mm auto; margin: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: 700;
      width: 80mm;
      margin: 0;
      padding: 0;
      color: #000;
    }
    .receipt { width: 72mm; margin: 0 auto; padding: 4mm 0; }
    .center { text-align: center; }
    .divider { border-top: 1px solid #000; margin: 3mm 0; height: 0; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; margin: 1mm 0; }

    .logo { display: block; margin: 0 auto 3mm; max-width: 55mm; max-height: 20mm; width: auto; height: auto; object-fit: contain; }
    .store-info { text-align: center; font-size: 10px; line-height: 1.5; margin-bottom: 2mm; }

    .reprint-banner { text-align: center; font-size: 11px; letter-spacing: 1px; margin: 2mm 0; }

    .metadata { font-size: 11px; margin: 2mm 0; }
    .metadata .row { margin: 0.8mm 0; }

    .items-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 1.5mm; border-bottom: 1px solid #000; margin-bottom: 2mm; }
    .item { margin-bottom: 2.5mm; }
    .item-row { display: flex; justify-content: space-between; gap: 2mm; }
    .item-name { flex: 1; font-size: 12px; }
    .item-price { font-size: 12px; white-space: nowrap; }
    .item-detail { font-size: 10px; margin: 0.5mm 0 0 2mm; }

    .totals { font-size: 12px; margin: 2mm 0; }
    .totals .row { margin: 1mm 0; }
    .grand-total { font-size: 14px; border-top: 2px double #000; border-bottom: 2px double #000; padding: 1.5mm 0; margin: 1.5mm 0; }

    .payments { font-size: 12px; margin: 2mm 0; }
    .payments .row { margin: 1mm 0; }

    .barcode-container { text-align: center; margin: 3mm 0; }
    .barcode-container svg { max-width: 100%; height: auto; }
    .barcode-ref { text-align: center; font-size: 10px; letter-spacing: 0.5px; margin-top: 1mm; }

    .card-box { text-align: center; padding: 2mm; border: 1px solid #000; margin: 2mm 0; }
    .card-box-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1mm; }
    .card-box-number { font-size: 13px; font-family: monospace; letter-spacing: 1px; }
    .amount-box { font-size: 16px; text-align: center; margin: 2mm 0; padding: 2mm; border: 2px double #000; }

    .footer { text-align: center; font-size: 10px; line-height: 1.6; margin-top: 2mm; }
    .footer-strong { text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 1.5mm 0; border-top: 2px double #000; border-bottom: 2px double #000; margin: 2mm 0; }
    .signature-line { margin-top: 3mm; border-top: 1px solid #000; padding-top: 2mm; font-size: 9px; text-align: left; }
    .copy-label { text-align: center; font-size: 10px; letter-spacing: 0.5px; margin-top: 2mm; }

    @media print {
      @page { size: 80mm auto; margin: 0; }
      body { width: 80mm; margin: 0; padding: 0; }
      .receipt { width: 72mm; margin: 0 auto; padding: 4mm 0; page-break-inside: avoid; }
      .receipt[data-page-break="true"] { page-break-after: always; -webkit-page-break-after: always; break-after: page; }
      img { max-width: 55mm !important; max-height: 20mm !important; display: block !important; margin: 0 auto 3mm !important; }
    }
`;

const buildHeader = (): string => `
    <div class="header">
      <img src="${RECEIPT_LOGO}" alt="Absolute Soccer" class="logo">
      <div class="store-info">
        <div>${STORE_ADDRESS}</div>
        <div>${STORE_PHONE}</div>
      </div>
    </div>
    <div class="divider"></div>`;

const buildMetadata = (opts: {
  transactionType: string;
  ref: string;
  dateStr: string;
  timeStr: string;
  cashier?: string;
  customerName?: string;
  phone?: string;
}): string => {
  const customerRow = opts.customerName && opts.customerName.toLowerCase() !== 'walk-in'
    ? `<div class="row"><span>Customer: ${opts.customerName}</span></div>` : '';
  const phoneRow = opts.phone ? `<div class="row"><span>Phone: ${opts.phone}</span></div>` : '';
  return `
    <div class="metadata">
      <div class="row"><span>Transaction: ${opts.transactionType}</span></div>
      <div class="row"><span>Ref #: ${opts.ref}</span><span>Date: ${opts.dateStr}</span></div>
      <div class="row"><span>Cashier: ${opts.cashier || 'STAFF'}</span><span>Time: ${opts.timeStr}</span></div>
      ${customerRow}
      ${phoneRow}
    </div>`;
};

const buildBarcodeSection = (refText?: string): string => `
    <div class="barcode-container"><svg class="receipt-barcode"></svg></div>
    ${refText ? `<div class="barcode-ref">${refText}</div>` : ''}`;

// Renders one row per split payment method; falls back to parsing the legacy combined
// "Cash $50.00 + Debit $30.00" string (still produced by POS split-payment checkout)
// when a structured paymentSplits array isn't provided, so older callers keep working.
const buildPaymentMethods = (paymentMethod: string, total: number, paymentSplits?: Array<{ method: string; amount: number }>): string => {
  let rows: Array<{ label: string; amount: number }>;
  if (paymentSplits && paymentSplits.length > 0) {
    rows = paymentSplits.map((s) => ({ label: s.method, amount: s.amount }));
  } else {
    const parts = paymentMethod.split(' + ').map((p) => p.trim());
    const parsed = parts.map((p) => {
      const m = p.match(/^(.+?)\s+\$([\d,]+\.\d{2})$/);
      return m ? { label: m[1].trim(), amount: parseFloat(m[2].replace(/,/g, '')) } : null;
    });
    rows = parsed.every(Boolean)
      ? (parsed as Array<{ label: string; amount: number }>)
      : [{ label: paymentMethod, amount: total }];
  }
  const balanceDue = Math.max(0, total - rows.reduce((sum, r) => sum + r.amount, 0));
  const rowsHtml = rows.map((r) => `<div class="row"><span>Paid ${r.label}:</span><span>${money(r.amount)}</span></div>`).join('');
  return `
    <div class="payments">
      ${rowsHtml}
      <div class="row"><span>Balance Due:</span><span>${money(balanceDue)}</span></div>
    </div>`;
};

const buildFooter = (lines: string[]): string => `
    <div class="footer">
      ${lines.map((l) => `<div>${l}</div>`).join('')}
    </div>`;

const buildBarcodeScript = (barcodeValue: string, autoPrint: boolean): string => `
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.addEventListener('load', function() {
      try {
        var barcodeValue = ${JSON.stringify(barcodeValue)};
        if (typeof JsBarcode !== 'undefined') {
          document.querySelectorAll('.receipt-barcode').forEach(function(svg) {
            JsBarcode(svg, barcodeValue, {
              format: "CODE128",
              width: 1.5,
              height: 40,
              displayValue: false,
              margin: 0
            });
          });
        }
      } catch (e) {
        console.error('Barcode generation failed:', e);
      }
      ${autoPrint ? 'setTimeout(function() { window.print(); }, 100);' : ''}
    });
  </script>`;

const wrapReceiptDocument = (opts: { title: string; bodyHtml: string; barcodeValue: string; autoPrint: boolean }): string => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${opts.title}</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  ${opts.bodyHtml}
${buildBarcodeScript(opts.barcodeValue, opts.autoPrint)}
</body>
</html>`;

export interface ReceiptData {
  transactionId: string;
  invoiceNumber?: string; // Short invoice number (INV-01000)
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
    ageGroup?: string;
    discount?: { type: 'percent' | 'fixed' | 'newprice'; value: number };
    priceOverridden?: boolean; // true when staff manually set a price
    originalPrice?: number; // pre-override price shown alongside the note
  }>;
  subtotal: number;
  hst: number;
  total: number;
  paymentMethod: string;
  paymentSplits?: Array<{ method: string; amount: number }>; // Structured split-payment breakdown
  cashier?: string;
  createdAt: Date;
  status?: string;
  logoUrl?: string; // Deprecated — every receipt now always prints the black logo
  barcodeValue?: string; // What to encode in barcode (defaults to invoiceNumber or transactionId)
  isReprint?: boolean; // Add "*** REPRINT ***" header
  copyLabel?: string; // "CUSTOMER COPY", "MERCHANT COPY", or undefined
  showSignatureLine?: boolean; // Add signature line for merchant copy
  // Store Credit receipt fields
  isStoreCreditReceipt?: boolean; // True if this is a SC issue receipt
  storeCreditCardNumber?: string; // SC card number (SC-XXXX...)
  storeCreditAmount?: number; // Amount issued
  storeCreditReason?: string; // Why SC was issued
  storeCreditRemainingBalance?: number; // For redemption receipts
  storeCreditUsedAmount?: number; // For redemption receipts
  copies?: 1 | 2; // Number of copies: 1 = customer only, 2 = customer + merchant
  cashTendered?: number; // Amount of cash given for payment
  changeDue?: number; // Change amount due to customer
}

export const generateThermalReceiptHTML = (data: ReceiptData): string => {
  const dateStr = formatReceiptDate(data.createdAt);
  const timeStr = formatReceiptTime(data.createdAt);
  const ref = data.invoiceNumber || data.transactionId.slice(0, 8).toUpperCase();
  const transactionType = data.status && data.status.toUpperCase() !== 'COMPLETED' ? data.status.toUpperCase() : 'SALE';

  const truncateName = (name: string, maxLength = 28): string =>
    name.length <= maxLength ? name : name.substring(0, maxLength - 3) + '...';

  const itemsHtml = data.items
    .map((item) => {
      const unitDiscount = item.discount
        ? Math.max(0, Math.min(item.price, item.discount.type === 'percent' ? item.price * (item.discount.value / 100) : item.discount.type === 'newprice' ? item.price - item.discount.value : item.discount.value))
        : 0;
      const discountedPrice = Math.max(0, item.price - unitDiscount);
      const lineTotal = discountedPrice * item.quantity;
      const detailParts = [
        item.size ? `Size: ${item.size}` : '',
        item.ageGroup || '',
        `Qty: ${item.quantity}`,
      ].filter(Boolean);
      const discountLine = item.discount
        ? `<div class="item-detail">Discount: -${money(unitDiscount * item.quantity)}</div>`
        : '';
      const overrideLine = item.priceOverridden
        ? `<div class="item-detail">*PRICE OVERRIDE*${item.originalPrice !== undefined ? ` (was ${money(item.originalPrice)})` : ''}</div>`
        : '';

      return `
        <div class="item">
          <div class="item-row"><span class="item-name">${truncateName(item.name)}</span><span class="item-price">${money(lineTotal)}</span></div>
          <div class="item-detail">${detailParts.join(' | ')}</div>
          ${overrideLine}
          ${discountLine}
        </div>`;
    })
    .join('');

  const receiptContent = `
    ${buildHeader()}
    ${data.isReprint ? '<div class="reprint-banner">*** REPRINT ***</div>' : ''}
    ${buildMetadata({ transactionType, ref, dateStr, timeStr, cashier: data.cashier, customerName: data.customerName })}
    <div class="divider"></div>
    <div class="row items-head"><span>Items</span><span>Price</span></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="totals">
      <div class="row"><span>Subtotal:</span><span>${money(data.subtotal)}</span></div>
      <div class="row"><span>HST (13%):</span><span>${money(data.hst)}</span></div>
      <div class="row grand-total"><span>Total:</span><span>${money(data.total)}</span></div>
    </div>
    ${buildPaymentMethods(data.paymentMethod, data.total, data.paymentSplits)}
    ${data.cashTendered !== undefined ? `
      <div class="divider"></div>
      <div class="payments">
        <div class="row"><span>Cash Tendered:</span><span>${money(data.cashTendered)}</span></div>
        ${data.changeDue !== undefined ? `<div class="row"><span>Change Due:</span><span>${money(data.changeDue)}</span></div>` : ''}
      </div>
    ` : ''}
    <div class="divider"></div>
    ${buildBarcodeSection(ref)}
    ${buildFooter(STANDARD_FOOTER)}
    ${data.copyLabel ? `<div class="copy-label">${data.copyLabel}</div>` : ''}
    ${data.showSignatureLine ? `<div class="signature-line">Signature: _______________</div>` : ''}
  `;

  const copies = data.copies || 1;
  const bodyHtml = copies === 2
    ? `<div class="receipt" data-page-break="true">${receiptContent}</div><div class="receipt">${receiptContent}</div>`
    : `<div class="receipt">${receiptContent}</div>`;

  return wrapReceiptDocument({
    title: `Receipt - ${data.transactionId}`,
    bodyHtml,
    barcodeValue: data.barcodeValue || data.invoiceNumber || data.transactionId,
    autoPrint: false, // callers trigger print themselves via window.onload
  });
};

// Generate gift receipt (no prices, just items)
export const generateGiftReceiptHTML = (data: {
  transactionId?: string;
  invoiceNumber?: string;
  barcodeValue?: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; size?: string; ageGroup?: string }>;
  createdAt: Date;
  logoUrl?: string;
  cashier?: string;
}): string => {
  const dateStr = formatReceiptDate(data.createdAt);
  const timeStr = formatReceiptTime(data.createdAt);
  const ref = data.invoiceNumber || (data.transactionId ? data.transactionId.slice(0, 8).toUpperCase() : 'N/A');

  const itemsHtml = data.items
    .map((item) => {
      const detailParts = [
        item.size ? `Size: ${item.size}` : '',
        item.ageGroup || '',
        `Qty: ${item.quantity}`,
      ].filter(Boolean);
      return `
        <div class="item">
          <div class="item-row"><span class="item-name">${item.name}</span></div>
          <div class="item-detail">${detailParts.join(' | ')}</div>
        </div>`;
    })
    .join('');

  const receiptContent = `
    ${buildHeader()}
    ${buildMetadata({ transactionType: 'GIFT', ref, dateStr, timeStr, cashier: data.cashier, customerName: data.customerName })}
    <div class="divider"></div>
    <div class="row items-head"><span>Items</span></div>
    ${itemsHtml}
    <div class="divider"></div>
    ${buildBarcodeSection(ref)}
    ${buildFooter([
      'This is a gift receipt.',
      'No prices shown.',
      'Exchange within 30 days with this receipt.',
    ])}
  `;

  return wrapReceiptDocument({
    title: 'Gift Receipt',
    bodyHtml: `<div class="receipt">${receiptContent}</div>`,
    barcodeValue: data.barcodeValue || ref,
    autoPrint: false, // every caller already triggers print via window.onload
  });
};

// Generate special receipt for store credit issuance or redemption
export const generateStoreCreditReceiptHTML = (data: ReceiptData): string => {
  const dateStr = formatReceiptDate(data.createdAt);
  const timeStr = formatReceiptTime(data.createdAt);
  const isRedemption = !!(data.storeCreditUsedAmount && data.storeCreditUsedAmount > 0);
  const transactionType = isRedemption ? 'STORE CREDIT REDEEMED' : 'STORE CREDIT ISSUED';
  const ref = isRedemption
    ? (data.transactionId ? data.transactionId.slice(0, 8).toUpperCase() : 'N/A')
    : (data.storeCreditCardNumber || 'N/A');

  const detailsHtml = isRedemption
    ? `
      <div class="row"><span>Store Credit Used:</span><span>-${money(data.storeCreditUsedAmount || 0)}</span></div>
      <div class="row"><span>Cash/Card Paid:</span><span>${money(data.total - (data.storeCreditUsedAmount || 0))}</span></div>`
    : `
      <div class="row"><span>Amount Issued:</span><span>${money(data.storeCreditAmount || 0)}</span></div>
      <div class="row"><span>Expires:</span><span>Never</span></div>
      ${data.storeCreditReason ? `<div class="row"><span>Reason:</span><span>${data.storeCreditReason}</span></div>` : ''}`;

  const receiptContent = `
    ${buildHeader()}
    ${data.isReprint ? '<div class="reprint-banner">*** REPRINT ***</div>' : ''}
    ${buildMetadata({ transactionType, ref, dateStr, timeStr, cashier: data.cashier, customerName: data.customerName })}
    <div class="divider"></div>
    ${!isRedemption && data.storeCreditCardNumber ? `
    <div class="card-box">
      <div class="card-box-label">Card Number</div>
      <div class="card-box-number">${data.storeCreditCardNumber}</div>
    </div>` : ''}
    <div class="totals">${detailsHtml}</div>
    <div class="divider"></div>
    <div class="amount-box">${money(isRedemption ? (data.storeCreditRemainingBalance || 0) : (data.storeCreditAmount || 0))}</div>
    <div class="divider"></div>
    ${data.storeCreditCardNumber ? buildBarcodeSection(data.storeCreditCardNumber) : ''}
    ${buildFooter(isRedemption
      ? ['Thank you for your business!', 'Keep this receipt for your records.']
      : ['Store credit issued.', 'Redeem in store at Absolute Soccer.', 'Keep this receipt safe.'])}
  `;

  return wrapReceiptDocument({
    title: isRedemption ? 'Receipt - Store Credit Used' : `Store Credit - ${data.storeCreditCardNumber}`,
    bodyHtml: `<div class="receipt">${receiptContent}</div>`,
    barcodeValue: data.storeCreditCardNumber || '',
    autoPrint: true, // sole caller (ReturnsModal.tsx) doesn't trigger print itself
  });
};

interface LayawayPayLaterItem {
  name: string;
  quantity: number;
  price: number;
  size?: string;
  ageGroup?: string;
  color?: string;
}

// Reverses a tax-inclusive total into its subtotal/HST parts (HST = 13%, Ontario)
const splitOutHst = (totalAmount: number) => {
  const subtotal = totalAmount / 1.13;
  const hst = totalAmount - subtotal;
  return { subtotal, hst };
};

const layawayPayLaterItemsHtml = (items: LayawayPayLaterItem[]): string =>
  items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const detailParts = [
        item.size ? `Size: ${item.size}` : '',
        item.color ? `Color: ${item.color}` : '',
        item.ageGroup || '',
        `Qty: ${item.quantity}`,
      ].filter(Boolean);
      return `
        <div class="item">
          <div class="item-row"><span class="item-name">${item.name}</span><span class="item-price">${money(lineTotal)}</span></div>
          <div class="item-detail">${detailParts.join(' | ')}</div>
        </div>`;
    })
    .join('');

export interface LayawayReceiptData {
  layawayId?: string;
  customerName: string;
  customerPhone?: string;
  items: LayawayPayLaterItem[];
  totalAmount: number;
  depositPaid: number;
  balanceDue: number;
  createdAt: Date;
  logoUrl?: string;
  cashier?: string;
}

export const generateLayawayReceiptHTML = (data: LayawayReceiptData): string => {
  const dateStr = formatReceiptDate(data.createdAt);
  const timeStr = formatReceiptTime(data.createdAt);
  const refNumber = (data.layawayId || '').slice(0, 8).toUpperCase();
  const ref = refNumber ? `LAY-${refNumber}` : 'N/A';
  const { subtotal, hst } = splitOutHst(data.totalAmount);

  const receiptContent = `
    ${buildHeader()}
    ${buildMetadata({ transactionType: 'LAYAWAY', ref, dateStr, timeStr, cashier: data.cashier, customerName: data.customerName, phone: data.customerPhone })}
    <div class="divider"></div>
    <div class="row items-head"><span>Items On Hold</span><span>Price</span></div>
    ${layawayPayLaterItemsHtml(data.items)}
    <div class="divider"></div>
    <div class="totals">
      <div class="row"><span>Subtotal:</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>HST (13%):</span><span>${money(hst)}</span></div>
      <div class="row"><span>Total Amount:</span><span>${money(data.totalAmount)}</span></div>
      <div class="row"><span>Deposit Paid:</span><span>-${money(data.depositPaid)}</span></div>
      <div class="row grand-total"><span>Balance Due:</span><span>${money(data.balanceDue)}</span></div>
    </div>
    <div class="divider"></div>
    ${buildBarcodeSection(ref)}
    ${buildFooter(['Deposits are non-refundable.', ...STANDARD_FOOTER])}
  `;

  return wrapReceiptDocument({
    title: 'Layaway Receipt',
    bodyHtml: `<div class="receipt">${receiptContent}</div>`,
    barcodeValue: data.layawayId || 'N/A',
    autoPrint: false,
  });
};

export interface PayLaterReceiptData {
  payLaterId?: string;
  customerName: string;
  customerPhone?: string;
  items: LayawayPayLaterItem[];
  totalAmount: number;
  createdAt: Date;
  logoUrl?: string;
  cashier?: string;
}

export const generatePayLaterReceiptHTML = (data: PayLaterReceiptData): string => {
  const dateStr = formatReceiptDate(data.createdAt);
  const timeStr = formatReceiptTime(data.createdAt);
  const refNumber = (data.payLaterId || '').slice(0, 8).toUpperCase();
  const ref = refNumber ? `PL-${refNumber}` : 'N/A';
  const { subtotal, hst } = splitOutHst(data.totalAmount);

  const receiptContent = `
    ${buildHeader()}
    ${buildMetadata({ transactionType: 'PAY LATER', ref, dateStr, timeStr, cashier: data.cashier, customerName: data.customerName, phone: data.customerPhone })}
    <div class="divider"></div>
    <div class="row items-head"><span>Items</span><span>Price</span></div>
    ${layawayPayLaterItemsHtml(data.items)}
    <div class="divider"></div>
    <div class="totals">
      <div class="row"><span>Subtotal:</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>HST (13%):</span><span>${money(hst)}</span></div>
      <div class="row grand-total"><span>Total Owed:</span><span>${money(data.totalAmount)}</span></div>
    </div>
    <div class="divider"></div>
    ${buildBarcodeSection(ref)}
    ${buildFooter(['Payment due upon next visit.', ...STANDARD_FOOTER])}
  `;

  return wrapReceiptDocument({
    title: 'Pay Later Receipt',
    bodyHtml: `<div class="receipt">${receiptContent}</div>`,
    barcodeValue: data.payLaterId || 'N/A',
    autoPrint: false,
  });
};

export interface LayawayPaymentReceiptData {
  recordType: 'layaway' | 'pay_later';
  recordId?: string;
  customerName: string;
  customerPhone?: string;
  items: LayawayPayLaterItem[];
  paymentAmount: number;
  previousBalance: number;
  newBalance: number;
  isFullyPaid: boolean;
  createdAt: Date;
  logoUrl?: string;
  cashier?: string;
}

export const generateLayawayPaymentReceiptHTML = (data: LayawayPaymentReceiptData): string => {
  const dateStr = formatReceiptDate(data.createdAt);
  const timeStr = formatReceiptTime(data.createdAt);
  const isLayaway = data.recordType === 'layaway';
  const refPrefix = isLayaway ? 'LAY' : 'PL';
  const refNumber = (data.recordId || '').slice(0, 8).toUpperCase();
  const ref = refNumber ? `${refPrefix}-${refNumber}` : 'N/A';
  const transactionType = isLayaway ? 'LAYAWAY PAYMENT' : 'PAY LATER PAYMENT';
  const itemsSummaryHtml = data.items
    .map((item) => `<div class="item-detail">${item.name} x${item.quantity}</div>`)
    .join('');

  const receiptContent = `
    ${buildHeader()}
    ${buildMetadata({ transactionType, ref, dateStr, timeStr, cashier: data.cashier, customerName: data.customerName, phone: data.customerPhone })}
    <div class="divider"></div>
    <div class="row items-head"><span>${isLayaway ? 'Items On Hold' : 'Items'} (Summary)</span></div>
    ${itemsSummaryHtml}
    <div class="divider"></div>
    <div class="totals">
      <div class="row"><span>Payment Made:</span><span>${money(data.paymentAmount)}</span></div>
      <div class="row"><span>Previous Balance:</span><span>${money(data.previousBalance)}</span></div>
      <div class="row grand-total"><span>New Balance:</span><span>${money(data.newBalance)}</span></div>
    </div>
    <div class="divider"></div>
    ${buildBarcodeSection(ref)}
    ${data.isFullyPaid ? `<div class="footer-strong">Paid In Full</div>` : ''}
    ${buildFooter(STANDARD_FOOTER)}
  `;

  return wrapReceiptDocument({
    title: transactionType,
    bodyHtml: `<div class="receipt">${receiptContent}</div>`,
    barcodeValue: data.recordId || 'N/A',
    autoPrint: false,
  });
};
