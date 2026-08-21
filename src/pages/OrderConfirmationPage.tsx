import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { CheckCircle2, Loader } from 'lucide-react';
import { motion } from 'motion/react';

interface Order {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  province: string;
  postal_code: string;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
}

export function OrderConfirmationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (!orderId) {
      navigate('/');
      return;
    }

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('online_orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (err) {
        console.error('Error fetching order:', err);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [searchParams, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size={32} className="animate-spin text-[#b90014]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">
          Order not found
        </h2>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-[#b90014] text-white font-bold uppercase text-sm hover:bg-[#8a000f] transition-colors rounded"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-8"
      >
        {/* Success Icon */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex justify-center"
        >
          <div className="bg-[#b90014] rounded-full p-4">
            <CheckCircle2 size={48} className="text-white" />
          </div>
        </motion.div>

        {/* Thank You */}
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-4">
            Thank You for Your Order!
          </h1>
          <p className="text-lg text-zinc-600">
            We've received your order and will contact you shortly to arrange payment and delivery.
          </p>
        </div>

        {/* Order Number */}
        <div className="bg-zinc-50 rounded-lg p-8 border border-zinc-100 inline-block">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
            Order Number
          </p>
          <p className="text-3xl font-black text-[#b90014]">{order.id}</p>
        </div>

        {/* Order Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 my-12">
          {/* Customer Info */}
          <div className="text-left">
            <h2 className="text-lg font-black uppercase mb-4 border-b-2 border-zinc-100 pb-4">
              Customer Information
            </h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-zinc-600">Name:</span>{' '}
                <span className="font-bold">
                  {order.customer_first_name} {order.customer_last_name}
                </span>
              </p>
              <p>
                <span className="text-zinc-600">Email:</span>{' '}
                <span className="font-bold">{order.customer_email}</span>
              </p>
              <p>
                <span className="text-zinc-600">Phone:</span>{' '}
                <span className="font-bold">{order.customer_phone}</span>
              </p>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="text-left">
            <h2 className="text-lg font-black uppercase mb-4 border-b-2 border-zinc-100 pb-4">
              Shipping Address
            </h2>
            <div className="space-y-2 text-sm">
              <p className="font-bold">{order.shipping_address}</p>
              <p className="font-bold">
                {order.city}, {order.province}
              </p>
              <p className="font-bold">{order.postal_code}</p>
            </div>
          </div>
        </div>

        {/* Items Ordered */}
        <div className="text-left bg-zinc-50 rounded-lg p-8 border border-zinc-100">
          <h2 className="text-lg font-black uppercase mb-6 border-b-2 border-zinc-100 pb-4">
            Items Ordered
          </h2>
          <div className="space-y-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start pb-4 border-b border-zinc-200 last:border-0 last:pb-0">
                <div>
                  <p className="font-bold text-sm text-zinc-900">{item.name}</p>
                  {item.size && (
                    <p className="text-xs text-zinc-600">Size: {item.size}</p>
                  )}
                  <p className="text-xs text-zinc-600 mt-1">
                    Quantity: {item.quantity}
                  </p>
                </div>
                <p className="font-bold text-[#b90014]">
                  ${(item.quantity * item.price).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 pt-6 border-t border-zinc-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-bold">${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">HST (13%)</span>
              <span className="font-bold">${order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg">
              <span className="font-bold">Total</span>
              <span className="font-black text-[#b90014]">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <h3 className="font-bold text-lg mb-4 text-blue-900">What Happens Next?</h3>
          <ol className="text-left space-y-3 text-sm text-blue-900">
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0">1.</span>
              <span>We'll review your order and contact you at {order.customer_phone}</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0">2.</span>
              <span>We'll arrange payment and confirm your delivery details</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold flex-shrink-0">3.</span>
              <span>Your order will be prepared and shipped to you</span>
            </li>
          </ol>
        </div>

        {/* Contact Info */}
        <div className="py-8 border-t-2 border-zinc-100">
          <p className="text-zinc-600 mb-4">
            Have questions? Contact us directly at{' '}
            <a
              href="tel:9055933600"
              className="font-bold text-[#b90014] hover:underline"
            >
              905-593-3600
            </a>
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-[#b90014] text-white font-bold uppercase text-sm hover:bg-[#8a000f] transition-colors rounded"
        >
          Continue Shopping
        </button>
      </motion.div>
    </div>
  );
}
