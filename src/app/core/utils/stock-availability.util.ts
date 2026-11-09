import { PriceListComboDto } from '../models/order.model';

/**
 * Línea de un borrador de pedido (producto suelto o combo) normalizada para el cálculo de
 * disponibilidad. Un producto (`productEstablishmentId`) o un combo (`comboId`), nunca ambos.
 * `originalQuantity` es la cantidad que esa línea ya tenía reservada antes de editar — 0 en una
 * línea nueva o en un carrito que siempre crea un pedido nuevo (delivery).
 */
export interface StockDraftLine {
  productEstablishmentId: number | null;
  comboId: number | null;
  quantity: number;
  originalQuantity: number;
}

/** Cantidad del producto `productEstablishmentId` en una línea: 1 si es ese producto suelto, la cantidad por combo si es un combo que lo incluye, 0 si no aplica. */
function unitsOfProductInLine(
  line: StockDraftLine,
  productEstablishmentId: number,
  catalogCombos: PriceListComboDto[],
): number {
  if (!line.comboId) {
    return line.productEstablishmentId === productEstablishmentId ? 1 : 0;
  }
  const combo = catalogCombos.find((c) => c.comboId === line.comboId);
  const component = combo?.components.find((c) => c.productEstablishmentId === productEstablishmentId);
  return component?.quantity ?? 0;
}

/**
 * Unidades del producto que el borrador pide ADEMÁS de lo que ya tenía reservado antes de editar
 * (0 en un pedido nuevo, donde nada estaba reservado todavía). El endpoint de disponibilidad ya
 * descuenta las reservas existentes — incluidas las de este mismo pedido — así que solo hay que
 * sumar el incremento neto de cada línea, sin recortar los decrementos a 0: una línea que baja
 * libera stock que otra línea que sube puede usar.
 */
export function extraNeededFor(
  lines: StockDraftLine[],
  productEstablishmentId: number,
  catalogCombos: PriceListComboDto[],
): number {
  return lines.reduce((total, line) => {
    const perUnit = unitsOfProductInLine(line, productEstablishmentId, catalogCombos);
    if (perUnit === 0) return total;
    return total + (line.quantity - line.originalQuantity) * perUnit;
  }, 0);
}

/**
 * Disponible real de un producto considerando el borrador actual: puede ser negativo si el
 * borrador ya pide más de lo disponible. `null` si todavía no se confirmó el stock (en carga o
 * falló la consulta) — en ese caso no se debe bloquear, hay que dejar que valide el backend.
 */
export function availableFor(
  stockAvailability: Record<number, number | null>,
  lines: StockDraftLine[],
  productEstablishmentId: number,
  catalogCombos: PriceListComboDto[],
): number | null {
  const available = stockAvailability[productEstablishmentId];
  if (available === undefined || available === null) return null;
  return available - extraNeededFor(lines, productEstablishmentId, catalogCombos);
}

export function canAddProduct(
  stockAvailability: Record<number, number | null>,
  lines: StockDraftLine[],
  product: { productEstablishmentId: number; hasInventory: boolean },
  catalogCombos: PriceListComboDto[],
  quantity = 1,
): boolean {
  if (!product.hasInventory) return true;
  const available = availableFor(stockAvailability, lines, product.productEstablishmentId, catalogCombos);
  return available !== null && available >= quantity;
}

/** true si algún producto del combo controla inventario. */
export function comboHasInventory(combo: PriceListComboDto): boolean {
  return combo.components.some((component) => component.hasInventory);
}

/**
 * Disponibilidad del combo: por cada producto con inventario, cuántos combos alcanzan según su
 * disponible restante (ya descontando el borrador actual); el mínimo de esos valores es lo que
 * limita. Los productos sin inventario no limitan. `null` si no controla inventario, o si
 * todavía no se confirmó el stock de alguno de sus componentes.
 */
export function availableComboStockFor(
  stockAvailability: Record<number, number | null>,
  lines: StockDraftLine[],
  combo: PriceListComboDto,
  catalogCombos: PriceListComboDto[],
): number | null {
  let min: number | null = null;

  for (const component of combo.components) {
    if (!component.hasInventory) continue;

    const available = availableFor(stockAvailability, lines, component.productEstablishmentId, catalogCombos);
    if (available === null) return null;

    const possibleCombos = Math.floor(available / component.quantity);
    min = min === null ? possibleCombos : Math.min(min, possibleCombos);
  }

  return min;
}

export function canAddCombo(
  stockAvailability: Record<number, number | null>,
  lines: StockDraftLine[],
  combo: PriceListComboDto,
  catalogCombos: PriceListComboDto[],
  quantity = 1,
): boolean {
  if (!comboHasInventory(combo)) return true;
  const available = availableComboStockFor(stockAvailability, lines, combo, catalogCombos);
  return available !== null && available >= quantity;
}
