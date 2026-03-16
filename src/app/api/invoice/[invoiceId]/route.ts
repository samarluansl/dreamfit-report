import { NextRequest, NextResponse } from 'next/server';
import xmlrpc from 'xmlrpc';

const ODOO_URL = process.env.ODOO_URL || 'https://samarluan-sl.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'samarluan-sl';
const ODOO_USERNAME = process.env.ODOO_USERNAME || '';
const ODOO_API_KEY = process.env.ODOO_API_KEY || '';

function createClient(path: string) {
  const url = new URL(ODOO_URL);
  return xmlrpc.createSecureClient({
    host: url.hostname,
    port: 443,
    path,
  });
}

function callXmlrpc(client: xmlrpc.Client, method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params as xmlrpc.Value[], (err: Error | undefined, value: unknown) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

async function getUid(): Promise<number> {
  const common = createClient('/xmlrpc/2/common');
  const uid = await callXmlrpc(common, 'authenticate', [
    ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {},
  ]);
  return uid as number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;
    const id = parseInt(invoiceId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    const uid = await getUid();
    const models = createClient('/xmlrpc/2/object');

    // Get the invoice attachment
    const invoices = await callXmlrpc(models, 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'account.move', 'search_read',
      [[['id', '=', id]]],
      { fields: ['name', 'message_main_attachment_id'] },
    ]) as Array<{ name: string; message_main_attachment_id: [number, string] | false }>;

    if (!invoices.length || !invoices[0].message_main_attachment_id) {
      // Try generating the PDF via report action
      const reportResult = await callXmlrpc(models, 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY,
        'ir.actions.report', 'render_qweb_pdf',
        ['account.report_invoice', [id]],
        {},
      ]) as [string, string];

      if (reportResult && reportResult[0]) {
        const pdfBuffer = Buffer.from(reportResult[0], 'base64');
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="factura-${invoices[0]?.name || id}.pdf"`,
          },
        });
      }

      return NextResponse.json({ error: 'No PDF available' }, { status: 404 });
    }

    // Read attachment data
    const attachmentId = invoices[0].message_main_attachment_id[0];
    const attachments = await callXmlrpc(models, 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY,
      'ir.attachment', 'search_read',
      [[['id', '=', attachmentId]]],
      { fields: ['datas', 'name', 'mimetype'] },
    ]) as Array<{ datas: string; name: string; mimetype: string }>;

    if (!attachments.length || !attachments[0].datas) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const pdfBuffer = Buffer.from(attachments[0].datas, 'base64');
    const fileName = attachments[0].name || `factura-${id}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': attachments[0].mimetype || 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error fetching invoice PDF:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}
