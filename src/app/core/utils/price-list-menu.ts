import {
  PriceListComboDto,
  PriceListProductDto,
  WaiterPriceListCategoryDto,
  WaiterPriceListDto,
} from '../models/order.model';

/** Identifica una categoría: "GENERAL", "COMBOS", o el id de la categoría del producto. */
export function categoryKey(category: WaiterPriceListCategoryDto): string {
  return category.isCombo ? 'COMBOS' : category.categoryId === null ? 'GENERAL' : String(category.categoryId);
}

/** Clave de la primera categoría de la lista (normalmente GENERAL), o null si no tiene ninguna. */
export function firstCategoryKey(list: WaiterPriceListDto | null): string | null {
  return list?.categories[0] ? categoryKey(list.categories[0]) : null;
}

export function flattenProducts(lists: WaiterPriceListDto[]): PriceListProductDto[] {
  return lists.flatMap((list) => list.categories.flatMap((category) => category.products));
}

export function flattenCombos(lists: WaiterPriceListDto[]): PriceListComboDto[] {
  return lists.flatMap((list) => list.categories.flatMap((category) => category.combos));
}
