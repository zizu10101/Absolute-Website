interface SaleTx {
  id: string;
  items: any[];
}

interface ReturnRow {
  transaction_id: string;
  items: any[];
}

export interface ReturnSubtraction {
  name: string;
  size: string;
  qty: number;
  revenue: number;
}

/**
 * Returns per-variantId subtraction amounts for a set of sale transactions and
 * their associated return records.
 *
 * Rules enforced:
 *  - Only return rows whose transaction_id is in the provided sale transactions
 *    are considered (guards against returns for sales outside the date range).
 *  - Return items without a variantId are skipped (can't accurately match).
 *  - Subtraction is capped at the sold qty for that specific transaction
 *    (prevents negative quantities from data errors).
 */
export function computeReturnSubtractions(
  saleTxs: SaleTx[],
  returnsRows: ReturnRow[]
): Record<string, ReturnSubtraction> {
  // txId → variantId → { name, size, qty, price }
  const soldByTx: Record<
    string,
    Record<string, { name: string; size: string; qty: number; price: number }>
  > = {};
  const saleTxIds = new Set<string>();

  saleTxs.forEach(t => {
    saleTxIds.add(t.id);
    (t.items || []).forEach((item: any) => {
      if (!item.variantId) return;
      if (!soldByTx[t.id]) soldByTx[t.id] = {};
      if (!soldByTx[t.id][item.variantId]) {
        soldByTx[t.id][item.variantId] = {
          name: item.name,
          size: item.size || 'One Size',
          qty: 0,
          price: item.price || 0,
        };
      }
      soldByTx[t.id][item.variantId].qty += item.quantity || 1;
    });
  });

  const subtractions: Record<string, ReturnSubtraction> = {};

  returnsRows.forEach(r => {
    if (!saleTxIds.has(r.transaction_id)) return;
    const txSold = soldByTx[r.transaction_id] || {};
    (r.items || []).forEach((item: any) => {
      if (!item.variantId) return;
      const sold = txSold[item.variantId];
      if (!sold) return;
      const returnQty = Math.min(item.returnQuantity || 1, sold.qty);
      if (!subtractions[item.variantId]) {
        subtractions[item.variantId] = { qty: 0, revenue: 0, name: sold.name, size: sold.size };
      }
      subtractions[item.variantId].qty += returnQty;
      subtractions[item.variantId].revenue += (item.pricePerUnit || sold.price) * returnQty;
    });
  });

  return subtractions;
}
