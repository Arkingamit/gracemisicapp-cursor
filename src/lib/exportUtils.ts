import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function exportToCSV(filename: string, headers: string[], rows: any[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: `${filename}.csv`,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: `${filename}.csv`,
        url: result.uri,
        dialogTitle: 'Save or share CSV',
      });
    } catch (e) {
      console.error('Error saving CSV natively:', e);
    }
    return;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToPDF(filename: string, title: string, headers: string[], rows: any[][]) {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60] },
  });

  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = doc.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: `${filename}.pdf`,
        data: base64Data,
        directory: Directory.Cache,
      });
      await Share.share({
        title: `${filename}.pdf`,
        url: result.uri,
        dialogTitle: 'Save or share PDF',
      });
    } catch (e) {
      console.error('Error saving PDF natively:', e);
    }
    return;
  }

  doc.save(`${filename}.pdf`);
}
