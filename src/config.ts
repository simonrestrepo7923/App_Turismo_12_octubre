/**
 * Configuración de servicios externos. Se puede cambiar sin tocar el código creando
 * un archivo `.env.local` con las variables `VITE_…` (ver README).
 */
export const CONFIG = {
  /** Servidor OSRM con perfil peatonal (FOSSGIS, gratuito, datos de OpenStreetMap). */
  routingUrl: import.meta.env.VITE_ROUTING_URL ?? 'https://routing.openstreetmap.de/routed-foot',
  /**
   * Teselas del mapa base: servidor oficial de OpenStreetMap (gratuito, sin clave).
   * Uso moderado según https://operations.osmfoundation.org/policies/tiles/
   */
  tileUrl: import.meta.env.VITE_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileSubdomains: 'abc',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a>',
  /** Tiempo máximo de espera del servicio de rutas antes de usar la ruta aproximada. */
  routingTimeoutMs: 8000,
};
