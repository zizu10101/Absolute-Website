import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Eye, Trash2, CheckCircle2, Clock, X, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export const OnlineOrdersAdmin: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('online_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Restore inventory when order is cancelled
  const restoreInventory = async (order: Order) => {
    try {
      for (const item of order.items) {
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
              stock_quantity: variant.stock_quantity + item.quantity,
            })
            .eq('id', variant.id);
        }
      }
    } catch (err) {
      console.error('Error restoring inventory:', err);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      // If changing to cancelled, restore inventory
      if (newStatus === 'cancelled' && order.status !== 'cancelled') {
        await restoreInventory(order);
      }

      const { error } = await supabase
        .from('online_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        )
      );

      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error('Error updating order:', err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('online_orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;

      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelectedOrder(null);
    } catch (err) {
      console.error('Error deleting order:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={32} className="animate-spin text-[#b90014]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-bold uppercase text-xs whitespace-nowrap rounded transition-all ${
              filter === status
                ? 'bg-[#b90014] text-white'
                : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
            }`}
          >
            {status === 'all' ? 'All Orders' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 border-b-2 border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left font-bold">Order #</th>
              <th className="px-4 py-3 text-left font-bold">Customer</th>
              <th className="px-4 py-3 text-left font-bold">Email</th>
              <th className="px-4 py-3 text-left font-bold">Total</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
              <th className="px-4 py-3 text-left font-bold">Date</th>
              <th className="px-4 py-3 text-center font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No orders found
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3 font-bold">
                    {order.customer_first_name} {order.customer_last_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{order.customer_email}</td>
                  <td className="px-4 py-3 font-bold text-[#b90014]">${order.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        order.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : order.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-1 hover:bg-zinc-200 rounded transition-colors"
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedOrder(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-2xl z-50 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b-2 border-zinc-100">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                      Order Number
                    </p>
                    <h2 className="text-2xl font-black text-[#b90014]">
                      {selectedOrder.id.slice(0, 8).toUpperCase()}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-zinc-100">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                      Customer
                    </p>
                    <p className="font-bold">
                      {selectedOrder.customer_first_name} {selectedOrder.customer_last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                      Email
                    </p>
                    <p className="font-bold">{selectedOrder.customer_email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                      Phone
                    </p>
                    <p className="font-bold">{selectedOrder.customer_phone}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                      Date
                    </p>
                    <p className="font-bold">
                      {new Date(selectedOrder.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="mb-6 pb-6 border-b border-zinc-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    Shipping Address
                  </p>
                  <p className="font-bold">{selectedOrder.shipping_address}</p>
                  <p className="font-bold">
                    {selectedOrder.city}, {selectedOrder.province} {selectedOrder.postal_code}
                  </p>
                </div>

                {/* Items */}
                <div className="mb-6 pb-6 border-b border-zinc-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    Items Ordered
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div>
                          <p className="font-bold">{item.name}</p>
                          {item.size && <p className="text-xs text-zinc-600">Size: {item.size}</p>}
                          <p className="text-xs text-zinc-600">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-bold text-[#b90014]">
                          ${(item.quantity * item.price).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="mb-6 pb-6 border-b border-zinc-100 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Subtotal</span>
                    <span className="font-bold">${selectedOrder.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Tax</span>
                    <span className="font-bold">${selectedOrder.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="font-bold">Total</span>
                    <span className="font-black text-[#b90014]">${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="mb-6 pb-6 border-b border-zinc-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                      Order Notes
                    </p>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap">{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Status Management */}
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                    Order Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(selectedOrder.id, status)}
                        disabled={isDeleting}
                        className={`px-3 py-1 text-xs font-bold uppercase rounded transition-all ${
                          selectedOrder.status === status
                            ? 'bg-[#b90014] text-white'
                            : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 disabled:opacity-50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="flex-1 py-2 px-4 bg-zinc-200 text-zinc-900 font-bold uppercase text-sm rounded hover:bg-zinc-300 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleDeleteOrder(selectedOrder.id)}
                    disabled={isDeleting}
                    className="flex-1 py-2 px-4 bg-red-500 text-white font-bold uppercase text-sm rounded hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isDeleting && <Loader size={14} className="animate-spin" />}
                    Delete Order
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
