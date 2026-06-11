import { Resend } from 'resend';

const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
const STORE_EMAILS = ['nabil@golazo.ca', 'ziad@golazo.ca'];
const STORE_PHONE = '905-593-3600';
const STORE_NAME = 'Absolute Soccer Mississauga';
const STORE_WEBSITE = 'torontosoccershop.com';

const resend = new Resend(RESEND_API_KEY);

export interface OrderEmail {
  orderId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  province: string;
  postalCode: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

// Format currency
const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

// Generate customer email HTML
const generateCustomerEmailHTML = (order: OrderEmail) => {
  const itemsHTML = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
        <strong>${item.name}</strong>
        ${item.size ? `<br><span style="color: #666; font-size: 14px;">Size: ${item.size}</span>` : ''}
        <br><span style="color: #666; font-size: 14px;">Quantity: ${item.quantity}</span>
      </td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0;">
        ${formatCurrency(item.price * item.quantity)}
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #b90014; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .section { margin: 20px 0; background: white; padding: 15px; border-radius: 4px; }
          .section-title { font-weight: bold; color: #b90014; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          .total-row { font-weight: bold; font-size: 18px; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
          a { color: #b90014; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed</h1>
          </div>
          <div class="content">
            <p>Thank you for your order, <strong>${order.customerName}</strong>!</p>

            <div class="section">
              <div class="section-title">Order Number</div>
              <p style="font-size: 18px; color: #b90014;">${order.orderId.slice(0, 8).toUpperCase()}</p>
            </div>

            <div class="section">
              <div class="section-title">Items Ordered</div>
              <table>
                ${itemsHTML}
              </table>
            </div>

            <div class="section">
              <div class="section-title">Order Summary</div>
              <table>
                <tr>
                  <td>Subtotal</td>
                  <td style="text-align: right;">${formatCurrency(order.subtotal)}</td>
                </tr>
                <tr>
                  <td>HST (13%)</td>
                  <td style="text-align: right;">${formatCurrency(order.tax)}</td>
                </tr>
                <tr class="total-row">
                  <td>Total</td>
                  <td style="text-align: right; color: #b90014;">${formatCurrency(order.total)}</td>
                </tr>
              </table>
            </div>

            <div class="section">
              <div class="section-title">Shipping Address</div>
              <p>
                ${order.shippingAddress}<br>
                ${order.city}, ${order.province} ${order.postalCode}
              </p>
            </div>

            <div class="section" style="background: #f0f0f0; border-left: 4px solid #b90014;">
              <strong>What happens next?</strong>
              <p>We will contact you within 24 hours to arrange payment and delivery.</p>
              <p><strong>Call us:</strong> ${STORE_PHONE}</p>
            </div>

            <div class="footer">
              <p>${STORE_NAME}<br>
              <a href="https://${STORE_WEBSITE}">${STORE_WEBSITE}</a><br>
              <a href="tel:${STORE_PHONE.replace(/-/g, '')}">${STORE_PHONE}</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Generate store notification email HTML
const generateStoreEmailHTML = (order: OrderEmail) => {
  const itemsHTML = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #f0f0f0;">
        ${item.name} ${item.size ? `(Size: ${item.size})` : ''}
      </td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #f0f0f0;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0;">
        ${formatCurrency(item.price)}
      </td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #f0f0f0;">
        ${formatCurrency(item.price * item.quantity)}
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #b90014; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .section { margin: 20px 0; background: white; padding: 15px; border-radius: 4px; }
          .section-title { font-weight: bold; color: #b90014; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Online Order Received</h1>
          </div>
          <div class="content">
            <div class="alert">
              <strong>Order #${order.orderId.slice(0, 8).toUpperCase()}</strong> - Total: <strong>${formatCurrency(order.total)}</strong>
            </div>

            <div class="section">
              <div class="section-title">Customer Information</div>
              <p>
                <strong>${order.customerName}</strong><br>
                Email: <a href="mailto:${order.customerEmail}">${order.customerEmail}</a><br>
                Phone: <a href="tel:${order.customerPhone.replace(/\D/g, '')}">${order.customerPhone}</a>
              </p>
            </div>

            <div class="section">
              <div class="section-title">Shipping Address</div>
              <p>
                ${order.shippingAddress}<br>
                ${order.city}, ${order.province} ${order.postalCode}
              </p>
            </div>

            <div class="section">
              <div class="section-title">Items Ordered</div>
              <table>
                <thead>
                  <tr style="background: #f0f0f0;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Product</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </div>

            <div class="section">
              <div style="text-align: right;">
                <p>Subtotal: <strong>${formatCurrency(order.subtotal)}</strong></p>
                <p>HST (13%): <strong>${formatCurrency(order.tax)}</strong></p>
                <p style="font-size: 18px; color: #b90014;">Total: <strong>${formatCurrency(order.total)}</strong></p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Send customer confirmation email
export const sendCustomerEmail = async (order: OrderEmail): Promise<boolean> => {
  try {
    if (!RESEND_API_KEY) {
      console.warn('VITE_RESEND_API_KEY not configured');
      return false;
    }

    const result = await resend.emails.send({
      from: 'Absolute Soccer <orders@golazo.ca>',
      to: order.customerEmail,
      subject: `Order Confirmed - ${STORE_NAME} #${order.orderId.slice(0, 8).toUpperCase()}`,
      html: generateCustomerEmailHTML(order),
    });

    console.log('Customer email sent:', result);
    return !result.error;
  } catch (error) {
    console.error('Error sending customer email:', error);
    return false;
  }
};

// Send store notification email
export const sendStoreEmail = async (order: OrderEmail): Promise<boolean> => {
  try {
    if (!RESEND_API_KEY) {
      console.warn('VITE_RESEND_API_KEY not configured');
      return false;
    }

    const result = await resend.emails.send({
      from: 'Absolute Soccer Mississauga <orders@golazo.ca>',
      to: STORE_EMAILS,
      subject: `New Online Order #${order.orderId.slice(0, 8).toUpperCase()} - ${formatCurrency(order.total)}`,
      html: generateStoreEmailHTML(order),
    });

    console.log('Store email sent:', result);
    return !result.error;
  } catch (error) {
    console.error('Error sending store email:', error);
    return false;
  }
};

// Send both emails (customer + store)
export const sendOrderEmails = async (order: OrderEmail): Promise<{ customer: boolean; store: boolean }> => {
  const [customerResult, storeResult] = await Promise.all([
    sendCustomerEmail(order),
    sendStoreEmail(order),
  ]);

  return {
    customer: customerResult,
    store: storeResult,
  };
};
