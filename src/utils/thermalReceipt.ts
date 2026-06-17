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

  const itemsHtml = data.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const sizeText = item.size ? `Size ${item.size}` : '';
      const ageText = item.ageGroup ? `${item.ageGroup}` : '';
      const detailText = [sizeText, ageText].filter(Boolean).join(' · ');

      return `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;word-wrap:break-word;">
            <span style="flex:1;">${item.name}</span>
            <span style="margin-left:8px;white-space:nowrap;">$${lineTotal.toFixed(2)}</span>
          </div>
          ${detailText ? `<div style="font-size:10px;color:#333;margin-bottom:2px;">  ${detailText}</div>` : ''}
          <div style="font-size:10px;color:#333;">  Qty: ${item.quantity} @ $${item.price.toFixed(2)}</div>
        </div>
      `;
    })
    .join('');

  const statusLine = data.status && data.status.toUpperCase() !== 'COMPLETED' ? `[${data.status.toUpperCase()}]` : '';

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
      line-height: 1.3;
      width: 80mm;
      color: #000;
    }
    .receipt {
      width: 80mm;
      padding: 4mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      display: block;
      margin: 0 auto 6px;
      max-width: 160px;
      max-height: 60px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .store-name {
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .store-info {
      font-size: 10px;
      line-height: 1.4;
    }
    .divider {
      border: none;
      text-align: center;
      margin: 4px 0;
      color: #000;
    }
    .divider::before {
      content: "- - - - - - - - - - - - - - - -";
    }
    .transaction-info {
      font-size: 10px;
      line-height: 1.5;
      margin: 4px 0;
    }
    .transaction-info div {
      margin: 2px 0;
    }
    .barcode-container {
      text-align: center;
      margin: 6px 0;
    }
    .barcode-container svg {
      max-width: 100%;
      height: auto;
    }
    .items-section {
      margin: 6px 0;
    }
    .totals {
      margin: 4px 0;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      font-size: 11px;
    }
    .total-row.grand-total {
      font-size: 13px;
      font-weight: bold;
      margin-top: 4px;
      padding: 3px 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      line-height: 1.5;
    }
    .footer-text {
      margin: 2px 0;
    }

    @media print {
      body, .receipt {
        width: 80mm;
        margin: 0;
        padding: 0;
      }
      * {
        margin: 0 !important;
        padding: 0 !important;
      }
      img {
        max-width: 160px !important;
        max-height: 60px !important;
      }
      @page {
        size: 80mm auto;
        margin: 0;
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
        <div>Web: torontosoccershop.com</div>
      </div>
    </div>

    <div class="divider"></div>

    ${data.isReprint ? '<div style="text-align:center;font-weight:bold;font-size:11px;margin:4px 0;letter-spacing:1px;">*** REPRINT ***</div><div class="divider"></div>' : ''}

    <!-- Barcode -->
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>

    <div class="divider"></div>

    <!-- Transaction Details -->
    <div class="transaction-info">
      <div><strong>Invoice #</strong> ${data.invoiceNumber || data.transactionId.slice(0, 8).toUpperCase()}</div>
      <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
      <div><strong>Customer:</strong> ${data.customerName}</div>
      <div><strong>Payment:</strong> ${data.paymentMethod}</div>
    </div>

    <div class="divider"></div>

    <!-- Items -->
    <div class="items-section">
      ${itemsHtml}
    </div>

    <div class="divider"></div>

    <!-- Totals -->
    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>$${data.subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>HST (13%):</span>
        <span>$${data.hst.toFixed(2)}</span>
      </div>
      <div class="total-row grand-total">
        <span>TOTAL:</span>
        <span>$${data.total.toFixed(2)}</span>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text"><strong>Thank You For Your Business!</strong></div>
      <div class="footer-text">Follow us on Instagram</div>
      <div class="footer-text">@absolutemississauga</div>
      ${statusLine ? `<div class="footer-text" style="font-weight:bold;margin-top:4px;">${statusLine}</div>` : ''}
      ${data.copyLabel ? `<div class="footer-text" style="font-weight:bold;margin-top:4px;letter-spacing:1px;">-- ${data.copyLabel} --</div>` : ''}
      ${data.showSignatureLine ? `
      <div class="footer-text" style="margin-top:8px;border-top:1px solid #000;padding-top:4px;">
        <div style="margin-bottom:2px;font-size:9px;">Signature:</div>
        <div style="height:20px;"></div>
      </div>
      ` : ''}
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.addEventListener('load', () => {
      try {
        // Generate barcode: use barcodeValue first, fallback to invoiceNumber, then transactionId
        const barcodeValue = "${data.barcodeValue || data.invoiceNumber || data.transactionId}";
        if (typeof JsBarcode !== 'undefined') {
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
        <div style="margin-bottom:8px;">
          <div style="margin-bottom:2px;word-wrap:break-word;">
            <span>${item.name}</span>
          </div>
          ${detailText ? `<div style="font-size:10px;color:#333;margin-bottom:2px;">  ${detailText}</div>` : ''}
          <div style="font-size:10px;color:#333;">  Qty: ${item.quantity}</div>
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
      line-height: 1.3;
      width: 80mm;
      color: #000;
    }
    .receipt {
      width: 80mm;
      padding: 4mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      display: block;
      margin: 0 auto 6px;
      max-width: 160px;
      max-height: 60px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .store-name {
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .store-info {
      font-size: 10px;
      line-height: 1.4;
    }
    .gift-header {
      text-align: center;
      font-size: 13px;
      font-weight: bold;
      margin: 6px 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
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
      margin-top: 2px;
      letter-spacing: 1px;
    }
    .divider {
      border: none;
      text-align: center;
      margin: 4px 0;
      color: #000;
    }
    .divider::before {
      content: "- - - - - - - - - - - - - - - -";
    }
    .transaction-info {
      font-size: 10px;
      line-height: 1.5;
      margin: 4px 0;
    }
    .transaction-info div {
      margin: 2px 0;
    }
    .items-section {
      margin: 6px 0;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      margin-top: 6px;
      line-height: 1.5;
    }
    .footer-text {
      margin: 2px 0;
    }
    @media print {
      body, .receipt {
        width: 80mm;
        margin: 0;
        padding: 0;
      }
      * {
        margin: 0 !important;
        padding: 0 !important;
      }
      img {
        max-width: 160px !important;
        max-height: 60px !important;
      }
      @page {
        size: 80mm auto;
        margin: 0;
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
    </div>

    <div class="divider"></div>

    <div class="gift-header">GIFT RECEIPT</div>

    <!-- Barcode -->
    ${data.invoiceNumber ? `
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    <div class="invoice-number">${data.invoiceNumber}</div>
    ` : ''}

    <div class="divider"></div>

    <!-- Transaction Details (No prices) -->
    <div class="transaction-info">
      ${data.invoiceNumber ? `<div><strong>Ref #:</strong> ${data.invoiceNumber}</div>` : ''}
      <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
      <div><strong>For:</strong> ${data.customerName}</div>
    </div>

    <div class="divider"></div>

    <!-- Items (No Prices) -->
    <div class="items-section">
      ${itemsHtml}
    </div>

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-text"><strong>This is a gift receipt</strong></div>
      <div class="footer-text">This item may be exchanged within</div>
      <div class="footer-text">30 days with this receipt</div>
      <div class="footer-text" style="margin-top:4px;">Absolute Soccer</div>
      <div class="footer-text">Mississauga, Ontario</div>
      <div class="footer-text">@absolutemississauga</div>
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
      line-height: 1.3;
      width: 80mm;
      color: #000;
    }
    .receipt {
      width: 80mm;
      padding: 4mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      display: block;
      margin: 0 auto 6px;
      max-width: 160px;
      max-height: 60px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .store-name {
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .store-info {
      font-size: 10px;
      line-height: 1.4;
    }
    .divider::before {
      content: "= = = = = = = = = = = = = = = =";
    }
    .divider {
      border: none;
      text-align: center;
      margin: 4px 0;
      color: #000;
      font-size: 9px;
    }
    .receipt-type {
      text-align: center;
      font-size: 13px;
      font-weight: bold;
      margin: 6px 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .reprint-header {
      text-align: center;
      font-size: 11px;
      font-weight: bold;
      color: #000;
      margin: 4px 0;
      letter-spacing: 1px;
    }
    .barcode-container {
      text-align: center;
      margin: 8px 0;
    }
    .barcode-container svg {
      max-width: 100%;
      height: auto;
    }
    .transaction-info {
      font-size: 10px;
      line-height: 1.5;
      margin: 4px 0;
    }
    .transaction-info div {
      margin: 2px 0;
    }
    .sc-details {
      font-size: 11px;
      margin: 6px 0;
    }
    .sc-details-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .sc-amount {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin: 6px 0;
      padding: 4px;
      border: 2px solid #000;
    }
    .redemption-section {
      margin: 6px 0;
      font-size: 10px;
    }
    .redemption-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
    }
    .remaining-balance {
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      margin: 6px 0;
      padding: 4px;
      border: 2px solid #000;
    }
    .footer {
      text-align: center;
      font-size: 9px;
      margin-top: 6px;
      line-height: 1.5;
    }
    .footer-text {
      margin: 2px 0;
    }
    @media print {
      body, .receipt {
        width: 80mm;
        margin: 0;
        padding: 0;
      }
      * {
        margin: 0 !important;
        padding: 0 !important;
      }
      img {
        max-width: 160px !important;
        max-height: 60px !important;
      }
      @page {
        size: 80mm auto;
        margin: 0;
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
    </div>

    <div class="divider"></div>

    ${data.isReprint ? '<div class="reprint-header">*** REPRINT ***</div><div class="divider"></div>' : ''}

    <div class="receipt-type">${isRedemption ? 'Store Credit Redeemed' : 'Store Credit Issued'}</div>

    <div class="divider"></div>

    <!-- SC Card Number (Prominent) -->
    ${!isRedemption && data.storeCreditCardNumber ? `
    <div style="text-align:center;margin:6px 0;padding:4px;border:2px solid #000;">
      <div style="font-size:9px;font-weight:bold;margin-bottom:2px;">CARD NUMBER</div>
      <div style="font-size:13px;font-weight:bold;font-family:monospace;letter-spacing:1px;">${data.storeCreditCardNumber}</div>
    </div>
    ` : ''}

    <div class="divider"></div>

    <!-- Barcode (SC Card Number) -->
    ${data.storeCreditCardNumber ? `
    <div class="barcode-container">
      <svg id="barcode"></svg>
    </div>
    ` : ''}

    <!-- Transaction Details -->
    <div class="transaction-info">
      <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
      <div><strong>Customer:</strong> ${data.customerName}</div>
      ${isRedemption && data.transactionId ? `<div><strong>Ref:</strong> ${data.transactionId.slice(0, 8).toUpperCase()}</div>` : ''}
    </div>

    <div class="divider"></div>

    ${isRedemption ? `
    <!-- Redemption Details -->
    <div class="redemption-section">
      <div style="text-align:center;font-weight:bold;margin-bottom:4px;">PAYMENT DETAILS</div>
      <div class="redemption-row">
        <span>Store Credit Used:</span>
        <span>-$${data.storeCreditUsedAmount.toFixed(2)}</span>
      </div>
      <div class="redemption-row">
        <span>Cash/Card Paid:</span>
        <span>$${(data.total - data.storeCreditUsedAmount).toFixed(2)}</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="redemption-section">
      <div style="text-align:center;font-size:10px;margin-bottom:4px;">REMAINING BALANCE</div>
      <div class="remaining-balance">$${data.storeCreditRemainingBalance.toFixed(2)}</div>
    </div>
    ` : `
    <!-- Store Credit Details -->
    <div class="sc-details">
      <div style="text-align:center;font-weight:bold;margin-bottom:4px;">CREDIT DETAILS</div>
      <div class="sc-details-row">
        <span>Card Number:</span>
        <span style="font-family:monospace;font-weight:bold;">${data.storeCreditCardNumber || 'N/A'}</span>
      </div>
      <div class="sc-details-row">
        <span>Amount:</span>
        <span style="font-weight:bold;">$${data.storeCreditAmount.toFixed(2)}</span>
      </div>
      <div class="sc-details-row">
        <span>Remaining:</span>
        <span style="font-weight:bold;">$${data.storeCreditAmount.toFixed(2)}</span>
      </div>
      <div class="sc-details-row">
        <span>Expires:</span>
        <span>Never</span>
      </div>
      ${data.storeCreditReason ? `<div class="sc-details-row"><span>Reason:</span><span>${data.storeCreditReason}</span></div>` : ''}
    </div>

    <div class="divider"></div>

    <div class="sc-amount">$${data.storeCreditAmount.toFixed(2)}</div>
    `}

    <div class="divider"></div>

    <!-- Footer -->
    <div class="footer">
      ${isRedemption ? `
        <div class="footer-text"><strong>Thank You For Your Business!</strong></div>
        <div class="footer-text">Keep this receipt for your records</div>
      ` : `
        <div class="footer-text"><strong>STORE CREDIT ISSUED</strong></div>
        <div class="footer-text">Redeem at Absolute Soccer</div>
        <div class="footer-text">Mississauga in store only</div>
        <div class="footer-text">Keep this receipt safe!</div>
      `}
      <div class="footer-text">@absolutemississauga</div>
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
