import jsPDF from 'jspdf';
import Papa from 'papaparse';

export function exportToJSON(data: any[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${filename}.json`);
}

export function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${filename}.csv`);
}

export function exportToMarkdown(data: any[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  let md = `| ${headers.join(' | ')} |\n`;
  md += `| ${headers.map(() => '---').join(' | ')} |\n`;
  data.forEach(row => {
    md += `| ${headers.map(h => row[h]).join(' | ')} |\n`;
  });
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${filename}.md`);
}

export function exportToPDF(data: any[], title: string, filename: string) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 10, 10);
  doc.setFontSize(10);
  
  let y = 20;
  data.forEach((item, index) => {
    if (y > 280) {
      doc.addPage();
      y = 10;
    }
    doc.text(`${index + 1}. ${item.locationName} (${item.temperature}°C)`, 10, y);
    y += 7;
    doc.text(`   Date: ${item.startDate} to ${item.endDate}`, 10, y);
    y += 10;
  });
  
  doc.save(`${filename}.pdf`);
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
