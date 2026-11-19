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
  keyWarnings: string;
  cabinet: string;
  shelf: number;
  slot: number;
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
