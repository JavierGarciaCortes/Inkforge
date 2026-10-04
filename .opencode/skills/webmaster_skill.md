# Webmaster — dashboard Astro secundario

`web/` es un dashboard heredado e independiente de Inkforge Desktop. Para trabajar en él, inspeccionar el código real de `web/src/` y `web/scripts/generate-vault-data.mjs`; no asumir que siguen existiendo rutas o archivos de fiction-vault.

El generador recibe `VAULT_PATH` con la obra Inkforge exacta. En saga, requiere `INKFORGE_BOOK_SCOPE=Libros/<id>` por invocación, o `--book-scope Libros/<id>` si se llama directamente. Ese id debe proceder de una selección explícita; nunca deducirlo del título, de fechas o de capítulos. Los Markdown son canónicos y `web/src/data/vault.json` es solo un artefacto de presentación generado.

El dashboard aún necesita adaptación visual para múltiples tipos de obra y libros. No tratarlo como interfaz principal ni usarlo para escribir canon. Seguir el contrato de rutas de `AGENTS.md` al modificar la lectura de contenido.
