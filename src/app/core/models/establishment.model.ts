export enum EstablishmentType {
  Restaurant = 1,
  Ecommerce = 2,
}

export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  [EstablishmentType.Restaurant]: 'Restaurante',
  [EstablishmentType.Ecommerce]: 'Ecommerce',
};

export interface SearchEstablishmentDto {
  id: number;
  code: string | null;
  acronym: string | null;
  name: string | null;
  active: boolean;
  establishmentType: EstablishmentType;
}

export interface SearchEstablishmentsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveEstablishmentDto {
  code: string;
  acronym: string;
  name: string;
  isParent: boolean;
  establishmentParentId: number | null;
  valueLimitConsumerFinal: number;
  documentNumber: string;
  dirrection: string;
  number: string;
  complement: string;
  localityName: string;
  localityCode: string;
  phone?: string | null;
  email?: string | null;
  establishmentType: EstablishmentType;
}

export interface EstablishmentForEditDto {
  id: number;
  code: string;
  acronym: string;
  name: string;
  isParent: boolean;
  establishmentParentId: number | null;
  valueLimitConsumerFinal: number;
  documentNumber: string;
  dirrection: string;
  number: string;
  complement: string;
  localityName: string;
  localityCode: string;
  phone: string | null;
  email: string | null;
  establishmentType: EstablishmentType;
}
