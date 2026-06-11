import React from 'react';
import { X, Plus, Minus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../context/CartContext';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const HST_RATE = 0.13;

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { items, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();

  const hstAmount = cartTotal * HST_RATE;
  const totalWithHST = cartTotal + hstAmount;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <h2 className="text-lg font-bold text-zinc-900">Shopping Cart</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-zinc-500">Your cart is empty</p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={`${item.productId}-${item.size || 'no-size'}`}
                    className="flex gap-4 border border-zinc-100 rounded-lg p-4"
                  >
                    {/* Image */}
                    <div className="w-20 h-20 flex-shrink-0 bg-zinc-100 rounded-md overflow-hidden">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-zinc-900 truncate">
                        {item.name}
                      </h3>
                      {item.size && (
                        <p className="text-xs text-zinc-600">Size: {item.size}</p>
                      )}
                      <p className="font-bold text-[#b90014] mt-1">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1, item.size)
                          }
                          className="p-1 hover:bg-zinc-100 rounded transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1, item.size)
                          }
                          className="p-1 hover:bg-zinc-100 rounded transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.productId, item.size)}
                          className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-zinc-100 p-6 space-y-4">
                {/* Pricing */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Subtotal</span>
                    <span className="font-bold">${cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">HST (13%)</span>
                    <span className="font-bold">${hstAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 flex justify-between text-base">
                    <span className="font-bold">Total</span>
                    <span className="font-black text-[#b90014]">
                      ${totalWithHST.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button
                    onClick={onClose}
                    className="w-full py-3 bg-[#b90014] text-white font-bold uppercase text-sm hover:bg-[#8a000f] transition-colors rounded"
                  >
                    Continue Shopping
                  </button>
                  <button className="w-full py-3 bg-zinc-900 text-white font-bold uppercase text-sm hover:bg-zinc-800 transition-colors rounded">
                    Proceed to Checkout
                  </button>
                  <button
                    onClick={clearCart}
                    className="w-full py-2 text-zinc-600 font-bold uppercase text-xs hover:text-zinc-900 transition-colors"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
