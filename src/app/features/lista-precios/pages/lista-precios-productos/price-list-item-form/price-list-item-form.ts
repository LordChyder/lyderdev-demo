import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, fromEvent, startWith, takeUntil } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SearchProductEstablishmentDto } from '../../../../../core/models/product-establishment.model';
import { PriceListItemGetForEditDto } from '../../../../../core/models/price-list-item.model';
import { ProductEstablishmentService } from '../../../../../core/services/product-establishment.service';
import { PriceListItemService } from '../../../../../core/services/price-list-item.service';

export interface PriceListItemFormData {
  priceListId: number;
  item: PriceListItemGetForEditDto | null;
}

/**
 * Vincula un producto del establecimiento activo a una lista de precios
 * (con su precio y descuento máximo), o edita el de un item existente.
 * No maneja combos (`comboId`) todavía: siempre viaja en null.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
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

  readonly productOptions = signal<SearchProductEstablishmentDto[]>([]);
  readonly filteredProductOptions = signal<SearchProductEstablishmentDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    productSearch: [
      { value: null as SearchProductEstablishmentDto | string | null, disabled: this.isEdit },
      [Validators.required],
    ],
    // El producto no se puede cambiar al editar: cada item de la lista de
    // precios está atado a un producto puntual, así que el select va
    // deshabilitado y solo sirve para mostrar cuál es.
    productEstablishmentId: [
      { value: this.data.item?.productEstablishmentId ?? (null as number | null), disabled: this.isEdit },
      [Validators.required],
    ],
    isFree: [this.data.item?.isFree ?? false],
    price: [this.data.item?.price ?? 0, [Validators.required, Validators.min(0)]],
    maximumDiscount: [this.data.item?.maximumDiscount ?? 0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
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

    this.productEstablishmentService
      .searchAll()
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (products) => {
          const options = products.filter((item) => item.isActive);
          this.productOptions.set(options);
          this.filterProducts('');
          const selected = options.find(
            (item) => item.productEstablishmentId === this.form.controls.productEstablishmentId.getRawValue(),
          );
          if (selected) this.form.controls.productSearch.setValue(selected, { emitEvent: false });
        },
        error: () => this.error.set('No se pudo cargar la lista de productos.'),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    const request = this.isEdit
      ? this.priceListItemService.update(this.data.item!.id, {
          productEstablishmentId: value.productEstablishmentId,
          comboId: null,
          isFree: value.isFree,
          price: value.price,
          maximumDiscount: value.maximumDiscount,
        })
      : this.priceListItemService.create({
          priceListId: this.data.priceListId,
          productEstablishmentId: value.productEstablishmentId,
          comboId: null,
          isFree: value.isFree,
          price: value.price,
          maximumDiscount: value.maximumDiscount,
        });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar el producto.' : 'No se pudo agregar el producto.',
          );
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

  selectProduct(event: MatAutocompleteSelectedEvent): void {
    const product = event.option.value as SearchProductEstablishmentDto;
    this.form.controls.productEstablishmentId.setValue(product.productEstablishmentId);
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
}
