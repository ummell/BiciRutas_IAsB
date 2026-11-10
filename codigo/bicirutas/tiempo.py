"""Utilidades de tiempo. Las horas se manejan como minutos desde medianoche."""


def a_minutos(hora: str) -> int:
    """Convierte 'HH:MM' a minutos desde medianoche."""
    if not isinstance(hora, str) or len(hora) != 5 or hora[2] != ":":
        raise ValueError(f"Hora inválida: {hora!r}")
    h, m = int(hora[:2]), int(hora[3:])
    if not (0 <= h < 24 and 0 <= m < 60):
        raise ValueError(f"Hora fuera de rango: {hora!r}")
    return h * 60 + m


def a_hora(minutos: int) -> str:
    """Convierte minutos desde medianoche a 'HH:MM'."""
    return f"{minutos // 60:02}:{minutos % 60:02}"


def solapa(a: int, b: int, c: int, d: int) -> bool:
    """Indica si [a, b) y [c, d) se solapan. Los intervalos excluyen el final."""
    return a < d and c < b
