/** Respuesta de GET /api/v1/sunat-credential/{ruc}. Nunca trae contraseñas ni secretos. */
export interface SunatCredentialInfoDto {
  documentNumber: string | null;
  hasCertificate: boolean;
  hasSolCredentials: boolean;
  solUsername: string | null;
  hasOAuthCredentials: boolean;
  clientId: string | null;
  scope: string | null;
}

/**
 * Body de POST (configurar) y PUT (actualizar) /api/v1/sunat-credential/{ruc}.
 * El backend usa el mismo shape para ambos comandos.
 */
export interface SaveSunatCredentialsDto {
  documentNumber: string;
  solUsername: string | null;
  solPassword: string | null;
  clientId: string | null;
  clientSecret: string | null;
  scope: string | null;
}
