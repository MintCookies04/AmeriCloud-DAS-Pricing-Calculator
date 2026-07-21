'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { buildEstimateResult } from '@/lib/calc';
import type {
  EstimateInput, EstimateResult, LaborTaskLineInput, MarkupInputs,
  MaterialLineInput, PassThroughInput, ReferenceData,
} from '@/lib/calc';
import type { EstimateDefaultsData } from '@/lib/data/loadReferenceData';
import { upsertLine } from './upsertLine';

export interface CoverInfo {
  client: string;
  project: string;
  rfpDate: string;
  bidDueDate: string;
  estimator: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  customerType: string;
  jobSiteAddress: string;
  projectOverview: string;
}

const EMPTY_COVER_INFO: CoverInfo = {
  client: '', project: '', rfpDate: '', bidDueDate: '', estimator: '',
  contactName: '', contactPhone: '', contactEmail: '', customerType: '',
  jobSiteAddress: '', projectOverview: '',
};

interface EstimateContextValue {
  referenceData: ReferenceData;
  coverInfo: CoverInfo;
  setCoverInfo: (patch: Partial<CoverInfo>) => void;
  input: EstimateInput;
  result: EstimateResult;
  setMaterialQuantity: (key: string, quantity: number) => void;
  setContingencyPct: (pct: number) => void;
  setShippingHandling: (amount: number) => void;
  setLoeTaskQuantity: (key: string, quantity: number) => void;
  setSowTaskQuantity: (key: string, quantity: number) => void;
  setTechnicianCount: (count: number) => void;
  setPassThroughs: (patch: Partial<PassThroughInput>) => void;
  setMarkups: (patch: Partial<MarkupInputs>) => void;
}

const EstimateContext = createContext<EstimateContextValue | null>(null);

export function EstimateProvider({
  referenceData,
  estimateDefaults,
  children,
}: {
  referenceData: ReferenceData;
  estimateDefaults: EstimateDefaultsData;
  children: ReactNode;
}) {
  const [coverInfo, setCoverInfoState] = useState<CoverInfo>(EMPTY_COVER_INFO);
  const [materials, setMaterials] = useState<MaterialLineInput[]>([]);
  const [contingencyPct, setContingencyPct] = useState(estimateDefaults.contingencyPct);
  const [shippingHandling, setShippingHandling] = useState(0);
  const [loeTasks, setLoeTasks] = useState<LaborTaskLineInput[]>([]);
  const [sowTasks, setSowTasks] = useState<LaborTaskLineInput[]>([]);
  const [technicianCount, setTechnicianCount] = useState(4);
  const [passThroughs, setPassThroughsState] = useState<PassThroughInput>({
    perDiem: [], lodging: [], travel: [], airfare: [], rentals: [], softCosts: [],
  });
  const [markups, setMarkupsState] = useState<MarkupInputs>({
    laborMarkupPct: estimateDefaults.laborMarkupPct,
    passThroughMarkupPct: estimateDefaults.passThroughMarkupPct,
    materialMarkupPct: estimateDefaults.materialMarkupPct,
    corporateMarkupPct: estimateDefaults.corporateMarkupPct,
    marginTweak: 0,
    taxRate: estimateDefaults.taxRate,
  });

  const input: EstimateInput = useMemo(
    () => ({ materials, contingencyPct, shippingHandling, loeTasks, sowTasks, technicianCount, passThroughs, markups }),
    [materials, contingencyPct, shippingHandling, loeTasks, sowTasks, technicianCount, passThroughs, markups],
  );

  const result = useMemo(() => buildEstimateResult(input, referenceData), [input, referenceData]);

  const value: EstimateContextValue = {
    referenceData,
    coverInfo,
    setCoverInfo: (patch) => setCoverInfoState((prev) => ({ ...prev, ...patch })),
    input,
    result,
    setMaterialQuantity: (key, quantity) => setMaterials((prev) => upsertLine(prev, key, quantity)),
    setContingencyPct,
    setShippingHandling,
    setLoeTaskQuantity: (key, quantity) => setLoeTasks((prev) => upsertLine(prev, key, quantity)),
    setSowTaskQuantity: (key, quantity) => setSowTasks((prev) => upsertLine(prev, key, quantity)),
    setTechnicianCount,
    setPassThroughs: (patch) => setPassThroughsState((prev) => ({ ...prev, ...patch })),
    setMarkups: (patch) => setMarkupsState((prev) => ({ ...prev, ...patch })),
  };

  return <EstimateContext.Provider value={value}>{children}</EstimateContext.Provider>;
}

export function useEstimate(): EstimateContextValue {
  const ctx = useContext(EstimateContext);
  if (!ctx) throw new Error('useEstimate must be used within an EstimateProvider');
  return ctx;
}
