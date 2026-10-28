/** Estilos autocontenidos para el ticket de arqueo impreso desde el iframe. */
export const CASH_CLOSING_PRINT_STYLES = `
  /* Alto mayor que el ancho: la ticketera siempre lo recibe en vertical. */
  @page { size: 80mm 90mm; margin: 0; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    width: 80mm;
    margin: 0;
    padding: 2mm 4mm 4mm;
    color: #000;
    background: #fff;
    /* Arial se rasteriza con trazos más cerrados que Courier New en la
       TM-T20, lo que mejora la lectura sin hacer pesado todo el ticket. */
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 400;
    letter-spacing: 0.01em;
    -webkit-text-stroke: 0.08px #000;
  }
  .opening-cashier-panel__closing-report { position: absolute; top: 2mm; right: 4mm; left: 4mm; }
  .opening-cashier-panel__section-heading { text-align: center; }
  .opening-cashier-panel__section-heading mat-icon { display: none; }
  .opening-cashier-panel__section-heading h3 { margin: 0; font-size: 15px; text-transform: uppercase; }
  .opening-cashier-panel__section-heading p { margin: 1mm 0 2mm; }
  .opening-cashier-panel__closing-totals,
  .opening-cashier-panel__print-meta {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1mm 4mm;
    margin: 0;
  }
  .opening-cashier-panel__closing-totals dd,
  .opening-cashier-panel__print-meta dd { margin: 0; text-align: right; }
  .opening-cashier-panel__expected-cash-label,
  .opening-cashier-panel__expected-cash { margin-top: 1mm; padding-top: 1mm; border-top: 1px dashed #000; font-weight: 700; }
  .opening-cashier-panel__expected-cash { font-size: 15px; }
  .opening-cashier-panel__closing-payment-methods { margin-top: 2mm; padding-top: 1.5mm; border-top: 1px dashed #000; }
  .opening-cashier-panel__closing-payment-methods h4 { margin: 0 0 1mm; font-size: 12px; }
  .opening-cashier-panel__closing-payment-methods dl { display: grid; grid-template-columns: 1fr auto; gap: 1mm 4mm; margin: 0; }
  .opening-cashier-panel__closing-payment-methods dd { margin: 0; text-align: right; }
  .opening-cashier-panel__payments-total-label,
  .opening-cashier-panel__payments-total { margin-top: 1mm; padding-top: 1mm; border-top: 1px dashed #000; font-weight: 700; }
  .opening-cashier-panel__closing-note { margin: 2mm 0; padding: 1.5mm 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
  .opening-cashier-panel__print-meta { font-size: 11px; }
`;
