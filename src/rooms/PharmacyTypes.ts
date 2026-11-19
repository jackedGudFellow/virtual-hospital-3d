export interface DrugSpec {
  id: string;
  genericName: string;
  brandExamples: string[];
  strength: string;
  form: string;
  drugClass: string;
  commonUses: string;
  storage: string;
  schedule: string;
  scheduleByCountry?: Record<string, string>;
  keyWarnings: string;
  cabinet: string;
  shelf: number;
  slot: number;
}

export interface StockInfo {
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  isLowStock: boolean;
  isNearExpiry: boolean;
}

export interface CabinetMeta {
  id: string;
  title: string;
  color: string;
  isFridge?: boolean;
  isControlled?: boolean;
}

export const PHARMACY_CABINETS: CabinetMeta[] = [
  { id: 'A', title: 'Analgesics & Antipyretics', color: '#0ea5e9' },
  { id: 'B', title: 'Antibiotics', color: '#10b981' },
  { id: 'C', title: 'Cardiovascular', color: '#ef4444' },
  { id: 'D', title: 'Diabetes & Endocrine', color: '#8b5cf6' },
  { id: 'E', title: 'Respiratory', color: '#06b6d4' },
  { id: 'F', title: 'Gastrointestinal', color: '#f59e0b' },
  { id: 'G', title: 'Neuro & Psych', color: '#6366f1' },
  { id: 'H', title: 'Oncology Support / Antiemetics', color: '#ec4899' },
  { id: 'I', title: 'IV Fluids & Injectables', color: '#3b82f6' },
  { id: 'J', title: 'Fridge (2–8 °C)', color: '#0284c7', isFridge: true },
  { id: 'K', title: 'Controlled Drugs (Locked)', color: '#b91c1c', isControlled: true },
  { id: 'L', title: 'Pediatric & Neonatal', color: '#14b8a6' },
];

/**
 * Deterministic educational stock/batch/expiry simulation per drug.
 */
export function getSimulatedStock(drug: DrugSpec): StockInfo {
  let hash = 0;
  for (let i = 0; i < drug.id.length; i += 1) {
    hash = (hash * 31 + drug.id.charCodeAt(i)) % 997;
  }
  const quantity = 2 + (hash % 36);
  const year = hash % 7 === 0 ? 2026 : 2027 + (hash % 2);
  const month = String(1 + (hash % 12)).padStart(2, '0');
  const batchNumber = `BN-${drug.cabinet}${drug.shelf}${drug.slot}-${1000 + hash}`;
  return {
    quantity,
    batchNumber,
    expiryDate: `${year}-${month}`,
    isLowStock: quantity <= 6,
    isNearExpiry: year === 2026 && Number(month) <= 12,
  };
}
