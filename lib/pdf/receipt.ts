import PDFDocument from 'pdfkit'

interface ReceiptItem {
  id: string
  name: string
  unit: string
  quantity: number
  unitPrice?: string | null
  lineTotal?: string | null
}

interface ReceiptPayload {
  receiptNumber: string
  processedAt: Date | null
  sessionYear: number
  issuedToName: string
  issuedToDepartment?: string | null
  adminName: string
  adminNotes?: string | null
  items: ReceiptItem[]
  collegeName: string
  collegeAddress: string
}

export async function renderReceiptPdf(payload: ReceiptPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width - 100
    const ink = '#1C1917'
    const muted = '#78716C'
    const green = '#166534'
    const border = '#E7E5E4'

    // Watermark
    doc.save()
    doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] })
    doc.fontSize(80).fillColor(ink).fillOpacity(0.04)
    doc.text('STOCK WARDEN', 60, 280, { width: 500, align: 'center' })
    doc.restore()
    doc.fillOpacity(1)

    // Header
    doc.fontSize(16).fillColor(ink).font('Helvetica-Bold')
    doc.text(payload.collegeName, 50, 50)
    doc.fontSize(9).fillColor(muted).font('Helvetica')
    doc.text(payload.collegeAddress, 50, 70)

    doc.fontSize(20).fillColor(ink).font('Helvetica-Bold')
    doc.text('STOCK RECEIPT', 50, 50, { width: W, align: 'right' })

    doc.moveTo(50, 100).lineTo(50 + W, 100).strokeColor(border).lineWidth(0.5).stroke()

    // Meta
    const date = payload.processedAt
      ? payload.processedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-'
    doc.fontSize(9).fillColor(muted).font('Helvetica')
    doc.text(`Receipt No: ${payload.receiptNumber}`, 50, 110)
    doc.text(`Date: ${date}`, 50, 123)
    doc.text(`Session Year: ${payload.sessionYear}`, 50, 136)

    // Issued to block
    doc.rect(50, 154, W, 46).fillColor('#F7F5F2').fill()
    doc.fillColor(ink).fontSize(8).font('Helvetica-Bold')
    doc.text('ISSUED TO', 60, 162)
    doc.font('Helvetica').fontSize(10).fillColor(ink)
    doc.text(payload.issuedToName, 60, 174)
    if (payload.issuedToDepartment) {
      doc.fontSize(9).fillColor(muted)
      doc.text(payload.issuedToDepartment, 60, 186)
    }

    // Table
    const tableTop = 214
    const cols = { name: 50, qty: 300, unit: 340, price: 390, total: 450 }

    doc.rect(50, tableTop, W, 18).fillColor('#F0EDE8').fill()
    doc.fontSize(8).fillColor(muted).font('Helvetica-Bold')
    const headers: [string, number][] = [
      ['ITEM', cols.name],
      ['QTY', cols.qty],
      ['UNIT', cols.unit],
      ['UNIT PRICE', cols.price],
      ['TOTAL', cols.total],
    ]
    headers.forEach(([label, x]) => doc.text(label, x, tableTop + 5, { width: 55 }))

    let y = tableTop + 22
    for (const item of payload.items) {
      doc.moveTo(50, y - 2).lineTo(50 + W, y - 2).strokeColor(border).lineWidth(0.3).stroke()
      doc.fontSize(9).fillColor(ink).font('Helvetica')

      const name = item.name.length > 32 ? item.name.slice(0, 29) + '...' : item.name
      doc.text(name, cols.name, y, { width: 240 })
      doc.text(String(item.quantity), cols.qty, y, { width: 35, align: 'right' })
      doc.text(item.unit, cols.unit, y, { width: 45 })

      doc.fillColor(item.unitPrice ? ink : muted)
      doc.text(item.unitPrice ? `₹${Number(item.unitPrice).toFixed(2)}` : '—', cols.price, y, { width: 55, align: 'right' })
      doc.text(item.lineTotal ? `₹${Number(item.lineTotal).toFixed(2)}` : '—', cols.total, y, { width: 70, align: 'right' })

      y += 18
    }

    // Summary divider
    y += 6
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#A8A29E').lineWidth(0.5).stroke()
    y += 10

    const totalAmt = payload.items.reduce((s, i) => s + (i.lineTotal ? Number(i.lineTotal) : 0), 0)
    const hasAny = payload.items.some((i) => i.lineTotal)
    const hasUnpriced = payload.items.some((i) => !i.unitPrice)

    if (hasAny) {
      doc.moveTo(cols.price, y).lineTo(50 + W, y).strokeColor(border).lineWidth(0.3).stroke()
      y += 6
      doc.fontSize(10).fillColor(green).font('Helvetica-Bold')
      doc.text('Total Amount:', cols.price, y, { width: 100 })
      doc.text(
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmt),
        cols.total, y, { width: 70, align: 'right' }
      )
      y += 18
    }

    if (hasUnpriced) {
      doc.fontSize(8).fillColor(muted).font('Helvetica-Oblique')
      doc.text('* Unit price not set for some items. They are excluded from the total.', 50, y, { width: W })
      y += 14
    }

    if (payload.adminNotes) {
      y += 6
      doc.fontSize(9).fillColor(muted).font('Helvetica')
      doc.text(`Remarks: ${payload.adminNotes}`, 50, y, { width: W })
    }

    // Signature
    const sigY = doc.page.height - 120
    doc.moveTo(350, sigY + 28).lineTo(50 + W, sigY + 28).strokeColor(ink).lineWidth(0.4).stroke()
    doc.fontSize(9).fillColor(muted).font('Helvetica')
    doc.text(`Authorised by: ${payload.adminName}`, 350, sigY + 32, { width: 200, align: 'center' })

    // Footer
    doc.moveTo(50, doc.page.height - 50).lineTo(50 + W, doc.page.height - 50)
      .strokeColor(border).lineWidth(0.3).stroke()
    doc.fontSize(8).fillColor(muted).font('Helvetica')
    doc.text('This is a system-generated document. Stock Warden', 50, doc.page.height - 40, {
      width: W, align: 'center',
    })

    doc.end()
  })
}
