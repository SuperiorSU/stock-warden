import nodemailer from "nodemailer";

interface ApprovedEmailData {
  invoiceNumber: string;
  recipientName: string;
  downloadUrl: string;
}

export async function sendRequestApprovedEmail(to: string, data: ApprovedEmailData) {
  if (!process.env.EMAIL_FROM || !process.env.SMTP_HOST) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  const html = `
    <div style="font-family: Arial, sans-serif; background:#f6f6f6; padding:24px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; padding:24px; border-radius:8px;">
        <h2 style="margin:0 0 12px; color:#1c1917;">Request Approved</h2>
        <p style="margin:0 0 12px; color:#44403c;">Hello ${data.recipientName},</p>
        <p style="margin:0 0 16px; color:#44403c;">Your request has been approved. Invoice #${data.invoiceNumber} is ready.</p>
        <a href="${data.downloadUrl}" style="display:inline-block; background:#166534; color:#ffffff; padding:10px 16px; text-decoration:none; border-radius:4px;">Download Invoice</a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: `Request Approved - Invoice #${data.invoiceNumber}`,
    html,
  });
}
