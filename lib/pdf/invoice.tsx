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
});

interface InvoiceItem {
  id: string;
  name: string;
  unit: string;
  quantityReq: number;
  quantityFul?: number | null;
}

interface InvoicePayload {
  invoiceNumber: string;
  processedAt: Date | null;
  sessionYear: number;
  userName: string;
  userDepartment?: string | null;
  userEmployeeId?: string | null;
  adminName: string;
  adminDesignation?: string | null;
  adminNotes?: string | null;
  items: InvoiceItem[];
  collegeName: string;
  collegeAddress: string;
  collegeSealText: string;
}

export async function renderInvoicePdf(payload: InvoicePayload) {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{payload.collegeName}</Text>
            <Text style={styles.meta}>{payload.collegeAddress}</Text>
          </View>
          <View>
            <Text style={styles.meta}>Invoice No: {payload.invoiceNumber}</Text>
            <Text style={styles.meta}>Date: {payload.processedAt?.toISOString().slice(0, 10)}</Text>
            <Text style={styles.meta}>Session Year: {payload.sessionYear}</Text>
          </View>
        </View>

        <View>
          <Text style={styles.meta}>Issued To</Text>
          <Text>{payload.userName}</Text>
          <Text style={styles.meta}>
            {payload.userDepartment ?? ""} {payload.userEmployeeId ?? ""}
          </Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <View style={[styles.tableRow, { backgroundColor: "#f0f0f0" }]}>
            <Text style={[styles.colName, { fontWeight: "bold" }]}>Item</Text>
            <Text style={[styles.colQty, { fontWeight: "bold" }]}>Qty</Text>
            <Text style={[styles.colUnit, { fontWeight: "bold" }]}>Unit</Text>
          </View>
          {payload.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colName}>{item.name}</Text>
              <Text style={styles.colQty}>{item.quantityFul ?? item.quantityReq}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
            </View>
          ))}
        </View>

        {payload.adminNotes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.meta}>Remarks: {payload.adminNotes}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 24 }}>
          <Text style={styles.meta}>Authorized by: {payload.adminName}</Text>
          <Text style={styles.meta}>{payload.adminDesignation ?? ""}</Text>
        </View>

        <Text style={{ marginTop: 24, fontSize: 9, color: "#aaa" }}>
          {payload.collegeSealText}
        </Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
