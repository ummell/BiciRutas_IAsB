"""Entrypoint para Vercel Functions: expone la app FastAPI de api.main.

Vercel carga `app` desde este archivo (función basada en archivo en /api).
Ajusta sys.path para importar `api` (raíz) y `bicirutas` (codigo/) y fija
BICIRUTAS_PAQUETE a la carpeta gestion/ del proyecto.
"""

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(RAIZ), str(RAIZ / "codigo")]
os.environ.setdefault("BICIRUTAS_PAQUETE", str(RAIZ / "gestion"))

from api.main import app  # noqa: E402,F401
