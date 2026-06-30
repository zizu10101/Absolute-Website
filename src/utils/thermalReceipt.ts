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
  }>;
  subtotal: number;
  hst: number;
  total: number;
  paymentMethod: string;
  createdAt: Date;
  status?: string;
  logoUrl?: string;
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
}

export const generateThermalReceiptHTML = (data: ReceiptData): string => {
  const dateStr = data.createdAt.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const timeStr = data.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const truncateName = (name: string, maxLength = 24): string =>
    name.length <= maxLength ? name : name.substring(0, maxLength - 3) + '...';

  const itemsHtml = data.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const sizeText = item.size ? `Size ${item.size}` : '';
      const ageText = item.ageGroup ? `${item.ageGroup}` : '';
      const detailText = [sizeText, ageText].filter(Boolean).join(' · ');

      return `
        <div class="item">
          <div class="item-row">
            <span class="item-name">${truncateName(item.name)}</span>
            <span class="item-price">$${lineTotal.toFixed(2)}</span>
          </div>
          ${detailText ? `<div class="item-details">${detailText}</div>` : ''}
          <div class="item-qty">Qty: ${item.quantity} @ $${item.price.toFixed(2)}</div>
        </div>
      `;
    })
    .join('');

  const statusLine = data.status && data.status.toUpperCase() !== 'COMPLETED' ? `[${data.status.toUpperCase()}]` : '';
  const copies = data.copies || 1;

  // Receipt body extracted so it can be duplicated for 2-copy printing
  const receiptContent = `
    <!-- Header -->
    <div class="header">
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" class="logo">` : ''}
      <div class="store-name">ABSOLUTE SOCCER MISSISSAUGA</div>
      <div class="store-info">
        <div>Phone: 905-593-3600</div>
        <div>torontosoccershop.com</div>
      </div>
      <div class="header-divider"></div>
    </div>

    ${data.isReprint ? '<div class="reprint-header">*** REPRINT ***</div><div class="divider"></div>' : ''}

    <!-- Barcode -->
    <div class="barcode-container">
      <svg class="receipt-barcode"></svg>
    </div>

    <!-- Transaction Details -->
    <div class="transaction-info">
      <div class="tx-row">
        <span class="tx-label">Invoice #</span>
        <span class="tx-value">${data.invoiceNumber || data.transactionId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">Date</span>
        <span class="tx-value">${dateStr}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">Time</span>
        <span class="tx-value">${timeStr}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">Customer</span>
        <span class="tx-value">${data.customerName}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">Payment</span>
        <span class="tx-value">${data.paymentMethod}</span>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Items Header -->
    <div class="section-header">ITEMS</div>

    <!-- Items -->
    <div class="items-section">
      ${itemsHtml}
    </div>

    <div class="divider"></div>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">$${data.subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span class="total-label">HST (13%)</span>
        <span class="total-value">$${data.hst.toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span class="total-label">TOTAL</span>
        <span class="total-value">$${data.total.toFixed(2)}</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-message">Thank you for shopping with us!</div>
      <div class="footer-social">Follow us on Instagram</div>
      <div class="footer-social">@absolutemississauga</div>
      ${statusLine ? `<div class="footer-status">${statusLine}</div>` : ''}
      ${data.copyLabel ? `<div class="footer-copy">${data.copyLabel}</div>` : ''}
      ${data.showSignatureLine ? `
      <div class="signature-section">
        <div>Signature: _______________</div>
      </div>
      ` : ''}
    </div>
  `;

  const bodyHTML = copies === 2
    ? `<div class="receipt" style="page-break-after: always; break-after: page;">${receiptContent}</div>
       <div class="receipt">${receiptContent}</div>`
    : `<div class="receipt">${receiptContent}</div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${data.transactionId}</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      width: 72mm;
      color: #000;
    }
    .receipt {
      width: 72mm;
      padding: 3mm 4mm;
      margin: 0 auto;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      display: block;
      margin: 0 auto 2mm auto;
      max-width: 50mm;
      max-height: 18mm;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .store-name {
      font-size: 17px;
      font-weight: bold;
      letter-spacing: 1.5px;
      margin: 2px 0 4px 0;
    }
    .store-info {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .header-divider {
      border-top: 1px solid #000;
      margin: 6px 0 4px 0;
    }

    /* Reprint Header */
    .reprint-header {
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      margin: 4px 0;
      letter-spacing: 1px;
    }

    /* Dividers */
    .divider {
      border-top: 1px solid #000;
      margin: 6px 0;
      height: 0;
    }

    /* Transaction Info */
    .transaction-info {
      font-size: 10px;
      margin: 6px 0;
      font-weight: normal;
    }
    .tx-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      line-height: 1.3;
    }
    .tx-label {
      font-weight: bold;
    }
    .tx-value {
      text-align: right;
    }

    /* Barcode */
    .barcode-container {
      text-align: center;
      margin: 8px 0;
    }
    .barcode-container svg {
      max-width: 100%;
      height: auto;
    }

    /* Section Header */
    .section-header {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 6px 0 4px 0;
    }

    /* Items Section */
    .items-section {
      margin: 4px 0;
      font-weight: normal;
    }
    .item {
      margin-bottom: 8px;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1px;
    }
    .item-name {
      font-weight: bold;
      font-size: 12px;
      flex: 1;
    }
    .item-price {
      font-weight: bold;
      font-size: 12px;
      text-align: right;
      white-space: nowrap;
      margin-left: 4px;
    }
    .item-details {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
      margin: 1px 0 1px 2px;
    }
    .item-qty {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
      margin: 1px 0 0 2px;
    }

    /* Totals */
    .totals {
      margin: 6px 0;
      font-weight: normal;
      font-size: 11px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      line-height: 1.4;
    }
    .total-label {
      flex: 1;
    }
    .total-value {
      text-align: right;
      font-weight: bold;
      min-width: 45px;
    }
    .total-row.grand-total {
      font-size: 14px;
      font-weight: bold;
      margin: 4px 0 0 0;
      padding: 4px 0;
      border-top: 2px double #000;
      border-bottom: 2px double #000;
    }
    .grand-total .total-label {
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Footer */
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      font-weight: normal;
    }
    .footer-message {
      font-style: italic;
      margin-bottom: 3px;
      letter-spacing: 0.5px;
    }
    .footer-social {
      font-size: 9px;
      color: #1a1a1a;
      margin: 1px 0;
    }
    .footer-status {
      font-weight: bold;
      margin-top: 4px;
      font-size: 10px;
    }
    .footer-copy {
      font-weight: bold;
      margin-top: 3px;
      letter-spacing: 0.5px;
      font-size: 10px;
    }
    .signature-section {
      margin-top: 8px;
      border-top: 1px solid #000;
      padding-top: 4px;
      font-size: 9px;
      text-align: left;
    }

    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        width: 72mm;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 72mm;
        padding: 3mm 4mm;
        page-break-inside: avoid;
      }
      .receipt[style*="page-break-after"] {
        page-break-after: always;
        -webkit-page-break-after: always;
        break-after: page;
      }
      img {
        max-width: 50mm !important;
        max-height: 18mm !important;
        display: block !important;
        margin: 0 auto !important;
      }
    }
  </style>
</head>
<body>
  ${bodyHTML}

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.addEventListener('load', function() {
      try {
        var barcodeValue = "${data.barcodeValue || data.invoiceNumber || data.transactionId}";
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
    });
  </script>
</body>
</html>
  `;
};

// Generate gift receipt (no prices, just items)
export const generateGiftReceiptHTML = (data: {
  invoiceNumber?: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; size?: string; ageGroup?: string }>;
  createdAt: Date;
  logoUrl?: string;
}): string => {
  const dateStr = data.createdAt.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const timeStr = data.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const itemsHtml = data.items
    .map((item) => {
      const sizeText = item.size ? `Size ${item.size}` : '';
      const ageText = item.ageGroup ? `${item.ageGroup}` : '';
      const detailText = [sizeText, ageText].filter(Boolean).join(' · ');

      return `
        <div class="item">
          <div class="item-name-gift">${item.name}</div>
          ${detailText ? `<div class="item-details">${detailText}</div>` : ''}
          <div class="item-qty">Qty: ${item.quantity}</div>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Gift Receipt</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      width: 72mm;
      color: #000;
    }
    .receipt {
      width: 72mm;
      padding: 3mm 4mm;
      margin: 0 auto;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .logo {
      display: block;
      margin: 0 auto 2mm auto;
      max-width: 50mm;
      max-height: 18mm;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .store-name {
      font-size: 17px;
      font-weight: bold;
      letter-spacing: 1.5px;
      margin: 2px 0 3px 0;
    }
    .store-info {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
      line-height: 1.3;
    }
    .header-divider {
      border-top: 1px solid #000;
      margin: 6px 0 4px 0;
    }

    /* Dividers */
    .divider {
      border-top: 1px solid #000;
      margin: 6px 0;
      height: 0;
    }

    /* Gift Receipt Header */
    .gift-header {
      text-align: center;
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin: 6px 0;
      padding: 4px 0;
      border-top: 2px double #000;
      border-bottom: 2px double #000;
    }

    /* Barcode */
    .barcode-container {
      text-align: center;
      margin: 8px 0;
    }
    .barcode-container svg {
      max-width: 100%;
      height: auto;
    }
    .invoice-number {
      text-align: center;
      font-size: 10px;
      font-weight: bold;
      font-family: monospace;
      margin: 2px 0 0 0;
      letter-spacing: 0.5px;
    }

    /* Transaction Info */
    .transaction-info {
      font-size: 10px;
      margin: 6px 0;
      font-weight: normal;
    }
    .tx-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      line-height: 1.3;
    }
    .tx-label {
      font-weight: bold;
    }
    .tx-value {
      text-align: right;
    }

    /* Section Header */
    .section-header {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 6px 0 4px 0;
    }

    /* Items */
    .items-section {
      margin: 4px 0;
      font-weight: normal;
    }
    .item {
      margin-bottom: 6px;
    }
    .item-name-gift {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 1px;
    }
    .item-details {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
      margin: 1px 0;
    }
    .item-qty {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
    }

    /* Footer */
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      font-weight: normal;
      line-height: 1.4;
    }
    .footer-text {
      margin: 2px 0;
    }
    .footer-policy {
      font-size: 9px;
      color: #1a1a1a;
      margin-top: 4px;
    }
    .footer-social {
      font-size: 9px;
      color: #1a1a1a;
      margin: 2px 0;
    }

    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        width: 72mm;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 72mm;
        padding: 3mm 4mm;
      }
      img {
        max-width: 50mm !important;
        max-height: 18mm !important;
        display: block !important;
        margin: 0 auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="header">
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" class="logo">` : ''}
      <div class="store-name">ABSOLUTE SOCCER MISSISSAUGA</div>
      <div class="store-info">
        <div>Phone: 905-593-3600</div>
      </div>
      <div class="header-divider"></div>
    </div>

    <div class="gift-header">GIFT RECEIPT</div>

    <!-- Barcode -->
    ${data.invoiceNumber ? `
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    <div class="invoice-number">${data.invoiceNumber}</div>
    ` : ''}

    <div class="divider"></div>

    <!-- Transaction Details -->
    <div class="transaction-info">
      ${data.invoiceNumber ? `
      <div class="tx-row">
        <span class="tx-label">Ref #</span>
        <span class="tx-value">${data.invoiceNumber}</span>
      </div>
      ` : ''}
      <div class="tx-row">
        <span class="tx-label">Date</span>
        <span class="tx-value">${dateStr}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">For</span>
        <span class="tx-value">${data.customerName}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section-header">ITEMS</div>

    <!-- Items -->
    <div class="items-section">
      ${itemsHtml}
    </div>

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">This is a gift receipt</div>
      <div class="footer-policy">This item may be exchanged within</div>
      <div class="footer-policy">30 days with this receipt</div>
      <div class="footer-social" style="margin-top: 4px;">Absolute Soccer</div>
      <div class="footer-social">Mississauga, Ontario</div>
      <div class="footer-social">@absolutemississauga</div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.addEventListener('load', () => {
      try {
        const barcodeValue = "${data.invoiceNumber || 'N/A'}";
        if (typeof JsBarcode !== 'undefined' && document.getElementById('barcode')) {
          JsBarcode("#barcode", barcodeValue, {
            format: "CODE128",
            width: 1.5,
            height: 40,
            displayValue: false,
            margin: 0
          });
        }
      } catch (e) {
        console.error('Barcode generation failed:', e);
      }
      setTimeout(() => window.print(), 100);
    });
  </script>
</body>
</html>
  `;
};

// Generate special receipt for store credit issuance or redemption
export const generateStoreCreditReceiptHTML = (data: ReceiptData): string => {
  const dateStr = data.createdAt.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const timeStr = data.createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Determine if this is issuance or redemption
  const isRedemption = data.storeCreditUsedAmount && data.storeCreditUsedAmount > 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${isRedemption ? 'Receipt - Store Credit Used' : 'Store Credit - ' + data.storeCreditCardNumber}</title>
  <style>
    * { margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      width: 72mm;
      color: #000;
    }
    .receipt {
      width: 72mm;
      padding: 3mm 4mm;
      margin: 0 auto;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .logo {
      display: block;
      margin: 0 auto 2mm auto;
      max-width: 50mm;
      max-height: 18mm;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .store-name {
      font-size: 17px;
      font-weight: bold;
      letter-spacing: 1.5px;
      margin: 2px 0 3px 0;
    }
    .store-info {
      font-size: 10px;
      font-weight: normal;
      color: #1a1a1a;
      line-height: 1.3;
      margin-bottom: 4px;
    }
    .header-divider {
      border-top: 1px solid #000;
      margin: 6px 0 4px 0;
    }

    /* Reprint Header */
    .reprint-header {
      text-align: center;
      font-weight: bold;
      font-size: 11px;
      margin: 4px 0;
      letter-spacing: 1px;
    }

    /* Dividers */
    .divider {
      border-top: 1px solid #000;
      margin: 6px 0;
      height: 0;
    }
    .divider-double {
      border-top: 2px double #000;
      margin: 6px 0;
      height: 0;
    }

    /* Receipt Type */
    .receipt-type {
      text-align: center;
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin: 6px 0;
      padding: 4px 0;
      border-top: 2px double #000;
      border-bottom: 2px double #000;
    }

    /* Card Number Box */
    .card-box {
      text-align: center;
      margin: 6px 0;
      padding: 4px;
      border: 1px solid #000;
    }
    .card-box-label {
      font-size: 9px;
      font-weight: bold;
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-box-number {
      font-size: 13px;
      font-weight: bold;
      font-family: monospace;
      letter-spacing: 1px;
    }

    /* Barcode */
    .barcode-container {
      text-align: center;
      margin: 8px 0;
    }
    .barcode-container svg {
      max-width: 100%;
      height: auto;
    }

    /* Transaction Info */
    .transaction-info {
      font-size: 10px;
      margin: 6px 0;
      font-weight: normal;
    }
    .tx-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      line-height: 1.3;
    }
    .tx-label {
      font-weight: bold;
    }
    .tx-value {
      text-align: right;
    }

    /* Section Header */
    .section-header {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 6px 0 4px 0;
      text-align: center;
    }

    /* Details Section */
    .details-section {
      margin: 6px 0;
      font-size: 10px;
      font-weight: normal;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      line-height: 1.3;
    }
    .details-row span:first-child {
      flex: 1;
    }
    .details-row span:last-child {
      text-align: right;
      font-weight: bold;
      min-width: 45px;
    }

    /* Amount Highlight */
    .amount-box {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin: 6px 0;
      padding: 6px;
      border: 2px double #000;
    }

    /* Footer */
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      font-weight: normal;
      line-height: 1.4;
    }
    .footer-text {
      margin: 2px 0;
    }
    .footer-message {
      font-style: italic;
      letter-spacing: 0.5px;
    }
    .footer-social {
      font-size: 9px;
      color: #1a1a1a;
      margin: 1px 0;
    }

    @media print {
      @page {
        size: 80mm auto;
        margin: 0;
      }
      body {
        width: 72mm;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 72mm;
        padding: 3mm 4mm;
      }
      img {
        max-width: 50mm !important;
        max-height: 18mm !important;
        display: block !important;
        margin: 0 auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div class="header">
      ${data.logoUrl ? `<img src="${data.logoUrl}" alt="Logo" class="logo">` : ''}
      <div class="store-name">ABSOLUTE SOCCER MISSISSAUGA</div>
      <div class="store-info">
        <div>Phone: 905-593-3600</div>
      </div>
      <div class="header-divider"></div>
    </div>

    ${data.isReprint ? '<div class="reprint-header">*** REPRINT ***</div><div class="divider"></div>' : ''}

    <div class="receipt-type">${isRedemption ? 'Store Credit Redeemed' : 'Store Credit Issued'}</div>

    <!-- SC Card Number (Prominent, for issuance only) -->
    ${!isRedemption && data.storeCreditCardNumber ? `
    <div class="card-box">
      <div class="card-box-label">Card Number</div>
      <div class="card-box-number">${data.storeCreditCardNumber}</div>
    </div>
    ` : ''}

    <div class="divider"></div>

    <!-- Barcode -->
    ${data.storeCreditCardNumber ? `
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    ` : ''}

    <!-- Transaction Details -->
    <div class="transaction-info">
      <div class="tx-row">
        <span class="tx-label">Date</span>
        <span class="tx-value">${dateStr}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">Time</span>
        <span class="tx-value">${timeStr}</span>
      </div>
      <div class="tx-row">
        <span class="tx-label">Customer</span>
        <span class="tx-value">${data.customerName}</span>
      </div>
      ${isRedemption && data.transactionId ? `
      <div class="tx-row">
        <span class="tx-label">Ref</span>
        <span class="tx-value">${data.transactionId.slice(0, 8).toUpperCase()}</span>
      </div>
      ` : ''}
    </div>

    <div class="divider"></div>

    ${isRedemption ? `
    <!-- Redemption Details -->
    <div class="section-header">Payment Details</div>
    <div class="details-section">
      <div class="details-row">
        <span>Store Credit Used</span>
        <span>-$${data.storeCreditUsedAmount.toFixed(2)}</span>
      </div>
      <div class="details-row">
        <span>Cash/Card Paid</span>
        <span>$${(data.total - data.storeCreditUsedAmount).toFixed(2)}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section-header">Remaining Balance</div>
    <div class="amount-box">$${data.storeCreditRemainingBalance.toFixed(2)}</div>
    ` : `
    <!-- Store Credit Details -->
    <div class="section-header">Credit Details</div>
    <div class="details-section">
      <div class="details-row">
        <span>Card Number</span>
        <span style="font-family:monospace;">${data.storeCreditCardNumber || 'N/A'}</span>
      </div>
      <div class="details-row">
        <span>Amount Issued</span>
        <span>$${data.storeCreditAmount.toFixed(2)}</span>
      </div>
      <div class="details-row">
        <span>Remaining</span>
        <span>$${data.storeCreditAmount.toFixed(2)}</span>
      </div>
      <div class="details-row">
        <span>Expires</span>
        <span>Never</span>
      </div>
      ${data.storeCreditReason ? `
      <div class="details-row">
        <span>Reason</span>
        <span>${data.storeCreditReason}</span>
      </div>
      ` : ''}
    </div>

    <div class="divider"></div>

    <div class="section-header">Amount Issued</div>
    <div class="amount-box">$${data.storeCreditAmount.toFixed(2)}</div>
    `}

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">
      ${isRedemption ? `
        <div class="footer-text footer-message">Thank you for your business!</div>
        <div class="footer-social">Keep this receipt for your records</div>
      ` : `
        <div class="footer-text footer-message">Store Credit Issued</div>
        <div class="footer-social">Redeem at Absolute Soccer</div>
        <div class="footer-social">Mississauga in store only</div>
        <div class="footer-social">Keep this receipt safe!</div>
      `}
      <div class="footer-social">@absolutemississauga</div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.addEventListener('load', () => {
      try {
        // For SC receipt: barcode ONLY the SC card number
        const barcodeValue = "${data.storeCreditCardNumber}";
        if (typeof JsBarcode !== 'undefined' && document.getElementById('barcode')) {
          JsBarcode("#barcode", barcodeValue, {
            format: "CODE128",
            width: 1.5,
            height: 40,
            displayValue: false,
            margin: 0
          });
        }
      } catch (e) {
        console.error('Barcode generation failed:', e);
      }
      setTimeout(() => window.print(), 100);
    });
  </script>
</body>
</html>
  `;
};
