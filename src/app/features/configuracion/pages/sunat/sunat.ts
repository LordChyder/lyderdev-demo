import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize, map, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SunatCredentialInfoDto } from '../../../../core/models/sunat-credential.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { SunatCredentialService } from '../../../../core/services/sunat-credential.service';

const RUC_PATTERN = /^\d{11}$/;
/** Último RUC consultado, para no tener que tipearlo cada vez que se abre el modal. */
const LAST_RUC_STORAGE_KEY = 'sunat.lastRuc';

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-sunat',
  styleUrl: './sunat.scss',
  templateUrl: './sunat.html',
})
export class Sunat implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly sunatCredentialService = inject(SunatCredentialService);
  private readonly notificationService = inject(NotificationService);
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  readonly dialogRef = inject(MatDialogRef, { optional: true });

  private readonly destroy$ = new Subject<void>();

  /** RUC cuyas credenciales se muestran; `null` hasta la primera consulta exitosa. */
  readonly ruc = signal<string | null>(null);
  /** `null` con `ruc()` seteado = el RUC todavía no tiene credenciales configuradas. */
  readonly info = signal<SunatCredentialInfoDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly certificateFile = signal<File | null>(null);

  readonly rucControl = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.pattern(RUC_PATTERN),
  ]);

  readonly form = this.fb.nonNullable.group({
    solUsername: ['', [Validators.required]],
    solPassword: [''],
    clientId: [''],
    clientSecret: [''],
    scope: [''],
  });

  readonly certificatePasswordControl = this.fb.nonNullable.control('', [Validators.required]);

  get isConfigured(): boolean {
    return !!this.info();
  }

  ngOnInit(): void {
    // Consulta automática apenas el RUC tiene 11 dígitos; mientras no sea válido se limpia el estado.
    this.rucControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((ruc) => {
        if (RUC_PATTERN.test(ruc)) {
          this.lookup(ruc);
        } else {
          this.ruc.set(null);
          this.info.set(null);
          this.error.set(null);
        }
      });

    const lastRuc = readLastRuc();
    if (lastRuc) {
      this.rucControl.setValue(lastRuc);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private lookup(ruc: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.sunatCredentialService
      .get(ruc)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (info) => {
          this.ruc.set(ruc);
          this.applyInfo(info);
          writeLastRuc(ruc);
        },
        error: () => {
          this.ruc.set(null);
          this.info.set(null);
          this.error.set('No se pudo consultar las credenciales SUNAT de este RUC.');
        },
      });
  }

  submit(): void {
    const ruc = this.ruc();
    if (!ruc || this.loading()) {
      this.rucControl.markAsTouched();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      documentNumber: ruc,
      solUsername: emptyToNull(value.solUsername),
      solPassword: emptyToNull(value.solPassword),
      clientId: emptyToNull(value.clientId),
      clientSecret: emptyToNull(value.clientSecret),
      scope: emptyToNull(value.scope),
    };

    const isUpdate = this.isConfigured;
    const request$ = isUpdate
      ? this.sunatCredentialService.update(ruc, payload)
      : this.sunatCredentialService.create(ruc, payload);

    this.saving.set(true);
    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.notificationService.success(
            isUpdate ? 'Credenciales SUNAT actualizadas.' : 'Credenciales SUNAT configuradas.',
          );
          this.refresh(ruc);
        },
      });
  }

  onCertificateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.certificateFile.set(input.files?.[0] ?? null);
  }

  uploadCertificate(): void {
    const ruc = this.ruc();
    const file = this.certificateFile();
    if (!ruc || !file) return;

    if (this.certificatePasswordControl.invalid) {
      this.certificatePasswordControl.markAsTouched();
      return;
    }

    this.uploading.set(true);
    this.sunatCredentialService
      .uploadCertificate(ruc, file, this.certificatePasswordControl.value)
      .pipe(
        finalize(() => this.uploading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Certificado digital cargado.');
          this.certificateFile.set(null);
          this.certificatePasswordControl.reset();
          this.refresh(ruc);
        },
      });
  }

  close(): void {
    this.dialogRef?.close();
  }

  /** Vuelve a leer el estado tras guardar, para reflejar los indicadores del backend. */
  private refresh(ruc: string): void {
    this.sunatCredentialService
      .get(ruc)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (info) => this.applyInfo(info) });
  }

  private applyInfo(info: SunatCredentialInfoDto | null): void {
    this.info.set(info);

    // Las contraseñas/secretos nunca vuelven del backend: en alta son obligatorias,
    // en edición se dejan vacías para conservar las que ya están guardadas.
    this.form.reset({
      solUsername: info?.solUsername ?? '',
      solPassword: '',
      clientId: info?.clientId ?? '',
      clientSecret: '',
      scope: info?.scope ?? '',
    });
    this.form.controls.solPassword.setValidators(info ? [] : [Validators.required]);
    this.form.controls.solPassword.updateValueAndValidity();
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readLastRuc(): string | null {
  try {
    return localStorage.getItem(LAST_RUC_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastRuc(ruc: string): void {
  try {
    localStorage.setItem(LAST_RUC_STORAGE_KEY, ruc);
  } catch {
    // Sin storage disponible simplemente no se recuerda el RUC.
  }
}
