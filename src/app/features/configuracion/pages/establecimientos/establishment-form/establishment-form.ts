import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ESTABLISHMENT_TYPE_LABELS,
  EstablishmentType,
} from '../../../../../core/models/establishment.model';
import { EstablishmentService } from '../../../../../core/services/establishment.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog';

export interface EstablishmentFormData {
  id: number;
}

/** Igual a la regla del backend: dígitos (7 a 15), con `+` opcional al inicio. */
const PHONE_PATTERN = /^\+?\d{7,15}$/;

/** El usuario puede escribir con espacios o guiones; se limpian antes de validar y enviar. */
function cleanPhone(value: string): string {
  return value.replace(/[\s-]/g, '');
}

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string | null;
  if (!value) return null;
  return PHONE_PATTERN.test(cleanPhone(value)) ? null : { phone: true };
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  selector: 'app-establishment-form',
  styleUrl: './establishment-form.scss',
  templateUrl: './establishment-form.html',
})
export class EstablishmentForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly establishmentService = inject(EstablishmentService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<EstablishmentForm>);
  private readonly data = inject<EstablishmentFormData | null>(MAT_DIALOG_DATA, { optional: true });

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data;
  readonly saving = signal(false);
  readonly loading = signal(this.isEdit);
  readonly error = signal<string | null>(null);

  readonly establishmentTypeOptions = [EstablishmentType.Restaurant, EstablishmentType.Ecommerce];
  readonly establishmentTypeLabels = ESTABLISHMENT_TYPE_LABELS;

  /** Tipo con el que se cargó el formulario al editar; null al crear (no hay nada que comparar). */
  private originalEstablishmentType: EstablishmentType | null = null;

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required]],
    acronym: ['', [Validators.required]],
    name: ['', [Validators.required]],
    establishmentType: [EstablishmentType.Restaurant, [Validators.required]],
    documentNumber: [''],
    dirrection: [''],
    number: [''],
    complement: [''],
    localityName: [''],
    localityCode: [''],
    valueLimitConsumerFinal: [0],
    isParent: [false],
    establishmentParentId: [null as number | null],
    phone: ['', [phoneValidator]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
  });

  ngOnInit(): void {
    if (this.isEdit) {
      this.loadForEdit(this.data!.id);
    }
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

    if (this.typeChanged()) {
      const newType = this.form.getRawValue().establishmentType;
      const confirmData: ConfirmDialogData = {
        title: 'Cambiar tipo de establecimiento',
        message: `Cambiar el tipo no mueve los productos, combos ni listas de precios ya registrados. Solo los cambios que se hagan desde ahora se enviarán a ${this.establishmentTypeLabels[newType]}. ¿Continuar?`,
        confirmLabel: 'Continuar',
      };

      this.dialog
        .open(ConfirmDialog, { width: '420px', autoFocus: false, data: confirmData })
        .afterClosed()
        .pipe(takeUntil(this.destroy$))
        .subscribe((confirmed) => {
          if (confirmed) this.save();
        });
      return;
    }

    this.save();
  }

  /** true solo al editar, cuando el tipo seleccionado difiere del que se cargó. */
  typeChanged(): boolean {
    return (
      this.isEdit &&
      this.originalEstablishmentType !== null &&
      this.form.getRawValue().establishmentType !== this.originalEstablishmentType
    );
  }

  private save(): void {
    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload = {
      code: value.code,
      acronym: value.acronym,
      name: value.name,
      establishmentType: value.establishmentType,
      documentNumber: value.documentNumber,
      dirrection: value.dirrection,
      number: value.number,
      complement: value.complement,
      localityName: value.localityName,
      localityCode: value.localityCode,
      valueLimitConsumerFinal: value.valueLimitConsumerFinal,
      isParent: value.isParent,
      establishmentParentId: value.establishmentParentId,
      phone: value.phone ? cleanPhone(value.phone) : null,
      email: value.email || null,
    };

    const request$ = this.isEdit
      ? this.establishmentService.update(this.data!.id, payload)
      : this.establishmentService.create(payload);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.error.set(
            this.isEdit
              ? 'No se pudo actualizar el establecimiento.'
              : 'No se pudo crear el establecimiento.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private loadForEdit(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.establishmentService
      .getForEdit(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (establishment) => {
          this.originalEstablishmentType = establishment.establishmentType;
          this.form.patchValue({
            code: establishment.code,
            acronym: establishment.acronym,
            name: establishment.name,
            establishmentType: establishment.establishmentType,
            documentNumber: establishment.documentNumber,
            dirrection: establishment.dirrection,
            number: establishment.number,
            complement: establishment.complement,
            localityName: establishment.localityName,
            localityCode: establishment.localityCode,
            valueLimitConsumerFinal: establishment.valueLimitConsumerFinal,
            isParent: establishment.isParent,
            establishmentParentId: establishment.establishmentParentId,
            phone: establishment.phone ?? '',
            email: establishment.email ?? '',
          });
        },
        error: () => {
          this.error.set('No se pudo cargar la información del establecimiento.');
        },
      });
  }
}
