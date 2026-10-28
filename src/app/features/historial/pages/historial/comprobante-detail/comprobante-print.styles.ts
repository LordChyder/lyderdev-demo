/**
 * Estilos CSS para la impresión térmica (80mm) del comprobante desde un iframe aislado.
 */
export const COMPROBANTE_PRINT_STYLES = `
  @page {
    size: 80mm auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 3mm 4mm;
    color: #000;
    background: #fff;
    font-family: 'Courier New', Consolas, monospace;
    font-size: 11px;
    line-height: 1.35;
  }

  p {
    margin: 0 0 1mm;
  }

  .comprobante-detail__ticket {
    display: block !important;
  }

  .ticket-establishment {
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .ticket-title {
    text-align: center;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1px;
    margin: 1.5mm 0;
  }

  .ticket-status-annulled {
    text-align: center;
    font-weight: 700;
    font-size: 12px;
    color: #000;
    border: 1px dashed #000;
    padding: 1.5mm;
    margin: 1.5mm 0;
  }

  .ticket-divider {
    border-top: 1px dashed #000;
    margin: 1.5mm 0;
  }

  .ticket-info {
    margin: 1mm 0;
  }

  .ticket-info p {
    margin: 0.5mm 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 1mm 0;
  }

  th,
  td {
    padding: 0.75mm 0;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }

  th:first-child,
  td:first-child {
    width: 50%;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 20%;
    text-align: center;
  }

  th:last-child,
  td:last-child {
    width: 30%;
    text-align: right;
  }

  thead th {
    border-bottom: 1px dashed #000;
    font-weight: 700;
  }

  .ticket-totals {
    display: grid;
    grid-template-columns: 1fr auto;
    margin: 1.5mm 0 0;
  }

  .ticket-totals dt {
    font-weight: 400;
  }

  .ticket-totals dd {
    margin: 0;
    text-align: right;
  }

  .ticket-totals dt.total-main,
  .ticket-totals dd.total-main {
    font-weight: 700;
    font-size: 12px;
  }

  .ticket-footer {
    text-align: center;
    margin-top: 3mm;
    font-size: 10px;
  }
`;
