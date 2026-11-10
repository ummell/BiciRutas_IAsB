import type { Estado } from "./api";

const MOTIVOS: Record<string, string> = {
  cierre_por_obras: "Cierre por obras",
  cierre_total: "Cierre total",
  riesgo_vial_alto: "Riesgo vial alto",
  riesgo_seguridad_personal: "Riesgo de seguridad personal",
  no_habilitado_bicicletas: "No habilitado para bicicletas",
};

export function motivoRestriccion(codigo: string): string {
  return MOTIVOS[codigo] ?? codigo;
}

export function motivoBloqueo(msg: string | null): string {
  if (!msg) return "";
  if (msg.startsWith("Restricción ")) {
    const codigo = msg.slice("Restricción ".length).split(":")[0];
    return motivoRestriccion(codigo);
  }
  if (msg.startsWith("Sin iluminación")) return "Sin iluminación en horario nocturno";
  if (msg.startsWith("Tramo no habilitado")) return "No habilitado para bicicletas";
  if (msg.includes("horizonte")) return "Fuera del horizonte de la simulación";
  return msg;
}

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  A_TIEMPO: "A tiempo",
  TARDE: "Llega tarde",
  SIN_RUTA_SEGURA: "Sin ruta segura",
};

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}
