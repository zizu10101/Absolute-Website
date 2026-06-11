// Email sending via Supabase Edge Function (server-side, secure)
// The Resend API key is stored server-side and never exposed to the client

import { supabase } from '../supabase';

export interface OrderEmail {
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

// Call Supabase Edge Function to send emails
const callEdgeFunction = async (order: OrderEmail): Promise<{ success: boolean; customer: any; store: any }> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-order-email', {
      body: order,
    });

    if (error) {
      console.error('Edge function error:', error);
      return {
        success: false,
        customer: { error: error.message },
        store: { error: error.message },
      };
    }

    return data || { success: false, customer: { error: 'No response' }, store: { error: 'No response' } };
  } catch (error) {
    console.error('Error calling edge function:', error);
    return {
      success: false,
      customer: { error: error instanceof Error ? error.message : 'Unknown error' },
      store: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
};

// Send both customer and store emails
export const sendOrderEmails = async (
  order: OrderEmail
): Promise<{ customer: boolean; store: boolean }> => {
  try {
    const result = await callEdgeFunction(order);

    return {
      customer: result.customer?.success || false,
      store: result.store?.success || false,
    };
  } catch (error) {
    console.error('Error sending order emails:', error);
    return {
      customer: false,
      store: false,
    };
  }
};

// For backwards compatibility - individual email functions
// These now call the edge function which handles everything
export const sendCustomerEmail = async (order: OrderEmail): Promise<boolean> => {
  const result = await sendOrderEmails(order);
  return result.customer;
};

export const sendStoreEmail = async (order: OrderEmail): Promise<boolean> => {
  const result = await sendOrderEmails(order);
  return result.store;
};
