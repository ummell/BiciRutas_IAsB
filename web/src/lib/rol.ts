import { useState } from "react";

export type Rol = "usuario" | "administracion";

const CLAVE = "bicirutas.rol";

function leerRol(): Rol {
  try {
    return window.localStorage.getItem(CLAVE) === "administracion" ? "administracion" : "usuario";
  } catch {
    return "usuario";
  }
}

export function useRol(): [Rol, (r: Rol) => void] {
  const [rol, setRolEstado] = useState<Rol>(leerRol);
  const setRol = (r: Rol) => {
    setRolEstado(r);
    try {
      window.localStorage.setItem(CLAVE, r);
    } catch {
      return;
    }
  };
  return [rol, setRol];
}
