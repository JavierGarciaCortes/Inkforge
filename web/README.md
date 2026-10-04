# Dashboard Astro heredado

`web/` es un dashboard secundario, independiente de Inkforge Desktop. Su generador lee una obra Inkforge concreta y produce `src/data/vault.json` como artefacto de presentación. Los Markdown de la obra siguen siendo la fuente de verdad; el JSON generado no sirve para editar ni decidir canon.

## Selección de contenido

Antes de iniciar o construir el dashboard, define `VAULT_PATH` con la raíz física de una obra que tenga `Proyecto.md` válido. Para una saga, proporciona además la ruta exacta del libro mediante `INKFORGE_BOOK_SCOPE=Libros/<id>` en esa invocación. El generador también acepta `--book-scope Libros/<id>` cuando se llama directamente. No selecciona automáticamente un libro ni reconstruye el id a partir del título.

El generador lee `Mundo/` compartido desde la raíz de la obra y `Planificación/` desde el libro seleccionado. El título sale de `Proyecto.md` o `Libro.md`. No usa `.fiction` ni un manifiesto JSON de capítulos. Al cambiar de obra o libro, hay que volver a generar el artefacto del dashboard; esa selección no modifica el libro activo de Inkforge Desktop ni reinicia OpenCode.

## Alcance

La interfaz de Astro conserva páginas y visualizaciones del dashboard original. Su presentación no sustituye la Biblioteca, el editor ni el Director de Inkforge Desktop. La adaptación visual completa para todas las novelas y sagas sigue pendiente.
