# Problemas conocidos del backend

Este archivo documenta bugs del backend que afectan al frontend, junto con el
workaround aplicado del lado de Angular mientras se corrigen. Cuando se
arregle un issue, hay que revertir su workaround (los pasos están detallados
en cada sección) y borrar la sección de este archivo.

---

## RESUELTO — `GET /api/v1/user-establishment` no filtraba por `EstablishmentId`

**Estado:** corregido (reportado 2026-09-08, confirmado corregido 2026-09-09).

**Servicio:** AccessControl (`accessControlUrl`).

**Endpoint:** `GET /api/v1/user-establishment?pageIndex=&pageSize=&filter=`

### Lo que pasaba antes

El endpoint ignoraba el header `EstablishmentId` y devolvía asignaciones de
todos los establecimientos mezcladas. Además, el DTO de la lista
(`SearchUserEstablishmentDto` según Swagger de esa época) traía campos
etiquetados como del establecimiento (`code`, `acronym`, `name`) pero en
realidad poblados con datos del usuario, y **sin `userId`** — por lo que el
frontend necesitaba pedir el detalle (`GET /user-establishment/{id}`) de
cada fila visible para poder abrir "editar" o "ver establecimientos" (1
request de lista + N requests de detalle, N+1).

El workaround de esa época pedía además un lote grande (`pageSize=200`) y
filtraba/paginaba en el cliente, para no depender del filtro roto del
backend.

### Corrección del backend

El endpoint ahora sí filtra por `EstablishmentId`, y el DTO de respuesta
cambió a (`SearchUserEstablishmentResponseDto`):

```csharp
public sealed record SearchUserEstablishmentResponseDto(
    int UserEstablishmentId,
    int UserId,
    string Name,
    string Username,
    string Email,
    bool Active,
    DateTimeOffset? ExpiresAt
);
```

Es decir, ya trae `userId` y los datos del usuario correctamente nombrados.

### Estado actual del frontend

Se quitó el workaround por completo:

- [`user-establishment.model.ts`](../src/app/core/models/user-establishment.model.ts):
  `SearchUserEstablishmentDto` se actualizó a los campos nuevos
  (`userEstablishmentId`, `userId`, `name`, `username`, `email`, `active`,
  `expiresAt`). Se eliminó `UserEstablishmentDetailDto` (ya no hace falta).
- [`user-establishment.service.ts`](../src/app/core/services/user-establishment.service.ts):
  se eliminó `getDetail` (sin usos).
- [`usuarios.ts`](../src/app/features/configuracion/pages/usuarios/usuarios.ts):
  `load()` vuelve a paginar en el servidor (`pageIndex`/`pageSize` tal cual
  pide el usuario) y usa la respuesta de `search()` directamente para la
  tabla — sin filtro en cliente, sin `WORKAROUND_FETCH_SIZE`, sin N+1 de
  detalles.

Nota: el DTO que devuelve `GET /user/{userId}/establishments` (usado para
listar los establecimientos de un usuario, tanto en
[`user-establishments-dialog.ts`](../src/app/features/configuracion/pages/usuarios/user-establishments/user-establishments-dialog.ts)
como en [`establishment-switcher.ts`](../src/app/shared/components/establishment-switcher/establishment-switcher.ts))
**no cambió** — sigue
trayendo datos del establecimiento (`code`, `acronym`, `name`,
`establishmentId`, etc.). Antes compartía el mismo tipo TS
(`SearchUserEstablishmentDto`) que la lista de usuarios porque las formas
coincidían por casualidad; ahora que esta última cambió, se separó en su
propio tipo `UserEstablishmentSummaryDto` para no mezclar dos DTOs de
endpoints distintos bajo el mismo nombre.
