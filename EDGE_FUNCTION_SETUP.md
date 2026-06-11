# Supabase Edge Function Setup Guide

## Phase 3B: Server-Side Email Sending

This guide explains how to deploy the Supabase Edge Function for secure email sending.

### Architecture:

**Before (Insecure):**
```
Browser → Resend API (API key exposed in frontend)
```

**After (Secure):**
```
Browser → Supabase Edge Function → Resend API (API key on server)
```

### Prerequisites:

1. **Supabase CLI installed** - Run: `supabase --version`
   - If not installed: `npm install -g supabase`

2. **Supabase project ref**: `nvyfktdhzhujeltkbgrz`

3. **Resend API key** - Get from https://resend.com/api-keys

### Deployment Steps:

#### 1. Login to Supabase CLI

```bash
supabase login
```

Follow the prompts to authenticate with your Supabase account.

#### 2. Link to Project

From the project root directory:

```bash
supabase link --project-ref nvyfktdhzhujeltkbgrz
```

#### 3. Set the Resend API Key as Secret

```bash
supabase secrets set RESEND_API_KEY=your_actual_resend_api_key_here
```

Replace `your_actual_resend_api_key_here` with your actual Resend API key.

**Note:** Secrets are stored securely on Supabase servers. They are NOT committed to git.

#### 4. Deploy the Edge Function

```bash
supabase functions deploy send-order-email
```

This will:
- Package the function code
- Deploy it to your Supabase project
- Make it available at: `https://nvyfktdhzhujeltkbgrz.supabase.co/functions/v1/send-order-email`

#### 5. Verify Deployment

Check the Supabase dashboard:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. You should see `send-order-email` listed

### How It Works:

1. **User places order** at `/checkout`
2. **Order saved to Supabase** `online_orders` table
3. **Client calls Edge Function** with order data
4. **Edge Function** (running on Supabase servers):
   - Receives order data
   - Accesses RESEND_API_KEY from secrets
   - Sends customer confirmation email via Resend
   - Sends store notification email to nabil@golazo.ca and ziad@golazo.ca
   - Returns success/failure to client
5. **Client** is redirected to confirmation page

### Key Security Features:

✅ API key never exposed to browser  
✅ Email logic server-side  
✅ Secrets stored securely  
✅ CORS enabled for cross-origin requests  
✅ Input validation on server  

### Testing:

1. Place an order at `http://localhost:3000/checkout`
2. Check for two emails:
   - **Customer email**: At the email address entered in checkout
   - **Store email**: At nabil@golazo.ca and ziad@golazo.ca

### Troubleshooting:

**Function not found error:**
- Verify deployment: `supabase functions list`
- Check project ref is correct: `nvyfktdhzhujeltkbgrz`

**API key errors:**
- Verify secret is set: `supabase secrets list`
- Re-deploy function: `supabase functions deploy send-order-email`

**Emails not sending:**
- Check Resend dashboard for error logs
- Verify API key is valid
- Check email addresses are correct

**CORS errors:**
- Function includes CORS headers for localhost and any origin
- Safe for development/testing

### Monitoring:

View function logs:

```bash
supabase functions logs send-order-email
```

Or through Supabase dashboard:
1. Go to **Edge Functions** → **send-order-email**
2. Click **Logs** tab

### Files:

- `supabase/functions/send-order-email/index.ts` - Edge function code
- `src/utils/sendEmails.ts` - Updated to call edge function
- `src/pages/CheckoutPage.tsx` - Already calls sendOrderEmails

### Cost:

**Included in Supabase free tier:**
- Edge Functions: 500,000 invocations/month free
- Email sending via Resend: 3000 emails/month free

### Next Steps:

After deployment, the system will automatically:
1. Send order confirmation emails to customers
2. Send store notifications to both team members
3. Log all email activity

No further client-side code changes needed!
