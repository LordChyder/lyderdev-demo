import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, finalize, forkJoin, of, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SearchCategoryDto } from '../../../../core/models/category.model';
import { CategoryService } from '../../../../core/services/category.service';
import { SearchMeasureUnitDto } from '../../../../core/models/measure-unit.model';
import { MeasureUnitService } from '../../../../core/services/measure-unit.service';
import { ProductDestinationDto } from '../../../../core/models/product-establishment.model';
import { ProductEstablishmentService } from '../../../../core/services/product-establishment.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ProductService } from '../../../../core/services/product.service';

/**
 * Único valor que expone hoy el enum `ProductType` del backend.
 * Cuando el backend agregue más tipos, esto pasa a ser un <mat-select>.
 */
const DEFAULT_PRODUCT_TYPE = 0;

/**
 * Página (no modal) para crear o editar un producto.
 *
 * Crear usa POST /product/with-establishment, que crea el producto del
 * catálogo y lo vincula al establecimiento activo (header EstablishmentId)
 * en una sola operación atómica — devuelve `{ productId, productEstablishmentId }`.
 *
 * OJO: antes esto se hacía en dos pasos separados (POST /product +
 * POST /product-establishment), con un workaround para volver a buscar el
 * producto recién creado porque POST /product no devolvía su id. Ya no hace
 * falta: se dejó de usar ese flujo cuando el backend agregó este endpoint.
 *
 * Editar (ruta `editar/:productId/:productEstablishmentId`) usa el mismo
 * form: precarga con GET /product/{id}/get-for-edit (campos del catálogo) +
 * GET /product-establishment/{id}/get-for-edit (campos del vínculo con el
 * establecimiento activo), y guarda con
 * PUT /product/{productId}/with-establishment/{productEstablishmentId}.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-producto-form',
  styleUrl: './producto-form.scss',
  templateUrl: './producto-form.html',
})
export class ProductoForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly measureUnitService = inject(MeasureUnitService);
  private readonly categoryService = inject(CategoryService);
  private readonly permissionService = inject(PermissionService);

  private readonly destroy$ = new Subject<void>();

  /** `null` en modo "crear"; en modo "editar" son los ids de la ruta. */
  private readonly productId = this.route.snapshot.paramMap.get('productId')
    ? Number(this.route.snapshot.paramMap.get('productId'))
    : null;
  private readonly productEstablishmentId = this.route.snapshot.paramMap.get(
    'productEstablishmentId',
  )
    ? Number(this.route.snapshot.paramMap.get('productEstablishmentId'))
    : null;

  readonly isEdit = this.productId !== null && this.productEstablishmentId !== null;

  /** Campos que el form no edita pero hay que reenviar tal cual al guardar. */
  private originalProductType = DEFAULT_PRODUCT_TYPE;
  private originalImageName: string | null = null;

  readonly loadingOptions = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly measureUnitOptions = signal<SearchMeasureUnitDto[]>([]);
  readonly destinationOptions = signal<ProductDestinationDto[]>([]);
  readonly categoryOptions = signal<SearchCategoryDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    barcode: [''],
    measureUnitId: [null as number | null, [Validators.required]],
    complementaryName: [''],
    hasInventory: [true],
    weight: [null as number | null],
    productDestination: [1, [Validators.required]],
    categoryId: [null as number | null],
  });

  ngOnInit(): void {
    forkJoin({
      measureUnits: this.measureUnitService.research(),
      destinations: this.productEstablishmentService.getDestinations(),
      categories: this.categoryService.research(),
      product: this.isEdit ? this.productService.getForEdit(this.productId!) : of(null),
      productEstablishment: this.isEdit
        ? this.productEstablishmentService.getForEdit(this.productEstablishmentId!)
        : of(null),
    })
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ measureUnits, destinations, categories, product, productEstablishment }) => {
          this.measureUnitOptions.set(measureUnits.filter((unit) => unit.isActive));
          this.destinationOptions.set(destinations);
          this.categoryOptions.set(categories);

          if (product) {
            this.originalProductType = product.productType;
            this.originalImageName = product.imageName;
            this.form.patchValue({
              name: product.name ?? '',
              barcode: product.barcode ?? '',
              measureUnitId: product.measureUnitId,
            });
          }
          if (productEstablishment) {
            this.form.patchValue({
              complementaryName: productEstablishment.complementaryName ?? '',
              hasInventory: productEstablishment.hasInventory,
              weight: productEstablishment.weight,
              productDestination: productEstablishment.productDestination,
              categoryId: productEstablishment.categoryId,
            });
          }
        },
        error: () => {
          this.error.set('No se pudo cargar las opciones del formulario.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cancel(): void {
    this.router.navigateByUrl('/productos');
  }

  submit(): void {
    if (!this.permissionService.validate('Product_SaveOrUpdate')) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    const payload = {
      product: {
        productType: this.originalProductType,
        barcode: value.barcode.trim() || null,
        name: value.name.trim(),
        measureUnitId: value.measureUnitId!,
        imageName: this.originalImageName,
      },
      complementaryName: value.complementaryName.trim() || null,
      hasInventory: value.hasInventory,
      weight: value.weight,
      productDestination: value.productDestination,
      categoryId: value.categoryId,
    };

    const request$: Observable<unknown> = this.isEdit
      ? this.productService.updateWithEstablishment(
          this.productId!,
          this.productEstablishmentId!,
          payload,
        )
      : this.productService.createWithEstablishment(payload);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.router.navigateByUrl('/productos'),
        // Los errores HTTP (ej. de validación) ya se muestran en un toast vía errorInterceptor.
        error: () => {},
      });
  }
}
