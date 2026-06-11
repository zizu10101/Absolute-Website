import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { supabase } from '../supabase';
import { sendOrderEmails } from '../utils/sendEmails';
import { AlertCircle, Loader, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CANADIAN_PROVINCES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
];

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  notes: string;
}

interface FormErrors {
  [key: string]: string;
}

const HST_RATE = 0.13;

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, cartTotal, clearCart } = useCart();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    province: CANADIAN_PROVINCES[8], // Ontario default
    postalCode: '',
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = 'Invalid email format';

    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.street.trim()) newErrors.street = 'Street address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.province) newErrors.province = 'Province is required';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Postal code is required';
    else if (!/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(formData.postalCode.replace(/\s/g, '')))
      newErrors.postalCode = 'Invalid postal code format (A1A 1A1)';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validate stock before placing order
  const validateStock = async (): Promise<boolean> => {
    for (const item of items) {
      const { data: variant, error } = await supabase
        .from('product_variants')
        .select('stock_quantity')
        .eq('product_id', item.productId)
        .eq('size', item.size)
        .single();

      if (error || !variant || variant.stock_quantity < item.quantity) {
        setErrors({
          postalCode: `Sorry, ${item.name} (Size ${item.size}) is no longer available in the requested quantity.`,
        });
        return false;
      }
    }
    return true;
  };

  // Reduce stock after order is placed
  const reduceInventory = async () => {
    for (const item of items) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('stock_quantity, id')
        .eq('product_id', item.productId)
        .eq('size', item.size)
        .single();

      if (variant) {
        await supabase
          .from('product_variants')
          .update({
            stock_quantity: Math.max(0, variant.stock_quantity - item.quantity),
          })
          .eq('id', variant.id);
      }
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (items.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setIsLoading(true);

    try {
      // Validate stock before creating order
      const hasStock = await validateStock();
      if (!hasStock) {
        setIsLoading(false);
        return;
      }

      const hstAmount = cartTotal * HST_RATE;
      const orderData = {
        customer_first_name: formData.firstName,
        customer_last_name: formData.lastName,
        customer_email: formData.email,
        customer_phone: formData.phone,
        shipping_address: formData.street,
        city: formData.city,
        province: formData.province,
        postal_code: formData.postalCode,
        notes: formData.notes || null,
        items: items,
        subtotal: cartTotal,
        tax: hstAmount,
        total: cartTotal + hstAmount,
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('online_orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;

      // Reduce inventory for all items
      await reduceInventory();

      // Send order confirmation emails
      await sendOrderEmails({
        orderId: data.id,
        customerEmail: formData.email,
        customerName: `${formData.firstName} ${formData.lastName}`,
        customerPhone: formData.phone,
        shippingAddress: formData.street,
        city: formData.city,
        province: formData.province,
        postalCode: formData.postalCode,
        items: items,
        subtotal: cartTotal,
        tax: hstAmount,
        total: cartTotal + hstAmount,
      });

      // Clear cart
      clearCart();

      // Redirect to confirmation
      navigate(`/order-confirmation?orderId=${data.id}`);
    } catch (err) {
      console.error('Error placing order:', err);
      alert('Error placing order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-6">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">
          Your cart is empty
        </h2>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-[#b90014] text-white font-bold uppercase text-sm hover:bg-[#8a000f] transition-colors rounded"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  const hstAmount = cartTotal * HST_RATE;
  const total = cartTotal + hstAmount;

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-12">
      <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-12">
        Checkout
      </h1>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* LEFT COLUMN - Form */}
        <div className="space-y-8">
          {/* Customer Info Section */}
          <div>
            <h2 className="text-lg font-black uppercase mb-6 border-b-2 border-zinc-100 pb-4">
              Customer Information
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded transition-colors ${
                    errors.firstName
                      ? 'border-red-500 bg-red-50'
                      : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                />
                <AnimatePresence>
                  {errors.firstName && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-red-500 text-xs mt-1"
                    >
                      <AlertCircle size={14} />
                      {errors.firstName}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded transition-colors ${
                    errors.lastName
                      ? 'border-red-500 bg-red-50'
                      : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                />
                <AnimatePresence>
                  {errors.lastName && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-red-500 text-xs mt-1"
                    >
                      <AlertCircle size={14} />
                      {errors.lastName}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded transition-colors ${
                  errors.email
                    ? 'border-red-500 bg-red-50'
                    : 'border-zinc-300 hover:border-zinc-400'
                }`}
              />
              <AnimatePresence>
                {errors.email && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 text-red-500 text-xs mt-1"
                  >
                    <AlertCircle size={14} />
                    {errors.email}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded transition-colors ${
                  errors.phone
                    ? 'border-red-500 bg-red-50'
                    : 'border-zinc-300 hover:border-zinc-400'
                }`}
              />
              <AnimatePresence>
                {errors.phone && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 text-red-500 text-xs mt-1"
                  >
                    <AlertCircle size={14} />
                    {errors.phone}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Shipping Address Section */}
          <div>
            <h2 className="text-lg font-black uppercase mb-6 border-b-2 border-zinc-100 pb-4">
              Shipping Address
            </h2>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                Street Address *
              </label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded transition-colors ${
                  errors.street
                    ? 'border-red-500 bg-red-50'
                    : 'border-zinc-300 hover:border-zinc-400'
                }`}
              />
              <AnimatePresence>
                {errors.street && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 text-red-500 text-xs mt-1"
                  >
                    <AlertCircle size={14} />
                    {errors.street}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded transition-colors ${
                    errors.city
                      ? 'border-red-500 bg-red-50'
                      : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                />
                <AnimatePresence>
                  {errors.city && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-red-500 text-xs mt-1"
                    >
                      <AlertCircle size={14} />
                      {errors.city}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                  Province *
                </label>
                <select
                  name="province"
                  value={formData.province}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded transition-colors ${
                    errors.province
                      ? 'border-red-500 bg-red-50'
                      : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  {CANADIAN_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>
                      {prov}
                    </option>
                  ))}
                </select>
                <AnimatePresence>
                  {errors.province && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-red-500 text-xs mt-1"
                    >
                      <AlertCircle size={14} />
                      {errors.province}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
                Postal Code *
              </label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="A1A 1A1"
                className={`w-full px-4 py-2 border rounded transition-colors ${
                  errors.postalCode
                    ? 'border-red-500 bg-red-50'
                    : 'border-zinc-300 hover:border-zinc-400'
                }`}
              />
              <AnimatePresence>
                {errors.postalCode && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 text-red-500 text-xs mt-1"
                  >
                    <AlertCircle size={14} />
                    {errors.postalCode}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Order Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-700 mb-2">
              Order Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Any special instructions or notes for your order..."
              className="w-full px-4 py-2 border border-zinc-300 rounded hover:border-zinc-400 transition-colors resize-none"
            />
          </div>
        </div>

        {/* RIGHT COLUMN - Order Summary */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-zinc-50 rounded-lg p-8 border border-zinc-100">
            <h2 className="text-lg font-black uppercase mb-6 border-b-2 border-zinc-100 pb-4">
              Order Summary
            </h2>

            {/* Items */}
            <div className="space-y-4 mb-6 pb-6 border-b border-zinc-100 max-h-[400px] overflow-y-auto">
              {items.map((item) => (
                <div key={`${item.productId}-${item.size || 'no-size'}`} className="flex gap-4">
                  <div className="w-16 h-16 flex-shrink-0 bg-white rounded border border-zinc-200 overflow-hidden">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-zinc-900 truncate">{item.name}</p>
                    {item.size && (
                      <p className="text-xs text-zinc-600">Size: {item.size}</p>
                    )}
                    <p className="text-xs text-zinc-600 mt-1">
                      {item.quantity}x ${item.price.toFixed(2)}
                    </p>
                    <p className="font-bold text-sm text-[#b90014]">
                      ${(item.quantity * item.price).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-bold">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">HST (13%)</span>
                <span className="font-bold">${hstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Shipping</span>
                <span className="text-zinc-500 text-xs">Calculated at next step</span>
              </div>
              <div className="border-t border-zinc-200 pt-3 flex justify-between text-lg">
                <span className="font-bold">Total</span>
                <span className="font-black text-[#b90014]">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#b90014] text-white font-bold uppercase text-sm hover:bg-[#8a000f] disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors rounded flex items-center justify-center gap-2"
            >
              {isLoading && <Loader size={16} className="animate-spin" />}
              {isLoading ? 'Placing Order...' : 'Place Order'}
            </button>

            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-zinc-500 text-center mt-4 uppercase tracking-widest flex items-center justify-center gap-1"
            >
              <Mail size={12} />
              Confirmation email will be sent
            </motion.div>
          </div>
        </div>
      </form>
    </div>
  );
}
