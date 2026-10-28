import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { finalize, takeUntil, Subject } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmDialog, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import { EstablishmentService } from '../../../../../core/services/establishment.service';
import { NotificationService } from '../../../../../core/services/notification.service';

export interface EstablishmentLogoDialogData {
  id: number;
  name: string | null;
}

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg'];
/** Lado (en CSS px) del recuadro cuadrado donde se recorta el logo. */
const VIEWPORT_SIZE = 260;
/** Lado (en px reales) del PNG/JPG cuadrado que se sube al backend. */
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Ver/subir/reemplazar/eliminar el logo de un establecimiento
 * (`GET/POST/PUT/DELETE api/v1/establishment/{id}/image`, agregado en
 * Lyder.Dev.AccessControl). El backend solo acepta PNG/JPG de hasta 2MB y no
 * valida que sea cuadrada: el recorte cuadrado se fuerza acá antes de subir.
 */
@Component({
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  selector: 'app-establishment-logo-dialog',
  styleUrl: './establishment-logo-dialog.scss',
  templateUrl: './establishment-logo-dialog.html',
})
export class EstablishmentLogoDialog implements OnInit, OnDestroy {
  private readonly establishmentService = inject(EstablishmentService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<EstablishmentLogoDialog>);
  readonly data = inject<EstablishmentLogoDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  @ViewChild('cropImage') private cropImageRef?: ElementRef<HTMLImageElement>;

  readonly viewportSize = VIEWPORT_SIZE;

  /** Logo ya guardado en el servidor (estado "idle"), o null si no tiene / todavía no se sabe. */
  readonly currentImageUrl = signal<string | null>(null);
  readonly hasImage = signal(false);
  readonly loadingCurrent = signal(true);
  readonly loadError = signal<string | null>(null);

  /** true mientras se está ajustando el recorte de una imagen recién seleccionada. */
  readonly cropping = signal(false);
  readonly cropSourceUrl = signal<string | null>(null);
  readonly zoom = signal(MIN_ZOOM);
  readonly imageStyle = signal<{ width: string; height: string; left: string; top: string }>({
    width: '0px',
    height: '0px',
    left: '0px',
    top: '0px',
  });

  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  private naturalWidth = 0;
  private naturalHeight = 0;
  private baseScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private selectedFileType: 'image/png' | 'image/jpeg' = 'image/jpeg';

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartOffsetX = 0;
  private dragStartOffsetY = 0;
  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerUp = () => this.handlePointerUp();

  ngOnInit(): void {
    this.loadCurrentImage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.revokeUrl(this.currentImageUrl());
    this.revokeUrl(this.cropSourceUrl());
    this.stopDragListeners();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      this.error.set('Formato no admitido. Usa PNG o JPG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.error.set('La imagen no debe superar los 2 MB.');
      return;
    }

    this.error.set(null);
    this.selectedFileType = file.type as 'image/png' | 'image/jpeg';
    this.revokeUrl(this.cropSourceUrl());
    this.cropSourceUrl.set(URL.createObjectURL(file));
    this.zoom.set(MIN_ZOOM);
    this.cropping.set(true);
  }

  /** Se dispara con (load) del <img> de recorte: fija la posición/zoom inicial centrada. */
  onCropImageLoaded(): void {
    const img = this.cropImageRef?.nativeElement;
    if (!img) return;

    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    this.baseScale = VIEWPORT_SIZE / Math.min(this.naturalWidth, this.naturalHeight);

    const displayedWidth = this.naturalWidth * this.baseScale;
    const displayedHeight = this.naturalHeight * this.baseScale;
    this.offsetX = (VIEWPORT_SIZE - displayedWidth) / 2;
    this.offsetY = (VIEWPORT_SIZE - displayedHeight) / 2;

    this.applyImageStyle(displayedWidth, displayedHeight);
  }

  onZoomInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.setZoom(value);
  }

  private setZoom(value: number): void {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    this.zoom.set(zoom);

    const scale = this.baseScale * zoom;
    const displayedWidth = this.naturalWidth * scale;
    const displayedHeight = this.naturalHeight * scale;

    this.clampOffsets(displayedWidth, displayedHeight);
    this.applyImageStyle(displayedWidth, displayedHeight);
  }

  onViewportPointerDown(event: PointerEvent): void {
    if (!this.cropping()) return;
    event.preventDefault();

    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartOffsetX = this.offsetX;
    this.dragStartOffsetY = this.offsetY;

    document.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerup', this.onPointerUp);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragging) return;

    const scale = this.baseScale * this.zoom();
    const displayedWidth = this.naturalWidth * scale;
    const displayedHeight = this.naturalHeight * scale;

    this.offsetX = this.dragStartOffsetX + (event.clientX - this.dragStartX);
    this.offsetY = this.dragStartOffsetY + (event.clientY - this.dragStartY);
    this.clampOffsets(displayedWidth, displayedHeight);
    this.applyImageStyle(displayedWidth, displayedHeight);
  }

  private handlePointerUp(): void {
    this.dragging = false;
    this.stopDragListeners();
  }

  private stopDragListeners(): void {
    document.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerup', this.onPointerUp);
  }

  private clampOffsets(displayedWidth: number, displayedHeight: number): void {
    const minX = Math.min(0, VIEWPORT_SIZE - displayedWidth);
    const minY = Math.min(0, VIEWPORT_SIZE - displayedHeight);
    this.offsetX = Math.min(0, Math.max(minX, this.offsetX));
    this.offsetY = Math.min(0, Math.max(minY, this.offsetY));
  }

  private applyImageStyle(displayedWidth: number, displayedHeight: number): void {
    this.imageStyle.set({
      width: `${displayedWidth}px`,
      height: `${displayedHeight}px`,
      left: `${this.offsetX}px`,
      top: `${this.offsetY}px`,
    });
  }

  cancelCrop(): void {
    this.revokeUrl(this.cropSourceUrl());
    this.cropSourceUrl.set(null);
    this.cropping.set(false);
  }

  /** Recorta al cuadro actual con un canvas y sube el resultado (POST si no había logo, PUT si ya había). */
  confirmCrop(): void {
    const img = this.cropImageRef?.nativeElement;
    if (!img || this.naturalWidth === 0) return;

    const scale = this.baseScale * this.zoom();
    const cropX = -this.offsetX / scale;
    const cropY = -this.offsetY / scale;
    const cropSize = VIEWPORT_SIZE / scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const mimeType = this.selectedFileType;
    const filename = mimeType === 'image/png' ? 'logo.png' : 'logo.jpg';

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        this.upload(blob, filename);
      },
      mimeType,
      0.92,
    );
  }

  private upload(blob: Blob, filename: string): void {
    this.saving.set(true);
    this.error.set(null);

    const request$ = this.hasImage()
      ? this.establishmentService.updateImage(this.data.id, blob, filename)
      : this.establishmentService.saveImage(this.data.id, blob, filename);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Se guardó el logo del establecimiento.');
          this.revokeUrl(this.currentImageUrl());
          this.revokeUrl(this.cropSourceUrl());
          this.currentImageUrl.set(URL.createObjectURL(blob));
          this.hasImage.set(true);
          this.cropSourceUrl.set(null);
          this.cropping.set(false);
        },
        error: () => {
          // El toast con el detalle del backend ya lo muestra el interceptor global.
        },
      });
  }

  deleteImage(): void {
    const data: ConfirmDialogData = {
      title: 'Eliminar logo',
      message: '¿Eliminar el logo de este establecimiento? Los comprobantes se imprimirán sin logo.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.deleting.set(true);
        this.establishmentService
          .deleteImage(this.data.id)
          .pipe(
            finalize(() => this.deleting.set(false)),
            takeUntil(this.destroy$),
          )
          .subscribe({
            next: () => {
              this.notificationService.success('Se eliminó el logo del establecimiento.');
              this.revokeUrl(this.currentImageUrl());
              this.currentImageUrl.set(null);
              this.hasImage.set(false);
            },
            error: () => {
              // El toast con el detalle del backend ya lo muestra el interceptor global.
            },
          });
      });
  }

  close(): void {
    this.dialogRef.close();
  }

  private loadCurrentImage(): void {
    this.loadingCurrent.set(true);
    this.loadError.set(null);

    this.establishmentService
      .getImage(this.data.id)
      .pipe(
        finalize(() => this.loadingCurrent.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        // 204 (o cualquier respuesta sin body) = no tiene logo todavía: nada que mostrar,
        // y el próximo guardado debe ir por POST, no por PUT.
        next: (response) => {
          const blob = response.body;
          if (response.status === 204 || !blob || blob.size === 0) {
            this.hasImage.set(false);
            return;
          }
          this.hasImage.set(true);
          this.currentImageUrl.set(URL.createObjectURL(blob));
        },
        error: (err) => {
          if (err?.status === 404) {
            this.hasImage.set(false);
            return;
          }
          this.loadError.set('No se pudo cargar el logo actual.');
        },
      });
  }

  private revokeUrl(url: string | null): void {
    if (url) URL.revokeObjectURL(url);
  }
}
