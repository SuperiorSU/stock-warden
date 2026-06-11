import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", padding: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 20, fontWeight: "bold" },
  meta: { fontSize: 10, color: "#555" },
  tableRow: { flexDirection: "row", borderBottom: "0.5pt solid #e0e0e0", paddingVertical: 6 },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
});

interface ReceiptItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice?: string | null;
  lineTotal?: string | null;
}

interface ReceiptPayload {
  receiptNumber: string;
  processedAt: Date | null;
  sessionYear: number;
  issuedToName: string;
  issuedToDepartment?: string | null;
  adminName: string;
  adminNotes?: string | null;
  inventoryManagerName: string;
  items: ReceiptItem[];
  collegeName: string;
  collegeAddress: string;
}

export async function renderReceiptPdf(payload: ReceiptPayload) {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{payload.collegeName}</Text>
            <Text style={styles.meta}>{payload.collegeAddress}</Text>
          </View>
          <View>
            <Text style={styles.meta}>Receipt No: {payload.receiptNumber}</Text>
            <Text style={styles.meta}>Date: {payload.processedAt?.toISOString().slice(0, 10)}</Text>
            <Text style={styles.meta}>Session Year: {payload.sessionYear}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.meta}>Issued To</Text>
          <Text>{payload.issuedToName}</Text>
          <Text style={styles.meta}>{payload.issuedToDepartment ?? ''}</Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={[styles.tableRow, { backgroundColor: "#f0f0f0" }]}>
            <Text style={[styles.colName, { fontWeight: "bold" }]}>Item</Text>
            <Text style={[styles.colQty, { fontWeight: "bold" }]}>Qty</Text>
            <Text style={[styles.colUnit, { fontWeight: "bold" }]}>Unit</Text>
            <Text style={[styles.colPrice, { fontWeight: "bold" }]}>Unit Price</Text>
            <Text style={[styles.colPrice, { fontWeight: "bold" }]}>Line Total</Text>
          </View>
          {payload.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colName}>{item.name}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{item.unitPrice ?? '-'}</Text>
              <Text style={styles.colPrice}>{item.lineTotal ?? '-'}</Text>
            </View>
          ))}
        </View>

        {payload.adminNotes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.meta}>Remarks: {payload.adminNotes}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 24, flexDirection: "row", gap: 40 }}>
          <View>
            <Text style={styles.meta}>Approved by (Admin)</Text>
            <Text style={{ fontSize: 11 }}>{payload.adminName}</Text>
          </View>
          <View>
            <Text style={styles.meta}>Allocated by (Inventory Manager)</Text>
            <Text style={{ fontSize: 11 }}>{payload.inventoryManagerName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
