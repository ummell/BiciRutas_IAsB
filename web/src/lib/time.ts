export function aMin(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function aHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function sumarAcotado(hora: string, minutos: number, tope: string): string {
  return aHora(Math.min(aMin(hora) + minutos, aMin(tope)));
}
