#!/usr/bin/env python3
"""
manifiesto.py — Orden canónico de capítulos.

El archivo Capítulos/manifiesto.json define el orden narrativo.
Cada tool importa este módulo para saber qué capítulos existen y en qué orden.

Sincronización con YAML:
  python tools/sync_manifiesto.py
"""

import json
from pathlib import Path

from vault import VAULT, MANIFEST_FILE, CHAPTERS_DIR

MANIFIESTO_PATH = MANIFEST_FILE


class Manifiesto:
    def __init__(self):
        self._data = None
        self._by_filename = {}

    def _load(self):
        if self._data is not None:
            return
        if MANIFIESTO_PATH.exists():
            self._data = json.loads(MANIFIESTO_PATH.read_text(encoding="utf-8"))
            self._by_filename = {
                c["archivo"]: (i, c.get("pov", ""))
                for i, c in enumerate(self._data["orden"])
            }

    @property
    def orden(self) -> list[dict]:
        self._load()
        return self._data["orden"]

    def get_numero(self, filename: str) -> int | None:
        """Devuelve el número de capítulo (0-based: prólogo=0) para un archivo dado."""
        self._load()
        for i, c in enumerate(self._data["orden"]):
            if c["archivo"] == filename:
                return i
        return None

    def get_pov(self, filename: str) -> str:
        """Devuelve el POV asociado a un archivo."""
        self._load()
        info = self._by_filename.get(filename)
        return info[1] if info else ""

    def archivos_ordenados(self) -> list[str]:
        """Lista de nombres de archivo en orden narrativo."""
        self._load()
        return [c["archivo"] for c in self._data["orden"]]

    def archivos_existentes(self) -> list[Path]:
        """Devuelve Paths a los archivos de capítulo que existen, en orden."""
        self._load()
        result = []
        for c in self._data["orden"]:
            fp = CHAPTERS_DIR / c["archivo"]
            if fp.exists():
                result.append(fp)
        return result

    def total_capitulos(self) -> int:
        self._load()
        return len(self._data["orden"])

    def insertar(self, pos: int, archivo: str, pov: str = ""):
        """Inserta un capítulo en la posición dada (1-based) y guarda."""
        self._load()
        # pos 1 = index 0
        self._data["orden"].insert(pos - 1, {"archivo": archivo, "pov": pov})
        self._guardar()

    def eliminar(self, archivo: str):
        """Elimina un capítulo del manifiesto por nombre de archivo."""
        self._load()
        self._data["orden"] = [c for c in self._data["orden"] if c["archivo"] != archivo]
        self._guardar()

    def _guardar(self):
        MANIFIESTO_PATH.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        # Invalidar caché
        self._data = None
        self._by_filename = {}

    def mover(self, archivo: str, nueva_pos: int):
        """Mueve un capítulo a una nueva posición (1-based)."""
        self._load()
        entry = next((c for c in self._data["orden"] if c["archivo"] == archivo), None)
        if entry:
            self._data["orden"].remove(entry)
            self._data["orden"].insert(nueva_pos - 1, entry)
            self._guardar()


# Instancia única para todo el proyecto
manifiesto = Manifiesto()
