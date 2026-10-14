// QPV al Volante — corredores que se miden cada 20 minutos (tiempo real vs. tiempo sin tráfico).
// ⚠️ Coordenadas aproximadas: verificar cada punto en Google Maps antes de producción (clic derecho → copiar coordenadas).

export type Corredor = {
  id: string;
  nombre: string;          // como lo dice la gente
  gancho: string;          // frase para la publicación
  origen: [number, number]; // [lat, lon]
  destino: [number, number];
  umbralMin: number;       // minutos de retraso para considerarlo noticia
};

export const CORREDORES: Corredor[] = [
  {
    id: "ameca-sur", nombre: "Puente del Ameca → Vallarta", gancho: "Si vienes de Nuevo Vallarta, así está el Ameca en este momento",
    origen: [20.7015, -105.2965], destino: [20.6797, -105.2532], umbralMin: 10,
  },
  {
    id: "ameca-norte", nombre: "Vallarta → Puente del Ameca", gancho: "Si vas para Nuevo Vallarta, así está el Ameca en este momento",
    origen: [20.6797, -105.2532], destino: [20.7015, -105.2965], umbralMin: 10,
  },
  {
    id: "medina-ascencio", nombre: "Av. Francisco Medina Ascencio (Aeropuerto → Centro)", gancho: "Así está la Medina Ascencio rumbo al Centro",
    origen: [20.6797, -105.2532], destino: [20.6105, -105.2335], umbralMin: 8,
  },
  {
    id: "medina-norte", nombre: "Av. Francisco Medina Ascencio (Centro → Aeropuerto)", gancho: "Así está la Medina Ascencio rumbo al aeropuerto",
    origen: [20.6105, -105.2335], destino: [20.6797, -105.2532], umbralMin: 8,
  },
  {
    id: "bucerias", nombre: "Bucerías → Aeropuerto (Carretera 200)", gancho: "Si sales de Bucerías hacia Vallarta, toma tus precauciones",
    origen: [20.7556, -105.3340], destino: [20.6797, -105.2532], umbralMin: 10,
  },
  {
    id: "pitillal", nombre: "El Pitillal → Zona Hotelera", gancho: "Así está el tráfico saliendo de El Pitillal",
    origen: [20.6510, -105.2190], destino: [20.6436, -105.2350], umbralMin: 6,
  },
  {
    id: "sur", nombre: "Centro → Mismaloya (Carretera 200 sur)", gancho: "Si vas para la zona sur, así está la carretera",
    origen: [20.6105, -105.2335], destino: [20.5310, -105.2900], umbralMin: 8,
  },
];

// Caja que cubre Bahía de Banderas (Jalisco y Nayarit): minLon,minLat,maxLon,maxLat
export const BBOX_VALLARTA = "-105.42,20.48,-105.18,20.80";

// Centro para el mapa en vivo de Waze
export const CENTRO_MAPA = { lat: 20.655, lon: -105.24, zoom: 12 };
