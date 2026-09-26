import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'In Production', color: 'bg-orange-100 text-orange-700' },
  ready: { label: 'Ready for Pickup', color: 'bg-green-100 text-green-700' },
  delivered: { label: 'Delivered ✅', color: 'bg-zinc-100 text-zinc-600' },
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { label, color } = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${color}`}>
      {label}
    </span>
  );
};

export const ORDER_STATUSES = Object.keys(STATUS_CONFIG);
