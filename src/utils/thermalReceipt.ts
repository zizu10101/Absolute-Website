export interface ReceiptData {
  transactionId: string;
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
      <div class="store-name">TORONTO SOCCER SHOP</div>
      <div class="store-info">
        <div>Phone: 905-593-3600</div>
        <div>Web: torontosoccershop.com</div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Transaction Details -->
    <div class="transaction-info">
      <div><strong>ID:</strong> ${data.transactionId.slice(0, 8).toUpperCase()}</div>
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
      <div class="footer-text">@torontosoccershop</div>
      ${statusLine ? `<div class="footer-text" style="font-weight:bold;margin-top:4px;">${statusLine}</div>` : ''}
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 100);
    });
  </script>
</body>
</html>
  `;
};
