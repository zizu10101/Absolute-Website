import Barcode from 'react-barcode';

export interface InvoiceCustomerInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  customerInfo?: InvoiceCustomerInfo;
  paymentMethod?: string;
  logoUrl: string;
}

export const generateInvoiceHTML = (data: InvoiceData, type: 'invoice' | 'estimate'): string => {
  const docNumber = type === 'invoice'
    ? data.invoiceNumber
    : data.invoiceNumber.replace('INV-', 'EST-');

  const title = type === 'invoice' ? 'INVOICE' : 'ESTIMATE';
  const statusBadge = type === 'invoice'
    ? '<span style="display: inline-block; padding: 4px 12px; background: #d4edda; color: #155724; border-radius: 4px; font-weight: bold; font-size: 12px; margin-top: 10px;">PAID</span>'
    : '<span style="display: inline-block; padding: 4px 12px; background: #fff3cd; color: #856404; border-radius: 4px; font-weight: bold; font-size: 12px; margin-top: 10px;">ESTIMATE</span>';

  const itemsHtml = data.items.map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${[item.size, item.color].filter(Boolean).join(' / ') || '-'}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.price).toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: right;">$${(Number(item.price) * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const billToHtml = data.customerInfo && (data.customerInfo.firstName || data.customerInfo.lastName)
    ? `
      <div>
        <strong>${escapeHtml(data.customerInfo.firstName || '')} ${escapeHtml(data.customerInfo.lastName || '')}</strong><br>
        ${data.customerInfo.company ? `${escapeHtml(data.customerInfo.company)}<br>` : ''}
        ${data.customerInfo.address ? `${escapeHtml(data.customerInfo.address)}<br>` : ''}
        ${data.customerInfo.email ? `${escapeHtml(data.customerInfo.email)}<br>` : ''}
        ${data.customerInfo.phone ? `${escapeHtml(data.customerInfo.phone)}<br>` : ''}
      </div>
    `
    : '<div>Walk-in Customer</div>';

  const formattedDate = new Date(data.createdAt).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 13px;
      color: #000;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #b90014;
    }
    .logo {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
    }
    .store-info {
      text-align: right;
      font-size: 12px;
      color: #444;
      line-height: 1.6;
    }
    .doc-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
    }
    .doc-title {
      font-size: 32px;
      font-weight: bold;
      color: #b90014;
      margin-bottom: 10px;
    }
    .doc-number {
      font-size: 16px;
      font-weight: bold;
      color: #666;
    }
    .doc-right {
      text-align: right;
    }
    .doc-date {
      font-size: 13px;
      color: #666;
      margin-bottom: 10px;
    }
    .bill-to {
      margin-bottom: 30px;
      width: 48%;
    }
    .bill-to h3 {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
      letter-spacing: 1px;
    }
    .bill-to-content {
      font-size: 13px;
      line-height: 1.6;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    thead {
      background: #f5f5f5;
    }
    th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      border-bottom: 1px solid #ddd;
      font-weight: 600;
    }
    .text-right {
      text-align: right;
    }
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals {
      width: 350px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 12px;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    .total-row.grand {
      font-size: 16px;
      font-weight: bold;
      color: #b90014;
      border-bottom: 2px solid #b90014 !important;
      border-top: 2px solid #b90014;
    }
    .payment-info {
      margin-bottom: 30px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 11px;
      color: #666;
      line-height: 1.6;
    }
    @media print {
      body { padding: 20px; }
      @page { size: A4; margin: 15mm; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <img src="${data.logoUrl}" class="logo" alt="Absolute Soccer" />
    <div class="store-info">
      <strong>Absolute Soccer Mississauga</strong><br>
      5600 Rose Cherry Place<br>
      Mississauga, ON L4Z 4B6<br>
      Tel: 905-593-3600<br>
      torontosoccershop.com
    </div>
  </div>

  <!-- Document Meta -->
  <div class="doc-meta">
    <div>
      <div class="doc-title">${title}</div>
      <div class="doc-number"># ${docNumber}</div>
    </div>
    <div class="doc-right">
      <div class="doc-date">Date: ${formattedDate}</div>
      ${statusBadge}
    </div>
  </div>

  <!-- Bill To -->
  <div class="bill-to">
    <h3>Bill To</h3>
    <div class="bill-to-content">
      ${billToHtml}
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Size / Color</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-section">
    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>$${Number(data.subtotal).toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>HST (13%)</span>
        <span>$${Number(data.tax).toFixed(2)}</span>
      </div>
      <div class="total-row grand">
        <span>TOTAL</span>
        <span>$${Number(data.total).toFixed(2)}</span>
      </div>
    </div>
  </div>

  <!-- Payment Info -->
  ${type === 'invoice'
    ? `<div class="payment-info">
        <strong>Payment Method:</strong> ${escapeHtml(data.paymentMethod || 'N/A')}<br>
        <strong>Status:</strong> Paid in Full
      </div>`
    : `<div class="payment-info">
        <strong>This is an estimate only.</strong><br>
        Prices subject to change. Valid for 30 days from the date above.
      </div>`
  }

  <!-- Footer -->
  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Questions? Contact us at 905-593-3600 or visit torontosoccershop.com</p>
    <p>Exchange or refund within 14 days of purchase with receipt.</p>
  </div>

</body>
</html>`;
};

export const printInvoice = (html: string) => {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    alert('Could not open print window. Please check your popup blocker.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
      win.onafterprint = () => {
        win.close();
      };
    }, 500);
  };
};

const escapeHtml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
