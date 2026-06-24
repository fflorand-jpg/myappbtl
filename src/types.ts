export type BottleFormatType = '75cl' | '33cl' | 'custom';

export interface BottleFormat {
  id: BottleFormatType;
  label: string;
  volume: string;
  conveyorDefault: number;
  palletDefaultSize?: number; // Bottles per pallet
}

export interface CalculationInput {
  targetQuantity: number;
  format: BottleFormatType;
  customConveyorQuantity: number;
  palletizerQuantity: number;
}

export interface CalculationResult {
  targetQuantity: number;
  formatLabel: string;
  conveyorQuantity: number;
  palletizerQuantity: number;
  quantityToProduce: number;
  isCompleted: boolean;
}

export interface CalculationLog {
  id: string;
  timestamp: string;
  input: CalculationInput;
  result: CalculationResult;
}

export interface ProductionRecap {
  dateStr: string; // YYYY-MM-DD format
  notes: string;
  photos: (string | null)[]; // Exactly 3 elements, base64 strings or null
}

