import { describe, expect, it } from 'vitest';
import { computeQuotationTotals, normalizeQuotationNumber } from './quotationService';

describe('quotation calculations', () => {
  it('calculates item totals, VAT, item cost and GP', () => {
    const totals = computeQuotationTotals([
      { id: '1', quantity: 2, unitPrice: 125.5, unitCost: 80 },
      { id: '2', quantity: 1, unitPrice: 49, unitCost: 20 },
    ], [], 7);

    expect(totals).toEqual({
      subtotal: 300,
      vatPercent: 7,
      vatAmount: 21,
      grandTotal: 321,
      totalProposedCost: 0,
      totalItemCost: 180,
      totalCost: 180,
      grossProfit: 120,
      gpPercent: 40,
    });
  });

  it('uses positive SB cost notes as the cost basis', () => {
    const totals = computeQuotationTotals(
      [{ id: '1', quantity: 2, unitPrice: 500, unitCost: 100 }],
      [
        { id: 'n1', lineNo: 1, proposedCost: 450, sbCost: 300 },
        { id: 'n2', lineNo: 2, proposedCost: 50, sbCost: 25 },
      ],
      7,
    );

    expect(totals.totalProposedCost).toBe(500);
    expect(totals.totalItemCost).toBe(200);
    expect(totals.totalCost).toBe(325);
    expect(totals.grossProfit).toBe(675);
    expect(totals.gpPercent).toBe(67.5);
  });

  it('normalizes formatted numeric input safely', () => {
    expect(normalizeQuotationNumber('1,234.567')).toBe(1234.567);
    expect(normalizeQuotationNumber('not-a-number', 9)).toBe(9);
  });
});
