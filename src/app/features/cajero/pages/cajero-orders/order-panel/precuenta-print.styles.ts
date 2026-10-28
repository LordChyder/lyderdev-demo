/**
 * CSS plano (no SCSS) para el documento del iframe de impresión de la
 * precuenta — ver `printElement()` en `core/utils/print.util.ts`. Al ser un
 * `<head><style>` propio, sin el resto de los estilos de la app, hay que
 * declarar todo lo necesario acá (no hereda nada de styles.scss).
 */
export const PRECUENTA_PRINT_STYLES = `
  @page {
    size: 80mm auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  html {
    /* Evita que Chromium atenúe el negro para ahorrar tinta al imprimir. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    margin: 0;
    /* Epson TM-T20-IV: deja ~72 mm de área útil sobre rollo de 80 mm. */
    width: 80mm;
    padding: 1.5mm 4mm 3mm;
    color: #000 !important;
    background: #fff;
    font-family: 'Courier New', Consolas, monospace;
    /* Equivalente web de la Font B a doble escala del printer-agent. */
    font-size: 13px;
    font-weight: 700;
    line-height: 1.38;
    /* Refuerzo mínimo del trazo: aumenta la cobertura térmica sin usar negrita. */
    -webkit-text-stroke: 0.12px #000;
  }

  /* El iframe de impresión no participa en el flujo de la app. Anclar el
     ticket al inicio de la hoja evita que el motor de impresión lo centre
     dentro del alto temporal del documento. */
  .order-panel__precuenta {
    position: absolute;
    top: 1.5mm;
    right: 4mm;
    left: 4mm;
  }

  .order-panel__precuenta-establishment {
    margin: 0;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.25;
    text-transform: uppercase;
  }

  .order-panel__precuenta-title {
    margin: 1.5mm 0 1mm;
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1.2px;
  }

  .order-panel__precuenta-table {
    margin: 0 0 1mm;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
  }

  .order-panel__precuenta-divider {
    border-top: 1px dashed #000;
    margin: 2mm 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0;
  }

  th,
  td {
    padding: 0.8mm 0;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }

  th:nth-child(2),
  td:nth-child(2) {
    width: 16%;
    padding: 0 1.25mm;
    text-align: center;
    white-space: nowrap;
  }

  th:last-child,
  td:last-child {
    width: 27%;
    text-align: right;
  }

  thead th {
    border-bottom: 1px dashed #000;
    font-weight: 700;
  }

  .order-panel__precuenta-unit-price {
    display: block;
    font-size: 11px;
    color: #000;
  }

  .order-panel__precuenta-totals {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.6mm 4mm;
    /* Margen de seguridad antes del corte de la ticketera. */
    margin: 0.5mm 0 4mm;
  }

  .order-panel__precuenta-totals dt {
    font-weight: 700;
  }

  .order-panel__precuenta-totals dd {
    margin: 0;
    text-align: right;
  }

  .order-panel__precuenta-totals dt:first-of-type,
  .order-panel__precuenta-totals dd:first-of-type {
    font-weight: 700;
    font-size: 16px;
  }

  .order-panel__precuenta-footer {
    text-align: center;
    margin: 3mm 0 0;
    font-size: 12px;
  }
`;
