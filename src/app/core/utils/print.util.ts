/**
 * Imprime el contenido de un elemento en un iframe oculto, aislado del resto
 * de la página, en vez del patrón `@media print` + `visibility:hidden` sobre
 * todo el `body`.
 *
 * Ese patrón obliga al navegador a recalcular estilos de TODOS los nodos de
 * la app (Angular Material trae miles) para armar la vista previa de
 * impresión, lo que en una máquina modesta puede dejar el diálogo
 * "Cargando vista previa…" colgado varios segundos o directamente congelar
 * la pestaña. Imprimiendo desde un iframe con solo el ticket clonado, el
 * navegador nunca toca el árbol pesado de la app.
 */
export function printElement(
  element: HTMLElement,
  styles: string,
  title = 'Imprimir',
  paperWidthMm?: number,
  minimumPaperHeightMm?: number,
): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  // El documento se debe maquetar con el ancho físico del papel. Un iframe
  // de 0 px hace que tablas y textos calculen su ancho mínimo y, cuando el
  // navegador lo lleva a una página de 80 mm, el ticket termina diminuto.
  // Lo mantenemos fuera del viewport sin ocultarlo con `display:none`, que
  // impediría medir su contenido y abrir su diálogo de impresión.
  const paperWidthPx = paperWidthMm ? Math.ceil((paperWidthMm * 96) / 25.4) : 1;
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = `${paperWidthPx}px`;
  iframe.style.height = paperWidthMm ? '1000px' : '1px';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = () => iframe.remove();

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>${element.outerHTML}</body></html>`,
  );
  doc.close();

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }

    // Chromium ignora `@page { size: <ancho> auto }` (cae al tamaño Letter
    // por defecto) si no se le da un alto explícito. Medimos el contenido ya
    // renderizado y lo fijamos como alto de página real.
    if (paperWidthMm) {
      const ticket = doc.body.firstElementChild as HTMLElement | null;
      const bodyStyles = win.getComputedStyle(doc.body);
      const verticalPadding =
        Number.parseFloat(bodyStyles.paddingTop) + Number.parseFloat(bodyStyles.paddingBottom);
      const contentHeight = (ticket?.scrollHeight ?? doc.body.scrollHeight) + verticalPadding;
      // Si el contenido es muy corto respecto al ancho (por ejemplo, un
      // arqueo compacto de 80 mm), Chrome lo interpreta como hoja
      // horizontal y algunos drivers térmicos giran el ticket. Un mínimo
      // superior al ancho mantiene inequívocamente el formato vertical.
      const heightMm = Math.max((contentHeight * 25.4) / 96, minimumPaperHeightMm ?? 0);
      const pageSizeOverride = doc.createElement('style');
      pageSizeOverride.textContent = `@page { size: ${paperWidthMm}mm ${heightMm.toFixed(2)}mm; }`;
      doc.head.appendChild(pageSizeOverride);
    }

    win.focus();
    win.print();
    win.addEventListener('afterprint', cleanup, { once: true });
    // Respaldo por si `afterprint` no dispara (pasa en algunos navegadores/casos).
    setTimeout(cleanup, 10000);
  };
}

/** Abre el visor PDF del navegador para imprimir un Blob autenticado, sin descargarlo. */
export function printPdf(pdf: Blob, title = 'Comprobante electrónico'): void {
  const url = URL.createObjectURL(pdf);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = title;
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  const cleanup = () => { URL.revokeObjectURL(url); iframe.remove(); };
  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }
    win.focus();
    win.print();
    win.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(cleanup, 300000);
  };
  iframe.src = url;
  document.body.appendChild(iframe);
}
