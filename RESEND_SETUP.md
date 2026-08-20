# Resend Email Setup Guide

## Phase 3: Email Confirmations

This project uses **Resend** (free tier) to send order confirmation emails.

### Setup Steps:

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up for free account (3000 emails/month included)

2. **Get API Key**
   - Log in to Resend dashboard
   - Go to API Keys section
   - Copy your API key

3. **Add to Environment**
   - Open `.env` file in project root
   - Add the line:
     ```
     VITE_RESEND_API_KEY=your_api_key_here
     ```
   - Replace `your_api_key_here` with your actual Resend API key
   - Save the file

4. **Verify Installation**
   - The project already has `resend` package installed
   - Run `npm run dev` to start the dev server
   - Test by placing an order at `/checkout`

### How It Works:

When a customer places an order:

1. **Customer Email** is sent with:
   - Order confirmation
   - Order number
   - Items ordered with sizes and prices
   - Shipping address
   - Total amount (subtotal + HST)
   - Next steps message

2. **Store Email** is sent to info@edgedbs.com with:
   - Customer information
   - Contact details
   - Shipping address
   - Complete order details
   - Total amount for quick reference

### Email Templates:

Both emails are professionally formatted HTML with:
- Absolute Soccer branding
- Clear order information
- Contact details
- Call to action

### Testing:

During development:
- Emails will be sent from `onboarding@resend.dev`
- In production, you can configure a custom domain

### Limits:

- **Free Tier:** 3000 emails/month (plenty for small business)
- **Enterprise:** Unlimited with custom domain

### Troubleshooting:

If emails aren't sending:
1. Check that `VITE_RESEND_API_KEY` is set in `.env`
2. Verify API key is valid in Resend dashboard
3. Check browser console for any errors
4. Ensure customer email address is valid

### Files Modified:

- `src/utils/sendEmails.ts` - Email sending functions
- `src/pages/CheckoutPage.tsx` - Email integration in checkout
- `.env` - Add VITE_RESEND_API_KEY

### Cost:

**Free** - up to 3000 emails/month on free tier
