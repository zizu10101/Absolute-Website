/**
 * Export utilities for reports - CSV and PDF generation
 */

export const downloadCSV = (data: (string | number)[][], filename: string) => {
  const csv = data.map(row =>
    row.map(cell => {
      const str = String(cell);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface SummaryCard {
  label: string;
  value: string;
  icon?: string;
}

interface TableSection {
  type: 'table';
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

interface SummaryCardsSection {
  type: 'summary-cards';
  cards: SummaryCard[];
}

type ReportSection = TableSection | SummaryCardsSection;

export const generatePDF = (options: {
  title: string;
  sections: ReportSection[];
  storeInfo?: {
    name?: string;
    hstNumber?: string;
  };
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${options.title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #09090b;
          background: white;
          padding: 40px;
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          margin-bottom: 40px;
          border-bottom: 2px solid #09090b;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .store-info {
          font-size: 11px;
          color: #52525b;
          margin-top: 8px;
        }
        .store-info p {
          margin: 2px 0;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #09090b;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e4e4e7;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .summary-card {
          border: 1px solid #e4e4e7;
          border-radius: 6px;
          padding: 12px;
          background: #fafafa;
        }
        .summary-card-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #71717a;
          margin-bottom: 4px;
        }
        .summary-card-value {
          font-size: 18px;
          font-weight: 900;
          color: #09090b;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        thead {
          background: #f4f4f5;
          border-bottom: 2px solid #e4e4e7;
        }
        th {
          padding: 8px 12px;
          text-align: left;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #52525b;
        }
        td {
          padding: 8px 12px;
          font-size: 11px;
          border-bottom: 1px solid #e4e4e7;
        }
        tbody tr:nth-child(even) {
          background: #fafafa;
        }
        .total-row {
          font-weight: 700;
          background: #f4f4f5;
          border-top: 2px solid #e4e4e7;
          border-bottom: none;
        }
        .text-right {
          text-align: right;
        }
        @media print {
          body { padding: 0; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${options.title}</h1>
        ${options.storeInfo?.name ? `
          <div class="store-info">
            <p><strong>${options.storeInfo.name}</strong></p>
            ${options.storeInfo.hstNumber ? `<p>HST #: ${options.storeInfo.hstNumber}</p>` : ''}
            <p>Report generated: ${new Date().toLocaleString()}</p>
          </div>
        ` : `<p class="store-info">Report generated: ${new Date().toLocaleString()}</p>`}
      </div>

      ${options.sections.map(section => {
        if (section.type === 'summary-cards') {
          return `
            <div class="section">
              <div class="summary-cards">
                ${section.cards.map(card => `
                  <div class="summary-card">
                    <div class="summary-card-label">${card.label}</div>
                    <div class="summary-card-value">${card.value}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else if (section.type === 'table') {
          return `
            <div class="section">
              <h2 class="section-title">${section.title}</h2>
              <table>
                <thead>
                  <tr>
                    ${section.headers.map(header => `<th>${header}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${section.rows.map((row, idx) => `
                    <tr>
                      ${row.map((cell, cellIdx) => {
                        const isNumeric = cellIdx > 0 && section.headers[cellIdx].includes('#') || section.headers[cellIdx].includes('$') || section.headers[cellIdx].includes('Qty') || section.headers[cellIdx].includes('Revenue') || section.headers[cellIdx].includes('Amount') || section.headers[cellIdx].includes('Spent');
                        return `<td class="${isNumeric ? 'text-right' : ''}">${cell}</td>`;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
        return '';
      }).join('')}
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  // Trigger print dialog after a short delay to ensure content is loaded
  setTimeout(() => {
    printWindow.print();
  }, 250);
};
