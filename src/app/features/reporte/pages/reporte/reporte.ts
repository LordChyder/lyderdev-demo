import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Subject, distinctUntilChanged, finalize, map, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import {
  PeriodReportDto,
  REPORT_PERIOD_TYPES,
  ReportPaymentTypeOption,
} from '../../../../core/models/report.model';
import { ReportService } from '../../../../core/services/report.service';
import { TokenService } from '../../../../core/services/token.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';

/** Valor por defecto del filtro de período: 3 = Mes (ver nota en report.model.ts). */
const DEFAULT_PERIOD = 3;

interface ChartBar {
  label: string;
  sales: number;
  expenses: number;
  salesPct: number;
  expensesPct: number;
}

@Component({
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
  ],
  selector: 'app-reporte',
  styleUrl: './reporte.scss',
  templateUrl: './reporte.html',
})
export class Reporte implements OnInit, OnDestroy {
  private readonly reportService = inject(ReportService);
  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  private readonly destroy$ = new Subject<void>();

  readonly periodTypes = REPORT_PERIOD_TYPES;

  readonly filters = this.fb.nonNullable.group({
    period: [DEFAULT_PERIOD],
    referenceDate: [null as Date | null],
    paymentTypeId: [null as number | null],
  });

  readonly paymentTypeOptions = signal<ReportPaymentTypeOption[]>([]);
  readonly data = signal<PeriodReportDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly canView = signal(false);

  readonly chartBars = computed<ChartBar[]>(() => {
    const points = this.data()?.chart ?? [];
    const max = Math.max(1, ...points.flatMap((p) => [p.sales, p.expenses]));

    return points.map((p) => ({
      label: p.label ?? p.key ?? '',
      sales: p.sales,
      expenses: p.expenses,
      salesPct: (p.sales / max) * 100,
      expensesPct: (p.expenses / max) * 100,
    }));
  });

  readonly topProductsColumns = ['productName', 'quantity', 'totalAmount'];
  readonly salesColumns = ['orderNumber', 'tableName', 'registerDate', 'total'];
  readonly expensesColumns = ['expenseDate', 'description', 'amount'];
  readonly paymentsColumns = ['paymentTypeName', 'amount'];

  constructor() {
    // Recarga al cambiar de establecimiento (switcher del navbar) o al tocar los filtros.
    effect(() => {
      this.tokenService.establishmentId();
      if (this.canView()) this.load();
    });

    // MatSelect puede emitir el mismo valor más de una vez al seleccionar una
    // opción; evitamos pedir el reporte dos veces por el mismo cambio.
    this.filters.valueChanges
      .pipe(
        map((value) => JSON.stringify(value)),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.authService.claimsLoaded$.pipe(takeUntil(this.destroy$)).subscribe((loaded) => {
      if (!loaded) {
        this.canView.set(false);
        return;
      }

      if (!this.permissionService.validate('Report_Module')) {
        this.router.navigateByUrl('/inicio');
        return;
      }

      this.canView.set(true);
      this.loadPaymentTypes();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  exportReport(): void {
    const report = this.data();
    if (!report) return;

    const rows: string[][] = [
      ['Reporte', report.periodLabel ?? 'Período seleccionado'],
      ['Ventas totales', String(report.totalSales)],
      ['Gastos totales', String(report.totalExpenses)],
      ['Utilidad neta', String(report.netProfit)],
      ['Pedidos cerrados', String(report.closedOrders)],
      ['Ticket promedio', String(report.averageTicket)],
      [],
      ['Productos más vendidos'],
      ['Producto', 'Cantidad', 'Total'],
      ...(report.topProducts ?? []).map((product) => [
        product.productName ?? '', String(product.quantity), String(product.totalAmount),
      ]),
      [],
      ['Pagos por tipo'],
      ['Tipo de pago', 'Monto'],
      ...(report.paymentsByType ?? []).map((payment) => [payment.paymentTypeName ?? '', String(payment.amount)]),
      [],
      ['Gastos'],
      ['Fecha', 'Descripción', 'Monto'],
      ...(report.expenses ?? []).map((expense) => [expense.expenseDate, expense.description ?? '', String(expense.amount)]),
    ];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = `\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte-restaurante.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private load(): void {
    if (!this.canView()) return;

    this.loading.set(true);
    this.error.set(null);
    const value = this.filters.getRawValue();

    this.reportService
      .getPeriod({
        period: value.period,
        referenceDate: value.referenceDate ? this.toIsoDate(value.referenceDate) : undefined,
        paymentTypeId: value.paymentTypeId ?? undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.data.set(data);
        },
        error: () => {
          this.error.set('No se pudo cargar el reporte.');
        },
      });
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadPaymentTypes(): void {
    this.reportService
      .getPaymentTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (options) => this.paymentTypeOptions.set(options ?? []),
        error: () => {
          // El filtro de tipo de pago es opcional; si falla, simplemente no se ofrece.
        },
      });
  }
}
