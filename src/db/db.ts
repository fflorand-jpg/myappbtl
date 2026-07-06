import Dexie, { Table } from 'dexie';
import { ProductionRecap, CalculationLog } from '../types';
import { MachineProcedure } from '../operatingProcedures';

export interface MachineProcedureExtended extends MachineProcedure {
  order: number;
}

export interface CheckedSteps {
  machineId: string;
  steps: number[];
}

export class AppDatabase extends Dexie {
  machines!: Table<MachineProcedureExtended, string>;
  productionRecaps!: Table<ProductionRecap, string>;
  history!: Table<CalculationLog, string>;
  checkedSteps!: Table<CheckedSteps, string>;

  constructor() {
    super('BottleProductionDB');
    this.version(2).stores({
      machines: 'id, order',
      productionRecaps: 'dateStr',
      history: 'id',
      checkedSteps: 'machineId'
    });
  }
}

export const db = new AppDatabase();
