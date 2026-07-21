// src/components/EstimatePdfDocument.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { EstimateResult } from '@/lib/calc';
import type { CoverInfo } from '@/lib/estimate/EstimateContext';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica' },
  header: { marginBottom: 16, borderBottom: 2, borderBottomColor: '#0f1e42', paddingBottom: 8 },
  title: { fontSize: 18, color: '#0f1e42', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#48566f' },
  sectionTitle: { fontSize: 12, color: '#0f1e42', marginTop: 16, marginBottom: 6, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { color: '#48566f' },
  value: { fontWeight: 'bold' },
  grandTotal: { marginTop: 16, padding: 10, backgroundColor: '#f4f6fa', flexDirection: 'row', justifyContent: 'space-between' },
  grandTotalLabel: { fontSize: 12, color: '#0f1e42' },
  grandTotalValue: { fontSize: 16, color: '#d8202b', fontWeight: 'bold' },
});

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function EstimatePdfDocument({ coverInfo, result }: { coverInfo: CoverInfo; result: EstimateResult }) {
  const es = result.executiveSummary;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{coverInfo.project || 'Untitled Project'}</Text>
          <Text style={styles.subtitle}>Client: {coverInfo.client || '—'}</Text>
          <Text style={styles.subtitle}>Estimator: {coverInfo.estimator || '—'}</Text>
          <Text style={styles.subtitle}>Job Site: {coverInfo.jobSiteAddress || '—'}</Text>
        </View>

        <Text style={styles.sectionTitle}>Labor</Text>
        <View style={styles.row}><Text style={styles.label}>Operational Labor</Text><Text style={styles.value}>{money(es.operationalLaborCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Admin Labor</Text><Text style={styles.value}>{money(es.opsAdminLaborCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Travel</Text><Text style={styles.value}>{money(es.travelCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Project Labor (billed)</Text><Text style={styles.value}>{money(es.totalProjectLaborBilled)}</Text></View>

        <Text style={styles.sectionTitle}>Pass Throughs</Text>
        <View style={styles.row}><Text style={styles.label}>Per Diem</Text><Text style={styles.value}>{money(es.perDiemCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Lodging</Text><Text style={styles.value}>{money(es.lodgingCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Airfare</Text><Text style={styles.value}>{money(es.airfareCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Rentals</Text><Text style={styles.value}>{money(es.rentalsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Soft Costs</Text><Text style={styles.value}>{money(es.softCostsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Pass Through (billed)</Text><Text style={styles.value}>{money(es.totalPassThroughBilled)}</Text></View>

        <Text style={styles.sectionTitle}>Materials</Text>
        <View style={styles.row}><Text style={styles.label}>Consumable</Text><Text style={styles.value}>{money(es.consumableCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>DAS Materials</Text><Text style={styles.value}>{money(es.dasMaterialsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>BAT Materials</Text><Text style={styles.value}>{money(es.batMaterialsCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Contingency / S&H</Text><Text style={styles.value}>{money(es.materialContingencyAndSH)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Total Materials (billed)</Text><Text style={styles.value}>{money(es.totalMaterialBilled)}</Text></View>

        <Text style={styles.sectionTitle}>Margins</Text>
        <View style={styles.row}><Text style={styles.label}>Total Direct Cost</Text><Text style={styles.value}>{money(es.totalDirectCost)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Gross Margin %</Text><Text style={styles.value}>{(es.grossMarginPercent * 100).toFixed(1)}%</Text></View>
        <View style={styles.row}><Text style={styles.label}>Net Margin %</Text><Text style={styles.value}>{(es.netMarginPercent * 100).toFixed(1)}%</Text></View>

        <View style={styles.grandTotal}>
          <Text style={styles.grandTotalLabel}>Grand Total to Bid (tax included)</Text>
          <Text style={styles.grandTotalValue}>{money(es.grandTotalToBidTaxIncluded)}</Text>
        </View>
      </Page>
    </Document>
  );
}
