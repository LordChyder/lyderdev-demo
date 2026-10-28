export interface PrinterDto {
  id: number;
  key: string | null;
  name: string | null;
  ipAddress: string | null;
  port: number;
  stockId: number | null;
  agentId: string | null;
  active: boolean;
  establishmentId: number;
}

export interface SavePrinterDto {
  key: string;
  name: string;
  ipAddress: string;
  port: number;
  stockId: number | null;
  agentId: string;
}

export interface UpdatePrinterDto {
  key: string;
  name: string;
  ipAddress: string;
  port: number;
  stockId: number | null;
  agentId: string;
}
