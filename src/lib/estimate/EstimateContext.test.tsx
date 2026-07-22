// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EstimateProvider, useEstimate } from './EstimateContext';
import type { ReferenceData } from '@/lib/calc';

const DRAFT_STORAGE_KEY = 'das-estimate-draft-v1';

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
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it('rehydrates a previously-saved draft from localStorage on mount', () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      coverInfo: {
        client: 'Restored Corp', project: '', rfpDate: '', bidDueDate: '', estimator: '',
        contactName: '', contactPhone: '', contactEmail: '', customerType: '',
        jobSiteAddress: '', projectOverview: '',
      },
      materials: [{ key: 'bom-3', quantity: 3 }],
      contingencyPct: 0.10,
      shippingHandling: 0,
      loeTasks: [],
      sowTasks: [],
      technicianCount: 4,
      passThroughs: { perDiem: [], lodging: [], travel: [], airfare: [], rentals: [], softCosts: [] },
      markups: {
        laborMarkupPct: 0.25, passThroughMarkupPct: 0.25, materialMarkupPct: 0.25,
        corporateMarkupPct: 0.05, marginTweak: 0, taxRate: 0.0825,
      },
    }));

    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    expect(screen.getByTestId('client-name').textContent).toBe('Restored Corp');
    // 4685 * 3 = 14055, +10% contingency (1405.5) = 15460.5
    expect(screen.getByTestId('hardware-total').textContent).toBe('15460.5');
  });

  it('persists a dirty estimate to localStorage after the debounce window', () => {
    vi.useFakeTimers();
    try {
      render(
        <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
          <TestConsumer />
        </EstimateProvider>,
      );

      fireEvent.click(screen.getByText('Set Client'));
      expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const stored = JSON.parse(window.localStorage.getItem(DRAFT_STORAGE_KEY)!);
      expect(stored.coverInfo.client).toBe('Acme Corp');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not warn before unload while the estimate is clean', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('warns before unload once the estimate becomes dirty', () => {
    render(
      <EstimateProvider referenceData={referenceData} estimateDefaults={estimateDefaults}>
        <TestConsumer />
      </EstimateProvider>,
    );

    fireEvent.click(screen.getByText('Set Client'));

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
