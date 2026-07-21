// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EstimateProvider, useEstimate } from './EstimateContext';
import type { ReferenceData } from '@/lib/calc';

const referenceData: ReferenceData = {
  materialItems: [
    { key: 'bom-3', type: 'DC Power Plant', manufacturer: 'Vertiv', model: '582137200', description: 'NetSure 5100', vendor: 'Anixter', category: 'DAS Materials', unitCost: 4685 },
  ],
  laborTasks: [],
  laborRates: [
    { role: 'Technician', hourlyRate: 85, rawWageRate: 85 },
    { role: 'Construction Manager', hourlyRate: 95, rawWageRate: 95 },
    { role: 'RF-Engineer', hourlyRate: 100, rawWageRate: 75 },
    { role: 'RF-Technician', hourlyRate: 75, rawWageRate: 75 },
    { role: 'Project Coordinator', hourlyRate: 55, rawWageRate: 55 },
    { role: 'Project Manager', hourlyRate: 100, rawWageRate: 100 },
  ],
  crewSizeTable: [{ technicianCount: 4, cmsNeeded: 1 }],
  laborProjectionSettings: {
    hoursPerManDay: 8, hoursPerManWeek: 40, stagingMaterialMultiplier: 0.05,
    cmPercentOfTechHours: 0.5, pmPercentOfTechHours: 0.25, coordinatorPercentOfTechHours: 0.15,
  },
  passThroughRates: {
    perDiemRateByRole: [], lodgingRateByRole: [], airfareCostByRole: [], rentals: [], softCosts: [],
  },
};

const estimateDefaults = {
  laborMarkupPct: 0.25, passThroughMarkupPct: 0.25, materialMarkupPct: 0.25,
  corporateMarkupPct: 0.05, taxRate: 0.0825, contingencyPct: 0.10,
};

function TestConsumer() {
  const { result, setMaterialQuantity, coverInfo, setCoverInfo } = useEstimate();
  return (
    <div>
      <div data-testid="hardware-total">{result.materials.hardwareTotal}</div>
      <div data-testid="client-name">{coverInfo.client}</div>
      <button onClick={() => setMaterialQuantity('bom-3', 2)}>Set Qty</button>
      <button onClick={() => setCoverInfo({ client: 'Acme Corp' })}>Set Client</button>
    </div>
  );
}

describe('EstimateProvider / useEstimate', () => {
  it('recomputes the result when a material quantity is set', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    expect(screen.getByTestId('hardware-total').textContent).toBe('0');
    fireEvent.click(screen.getByText('Set Qty'));
    // 4685 * 2 = 9370, +10% contingency (937) = 10307
    expect(screen.getByTestId('hardware-total').textContent).toBe('10307');
  });

  it('updates cover info independently of the estimate calculation', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    fireEvent.click(screen.getByText('Set Client'));
    expect(screen.getByTestId('client-name').textContent).toBe('Acme Corp');
  });
});
