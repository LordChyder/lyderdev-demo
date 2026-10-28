export interface DocumentTypeDto {
  id: number;
  code: string;
  name: string;
  allowsNaturalPerson: boolean;
  allowsLegalEntity: boolean;
  isActive: boolean;
}

export interface SearchDocumentTypesParams {
  pageIndex: number;
  pageSize: number;
  search?: string;
}

export interface PagedDocumentTypesDto {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  items: DocumentTypeDto[];
}

export interface CreateDocumentTypeDto {
  code: string;
  name: string;
  allowsNaturalPerson: boolean;
  allowsLegalEntity: boolean;
}
