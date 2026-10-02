"""Acceso seguro y dinámico a perfiles editoriales globales Markdown."""

import os
import re
import stat
import unicodedata
from pathlib import Path

from vault import GENRES_DIR, LIBRARY_ROOT


_INVALID_CHARACTERS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_RESERVED_NAME = re.compile(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', re.I)


def valid_genre_name(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("El nombre del perfil no es válido.")
    name = value.strip()
    if (not name or name.startswith(".") or name.endswith((".", " "))
            or _INVALID_CHARACTERS.search(name) or _RESERVED_NAME.match(name)):
        raise ValueError("El nombre del perfil no es seguro para un archivo.")
    return name


def genre_directory() -> Path:
    if LIBRARY_ROOT is None or GENRES_DIR is None:
        raise RuntimeError("La Biblioteca global no está disponible en este proceso.")
    if (not GENRES_DIR.exists() or GENRES_DIR.is_symlink()
            or getattr(GENRES_DIR, "is_junction", lambda: False)()
            or not GENRES_DIR.is_dir()):
        raise RuntimeError("La carpeta global de géneros no está disponible o no es segura.")
    root = GENRES_DIR.resolve(strict=True)
    if root.parent != LIBRARY_ROOT.resolve(strict=True):
        raise RuntimeError("La carpeta de géneros sale de la Biblioteca global.")
    return root


def _profiles() -> dict[str, tuple[str, Path]]:
    root = genre_directory()
    profiles: dict[str, tuple[str, Path]] = {}
    for candidate in root.iterdir():
        if candidate.name.startswith(".") or candidate.suffix != ".md":
            continue
        if candidate.is_symlink() or not candidate.is_file():
            continue
        if candidate.resolve(strict=True).parent != root:
            continue
        try:
            name = valid_genre_name(candidate.stem)
            if name != candidate.stem:
                continue
        except ValueError:
            continue
        key = unicodedata.normalize("NFC", name).casefold()
        if key in profiles:
            raise RuntimeError("Hay perfiles con nombres incompatibles por mayúsculas.")
        profiles[key] = (name, candidate)
    return profiles


def list_profiles() -> list[str]:
    return sorted((name for name, _ in _profiles().values()), key=lambda name: (name.casefold(), name))


def _existing_profile(name: str) -> Path:
    valid = valid_genre_name(name)
    profile = _profiles().get(unicodedata.normalize("NFC", valid).casefold())
    if profile is None or profile[0] != valid:
        raise FileNotFoundError("El perfil editorial no existe.")
    return profile[1]


def read_profile(name: str) -> str:
    target = _existing_profile(name)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(target, flags)
    with os.fdopen(descriptor, "r", encoding="utf-8", newline="") as stream:
        if (target.is_symlink() or not stat.S_ISREG(os.fstat(stream.fileno()).st_mode)
                or target.resolve(strict=True).parent != genre_directory()):
            raise ValueError("El perfil no es un archivo seguro.")
        return stream.read()


def create_profile(name: str, content: str) -> str:
    valid = valid_genre_name(name)
    if not isinstance(content, str):
        raise ValueError("El contenido del perfil debe ser texto Markdown.")
    root = genre_directory()
    if unicodedata.normalize("NFC", valid).casefold() in _profiles():
        raise FileExistsError("Ya existe un perfil con ese nombre o una variante de mayúsculas.")
    target = root / (valid + ".md")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(target, flags, 0o666)
    created_inode = os.fstat(descriptor).st_ino
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        try:
            if target.lstat().st_ino == created_inode:
                target.unlink()
        except OSError:
            pass
        raise
    return valid


def update_profile(name: str, content: str, expected_content: str) -> str:
    if not isinstance(content, str) or not isinstance(expected_content, str):
        raise ValueError("El contenido y la versión esperada deben ser texto.")
    target = _existing_profile(name)
    if target.is_symlink():
        raise ValueError("El perfil no es un archivo seguro.")
    flags = os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(target, flags)
    with os.fdopen(descriptor, "r+", encoding="utf-8", newline="") as stream:
        if (target.is_symlink() or not stat.S_ISREG(os.fstat(stream.fileno()).st_mode)
                or target.resolve(strict=True).parent != genre_directory()):
            raise ValueError("El perfil no es un archivo regular.")
        current = stream.read()
        if current != expected_content:
            raise RuntimeError("El perfil cambió externamente; vuelve a leerlo antes de actualizar.")
        stream.seek(0)
        stream.write(content)
        stream.truncate()
        stream.flush()
        os.fsync(stream.fileno())
    return valid_genre_name(name)
