import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, finalize, fromEvent, startWith, takeUntil } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SearchProductEstablishmentDto } from '../../../../../core/models/product-establishment.model';
import { SearchComboDto } from '../../../../../core/models/combo.model';
import { PriceListItemGetForEditDto, SearchPriceListItemDto } from '../../../../../core/models/price-list-item.model';
import { ProductEstablishmentService } from '../../../../../core/services/product-establishment.service';
import { ComboService } from '../../../../../core/services/combo.service';
import { PriceListItemService } from '../../../../../core/services/price-list-item.service';

export type PriceListItemKind = 'PRODUCT' | 'COMBO';

export interface PriceListItemFormData {
  priceListId: number;
  item: PriceListItemGetForEditDto | null;
  /** Items ya vinculados a la lista: sirve para no ofrecerlos de nuevo en los autocompletes. */
  existingItems: SearchPriceListItemDto[];
}

/**
 * Vincula un producto o un combo del establecimiento activo a una lista de
 * precios (con su precio y descuento máximo), o edita el de un item
 * existente. El tipo y el producto/combo no se pueden cambiar al editar.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-price-list-item-form',
  styleUrl: './price-list-item-form.scss',
  templateUrl: './price-list-item-form.html',
})
export class PriceListItemForm implements AfterViewInit, OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly comboService = inject(ComboService);
  private readonly priceListItemService = inject(PriceListItemService);
  private readonly dialogRef = inject(MatDialogRef<PriceListItemForm>);
  private readonly data = inject<PriceListItemFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  @ViewChild(MatAutocompleteTrigger)
  private productAutocompleteTrigger?: MatAutocompleteTrigger;

  readonly isEdit = !!this.data.item;
  readonly loadingOptions = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly isFree = signal(this.data.item?.isFree ?? false);

  readonly itemKind = signal<PriceListItemKind>(this.data.item?.comboId ? 'COMBO' : 'PRODUCT');

  readonly productOptions = signal<SearchProductEstablishmentDto[]>([]);
  readonly filteredProductOptions = signal<SearchProductEstablishmentDto[]>([]);

  readonly comboOptions = signal<SearchComboDto[]>([]);
  readonly filteredComboOptions = signal<SearchComboDto[]>([]);
  readonly loadingCombos = signal(false);

  private readonly excludedProductEstablishmentIds = new Set(
    this.data.existingItems
      .filter((item) => item.productEstablishmentId != null)
      .map((item) => item.productEstablishmentId as number),
  );

  private readonly excludedComboIds = new Set(
    this.data.existingItems
      .filter((item) => item.comboId != null)
      .map((item) => item.comboId as number),
  );

  readonly form = this.fb.nonNullable.group({
    productSearch: [
      { value: null as SearchProductEstablishmentDto | string | null, disabled: this.isEdit },
    ],
    // El producto no se puede cambiar al editar: cada item de la lista de
    // precios está atado a un producto o combo puntual, así que el select va
    // deshabilitado y solo sirve para mostrar cuál es.
    productEstablishmentId: [
      { value: this.data.item?.productEstablishmentId ?? (null as number | null), disabled: this.isEdit },
    ],
    comboSearch: [
      { value: null as SearchComboDto | string | null, disabled: this.isEdit },
    ],
    comboId: [
      { value: this.data.item?.comboId ?? (null as number | null), disabled: this.isEdit },
    ],
    isFree: [this.data.item?.isFree ?? false],
    price: [this.data.item?.price ?? 0, [Validators.required, Validators.min(0)]],
    maximumDiscount: [this.data.item?.maximumDiscount ?? 0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.applyKindValidators(this.itemKind());

    this.form.controls.isFree.valueChanges
      .pipe(startWith(this.form.controls.isFree.value), takeUntil(this.destroy$))
      .subscribe((isFree) => this.updatePriceAvailability(isFree));

    this.form.controls.productSearch.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.form.controls.productEstablishmentId.setValue(null);
          this.filterProducts(value);
        }
      });

    this.form.controls.comboSearch.valueChanges
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value === 'string') {
          this.form.controls.comboId.setValue(null);
          this.searchCombos(value);
        }
      });

    this.productEstablishmentService
      .searchAll()
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (products) => {
          const options = products.filter(
            (item) => item.isActive && !this.excludedProductEstablishmentIds.has(item.productEstablishmentId),
          );
          this.productOptions.set(options);
          this.filterProducts('');
          const selected = options.find(
            (item) => item.productEstablishmentId === this.form.controls.productEstablishmentId.getRawValue(),
          );
          if (selected) this.form.controls.productSearch.setValue(selected, { emitEvent: false });
        },
        error: () => this.error.set('No se pudo cargar la lista de productos.'),
      });

    if (this.itemKind() === 'COMBO') {
      this.searchCombos('');
    }

    if (this.isEdit && this.data.item?.comboId) {
      this.comboService
        .getForEdit(this.data.item.comboId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (combo) =>
            this.form.controls.comboSearch.setValue(
              { id: combo.id, name: combo.name, isActive: combo.isActive, items: 1 },
              { emitEvent: false },
            ),
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectKind(kind: PriceListItemKind): void {
    if (this.isEdit || this.itemKind() === kind) return;
    this.itemKind.set(kind);
    this.applyKindValidators(kind);

    if (kind === 'COMBO' && this.comboOptions().length === 0 && !this.loadingCombos()) {
      this.searchCombos('');
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();
    const isCombo = this.itemKind() === 'COMBO';

    const payload = {
      productEstablishmentId: isCombo ? null : value.productEstablishmentId,
      comboId: isCombo ? value.comboId : null,
      isFree: value.isFree,
      price: value.isFree ? 0 : value.price,
      maximumDiscount: value.maximumDiscount,
    };

    const request = this.isEdit
      ? this.priceListItemService.update(this.data.item!.id, payload)
      : this.priceListItemService.create({ priceListId: this.data.priceListId, ...payload });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (response) => {
          const backendMessage = response?.error?.message as string | undefined;
          const defaultMessage = isCombo
            ? this.isEdit
              ? 'No se pudo actualizar el combo.'
              : 'No se pudo agregar el combo.'
            : this.isEdit
              ? 'No se pudo actualizar el producto.'
              : 'No se pudo agregar el producto.';
          this.error.set(backendMessage || defaultMessage);
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  ngAfterViewInit(): void {
    fromEvent(document, 'scroll', { capture: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.productAutocompleteTrigger?.closePanel());
  }

  displayProduct(product: SearchProductEstablishmentDto | string | null): string {
    if (typeof product === 'string') return product;
    if (!product) return '';
    return product.complementaryName
      ? `${product.productName} (${product.complementaryName})`
      : product.productName ?? '';
  }

  displayCombo(combo: SearchComboDto | string | null): string {
    if (typeof combo === 'string') return combo;
    if (!combo) return '';
    return combo.name ?? '';
  }

  selectProduct(event: MatAutocompleteSelectedEvent): void {
    const product = event.option.value as SearchProductEstablishmentDto;
    this.form.controls.productEstablishmentId.setValue(product.productEstablishmentId);
  }

  selectCombo(event: MatAutocompleteSelectedEvent): void {
    const combo = event.option.value as SearchComboDto;
    this.form.controls.comboId.setValue(combo.id);
  }

  private applyKindValidators(kind: PriceListItemKind): void {
    const productControl = this.form.controls.productEstablishmentId;
    const comboControl = this.form.controls.comboId;

    if (kind === 'PRODUCT') {
      productControl.setValidators([Validators.required]);
      comboControl.clearValidators();
      comboControl.setValue(null);
      this.form.controls.comboSearch.setValue(null);
    } else {
      comboControl.setValidators([Validators.required]);
      productControl.clearValidators();
      productControl.setValue(null);
      this.form.controls.productSearch.setValue(null);
    }

    productControl.updateValueAndValidity({ emitEvent: false });
    comboControl.updateValueAndValidity({ emitEvent: false });
  }

  private updatePriceAvailability(isFree: boolean): void {
    this.isFree.set(isFree);
    const priceControl = this.form.controls.price;

    if (isFree) {
      priceControl.setValue(0, { emitEvent: false });
      priceControl.disable({ emitEvent: false });
      return;
    }

    priceControl.enable({ emitEvent: false });
  }

  private filterProducts(term: string): void {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    this.filteredProductOptions.set(this.productOptions().filter((product) =>
      !normalizedTerm || this.displayProduct(product).toLocaleLowerCase().includes(normalizedTerm),
    ));
  }

  private searchCombos(filterTerm: string): void {
    this.loadingCombos.set(true);
    this.comboService
      .search({ pageIndex: 1, pageSize: 50, filter: filterTerm || undefined })
      .pipe(
        finalize(() => this.loadingCombos.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          const options = (response.items ?? []).filter(
            (combo) => combo.isActive && combo.items > 0 && !this.excludedComboIds.has(combo.id),
          );
          this.comboOptions.set(options);
          this.filteredComboOptions.set(options);
        },
        error: () => this.error.set('No se pudo cargar la lista de combos.'),
      });
  }
}
