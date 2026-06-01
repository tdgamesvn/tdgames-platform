
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

export const exportToPNG = async (elementId: string, fileName: string, theme: 'dark' | 'light') => {
  const element = document.getElementById(elementId);
  if (!element) return;
  const bgColor = theme === 'dark' ? '#0F0F0F' : '#FFFFFF';

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: bgColor,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById(elementId);
        if (clonedEl) {
          clonedEl.style.animation = 'none';
          clonedEl.style.transform = 'none';
          clonedEl.style.transition = 'none';
        }
      }
    });
    const link = document.createElement('a');
    link.download = `${fileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Error exporting PNG:', error);
  }
};

/**
 * Xuất PDF "Fit-to-content" - Tự động đo chiều cao invoice và set @page size
 * để PDF chỉ có 1 trang vừa khít nội dung, không bao giờ bị tách làm 2 trang.
 */
export const exportToPDF = async (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Save original title for the PDF filename
  const originalTitle = document.title;
  document.title = fileName;

  // Measure the invoice element's FULL rendered height (not just visible portion)
  // Use scrollHeight to get the complete height including content below viewport
  const heightPx = Math.max(element.scrollHeight, element.offsetHeight);
  // Convert pixels to mm (96dpi screen: 1mm = 96/25.4 ≈ 3.7795px)
  const heightMm = Math.ceil(heightPx / 3.7795) + 10; // +10mm buffer để bù sai số screen→print DPI

  // Inject a dynamic @page style that matches the invoice size exactly
  const styleId = '__pdf_page_size_override__';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    @page {
      size: 210mm ${heightMm}mm !important;
      margin: 0 !important;
    }
  `;

  // Small delay to ensure the style is applied
  await new Promise(resolve => setTimeout(resolve, 150));

  // Trigger browser print dialog
  window.print();

  // Cleanup
  styleEl.textContent = '';
  document.title = originalTitle;
};


export const exportToExcel = (data: any, fileName: string) => {
  const subtotal = data.items.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0);
  const tax = subtotal * (data.taxRate / 100);
  const total = subtotal + tax;

  const worksheetData = [
    ["TD GAMES COMPANY LIMITED"],
    ["INVOICE REPORT", ""],
    ["Invoice Number", data.invoiceNumber],
    ["Status", data.status.toUpperCase()],
    ["Date", data.issueDate],
    ["Due Date", data.dueDate],
    ["Currency", data.currency],
    [""],
    ["CLIENT DETAILS"],
    ["Name", data.clientInfo.name],
    ["Address", data.clientInfo.address],
    ["Contact", data.clientInfo.contactPerson],
    ["Email", data.clientInfo.email],
    [""],
    ["ITEMIZED SERVICES"],
    ["No.", "Description", "Quantity", "Unit Price", "Total Amount"]
  ];

  data.items.forEach((item: any, index: number) => {
    worksheetData.push([
      index + 1,
      item.description,
      item.quantity,
      item.unitPrice,
      item.quantity * item.unitPrice
    ]);
  });

  worksheetData.push([""]);
  worksheetData.push(["", "", "", "SUBTOTAL", subtotal]);
  worksheetData.push(["", "", "", `TAX (${data.taxRate}%)`, tax]);
  worksheetData.push(["", "", "", "GRAND TOTAL", total]);

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice Data");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToWord = (elementId: string, fileName: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const content = element.innerHTML;
  const sourceHTML = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Invoice</title>
    <style>
      body { font-family: 'Montserrat', Arial, sans-serif; padding: 40px; }
      table { border-collapse: collapse; width: 100%; margin: 20px 0; }
      th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
      .text-primary { color: #FF9500; font-weight: bold; }
    </style>
    </head>
    <body>${content}</body></html>`;

  const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
  const fileDownload = document.createElement("a");
  fileDownload.href = source;
  fileDownload.download = `${fileName}.doc`;
  fileDownload.click();
};
