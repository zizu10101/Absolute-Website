import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const STORE_EMAILS = ['ziad@golazo.ca'];
const STORE_NAME = 'Absolute Soccer Mississauga';
const STORE_PHONE = '905-593-3600';
const STORE_WEBSITE = 'torontosoccershop.com';

interface OrderData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingMethod: 'pickup' | 'ship';
  shippingCost: number;
  shippingAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
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

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

const generateCustomerEmailHTML = (order: OrderData) => {
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

  const isPickup = order.shippingMethod === 'pickup';
  const fulfillmentSection = isPickup
    ? `
            <div class="section" style="background: #f0f0f0; border-left: 4px solid #b90014;">
              <div class="section-title" style="color: #b90014;">📍 PICKUP IN STORE</div>
              <p><strong>Your order will be ready for pickup at:</strong></p>
              <p style="margin: 10px 0;">
                ${STORE_NAME}<br>
                Mississauga, ON<br>
                <strong>Phone:</strong> <a href="tel:${STORE_PHONE.replace(/-/g, '')}">${STORE_PHONE}</a>
              </p>
              <p style="margin-top: 15px; color: #666;">We will call you at <strong>${order.customerPhone}</strong> when your order is ready for pickup.</p>
            </div>
    `
    : `
            <div class="section" style="background: #f0f0f0; border-left: 4px solid #b90014;">
              <div class="section-title" style="color: #b90014;">📦 SHIPPING TO:</div>
              <p>
                ${order.shippingAddress || '(Address not provided)'}<br>
                ${order.city ? order.city + ', ' : ''}${order.province || ''}${order.postalCode ? ' ' + order.postalCode : ''}
              </p>
              <p style="margin-top: 15px; color: #666;">Your order will be shipped within 3-5 business days. We'll send you a tracking number once your package ships.</p>
            </div>
    `;

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
                ${order.shippingCost > 0 ? `
                <tr>
                  <td>Shipping</td>
                  <td style="text-align: right;">${formatCurrency(order.shippingCost)}</td>
                </tr>
                ` : ''}
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

            ${fulfillmentSection}

            <div class="section" style="background: #f0f0f0; border-left: 4px solid #b90014;">
              <strong>Questions?</strong>
              <p>Contact us anytime at <a href="tel:${STORE_PHONE.replace(/-/g, '')}">${STORE_PHONE}</a> or <a href="mailto:info@edgedbs.com">info@edgedbs.com</a></p>
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

const generateStoreEmailHTML = (order: OrderData) => {
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

  const isPickup = order.shippingMethod === 'pickup';
  const fulfillmentSection = isPickup
    ? `
            <div class="section" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
              <div style="font-weight: bold; color: #b90014;">📍 PICKUP ORDER</div>
              <p style="margin-top: 10px;">Customer will pick up at store.</p>
              <p><strong>Customer Phone:</strong> <a href="tel:${order.customerPhone.replace(/\D/g, '')}">${order.customerPhone}</a></p>
            </div>
    `
    : `
            <div class="section" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
              <div style="font-weight: bold; color: #b90014;">📦 SHIP TO CUSTOMER</div>
              <p style="margin-top: 10px;">
                ${order.shippingAddress || '(No address)'}<br>
                ${order.city ? order.city + ', ' : ''}${order.province || ''}${order.postalCode ? ' ' + order.postalCode : ''}
              </p>
            </div>
    `;

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

            ${fulfillmentSection}

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
                ${order.shippingCost > 0 ? `<p>Shipping: <strong>${formatCurrency(order.shippingCost)}</strong></p>` : ''}
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

const sendEmailViaResend = async (
  to: string | string[],
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Absolute Soccer Mississauga <orders@golazo.ca>',
        to: to,
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Resend API error: ${error}` };
    }

    const data = await response.json();
    return { success: true };
  } catch (error) {
    return { success: false, error: `Error sending email: ${error.message}` };
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order: OrderData = await req.json();

    // Validate order data
    if (
      !order.orderId ||
      !order.customerEmail ||
      !order.customerName ||
      !order.items ||
      !Array.isArray(order.items)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid order data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send customer email
    const customerEmailResult = await sendEmailViaResend(
      order.customerEmail,
      `Order Confirmed - ${STORE_NAME} #${order.orderId.slice(0, 8).toUpperCase()}`,
      generateCustomerEmailHTML(order)
    );

    // Send store notification email
    const storeEmailResult = await sendEmailViaResend(
      STORE_EMAILS,
      `New Online Order #${order.orderId.slice(0, 8).toUpperCase()} - ${formatCurrency(order.total)}`,
      generateStoreEmailHTML(order)
    );

    // Return results
    return new Response(
      JSON.stringify({
        success: customerEmailResult.success && storeEmailResult.success,
        customer: customerEmailResult,
        store: storeEmailResult,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in send-order-email function:', error);
    return new Response(
      JSON.stringify({ error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
