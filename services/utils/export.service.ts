import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export type ExportColumn = {
    header: string;
    dataKey: string;
};

export type ExportOptions = {
    filename: string;
    columns: ExportColumn[];
    data: any[];
};

export const exportToPDF = (options: ExportOptions) => {
    const doc = new jsPDF();
    const { filename, columns, data } = options;

    const tableHeaders = columns.map(col => col.header);
    const tableData = data.map(row => columns.map(col => row[col.dataKey] ?? ''));

    doc.text(filename, 14, 15);

    autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [253, 36, 160] }, // #fd24a0
    });

    doc.save(`${filename}.pdf`);
};

export const exportToExcel = (options: ExportOptions, format: 'xls' | 'xlsx' | 'csv') => {
    const { filename, columns, data } = options;

    // Map data to header labels
    const mappedData = data.map(row => {
        const newRow: any = {};
        columns.forEach(col => {
            newRow[col.header] = row[col.dataKey] ?? '';
        });
        return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(mappedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

    if (format === 'csv') {
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
        // Add UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvOutput], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        XLSX.writeFile(workbook, `${filename}.${format}`);
    }
};
