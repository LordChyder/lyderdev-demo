/** Sobre estándar con el que el backend envuelve todas las respuestas. */
export interface ApiResponse<T> {
  success: boolean;
  status: number;
  data: T;
  messages: string[] | null;
}
