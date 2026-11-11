
import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(RAIZ), str(RAIZ / "codigo")]
os.environ.setdefault("BICIRUTAS_PAQUETE", str(RAIZ / "gestion"))

from api.main import app
