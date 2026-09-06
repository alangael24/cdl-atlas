# Revisión geométrica de referencia v3

**Reconstrucción parcial original. No es CAD OEM, no corresponde a un VIN concreto y no es una réplica 1:1 verificada. No usar para fabricación, reparación ni comprobaciones de seguridad del vehículo.**

La aplicación conserva `cascadia-dd15-v2.glb` como base. `reference-v3.glb` sustituye cuatro grupos (`rim`, `hub`, `kingpin`, `trailerbody`) y añade instancias a `engine` y `fifth`. Los demás grupos permanecen sin cambios. La revisión no sustituye el generador anterior ni modifica su archivo `geometry.json`; tiene su propio generador reproducible.

## Medidas y evidencia

| Elemento | Parámetros incorporados | Alcance real de la evidencia |
|---|---|---|
| Interfaz del rin | 10 agujeros; diámetro 26 mm; círculo 285,75 mm; abertura central 220,1 mm. Tamaño nominal 22,5 × 8,25 pulgadas. | Tabla Alcoa 88067x. Las pruebas miden las superficies cilíndricas del CAD. No se reproduce la geometría completa del rin comercial ni se certifican su offset, plato, válvula o montaje doble. |
| Perno rey | Zona cilíndrica de contacto nominal de 50,8 mm. | Familia de pernos de 2 pulgadas SAF-HOLLAND. Resto del perfil, holguras y mordazas estimados. |
| DD15 Gen 5 | Enfriador EGR, actuador/válvula EGR, respiradero del cárter, dosificador y arnés derecho. | Identificación y disposición general de las figuras 3–4 del manual oficial Detroit. Las formas, fijaciones, dimensiones y rutas de mangueras son estimaciones, no planos acotados. |
| Caja del remolque | Paneles huecos, piso, postes, techo, travesaños, remaches y marco posterior. | Longitud nominal elegida de 53 pies; ancho nominal elegido de 102 pulgadas. No es una geometría OEM Champion verificada. Espesores y separaciones estimados. |

Hay 18 rines y 10 cubos: un cubo por extremo de eje, no uno por cada neumático de una pareja. La corrección de cantidad **no** certifica la orientación, separación, plato u offset de los rines dobles. Las posiciones del chasis y los neumáticos de la versión anterior se conservan. Queda pendiente comprobar interferencias con frenos, llantas y ejes del conjunto original.

Los componentes adicionales del motor se recorren como instancias del grupo `engine`. No se añaden nuevas tarjetas al catálogo de estudio. Las mordazas y la palanca pertenecen ahora a una instancia adicional de `fifth`, separada del perno y de la placa del remolque.

## Fuentes primarias consultadas

- Detroit/DTNA, DD Platform Gen 5 Operator Manual, DDC-SVC-MAN-0217, revisión 2025-08-26, páginas impresas 22–23, figuras 3–4: https://dtnacontent-dtna.prd.freightliner.com/content/dam/public/dtna-servicelit/ddc/pdfs/OperatorsManual/DDPlatform/DDC-SVC-MAN-0217_2026.pdf
- Alcoa Wheels, ficha 88067x: https://www.alcoawheels.com/north-america/en/products/88067x/
- SAF-HOLLAND, pernos de 2 pulgadas: https://safholland.com/us/en/products/category/2-king-pins
- Freightliner, configuraciones Cascadia de cuarta generación: https://www.freightliner.com/trucks/cascadia/specifications/fourth-generation/
- Great Dane, familia Champion: https://greatdane.com/champion-dry-vans/

También se buscaron modelos comunitarios de Cascadia. No se incorporaron: no se verificó un ensamblaje OEM completo y dimensionalmente exacto con acceso y condiciones de reutilización adecuados. Los documentos se enlazan, no se redistribuyen. No se incluyen fotografías, texturas de marca, archivos de fuentes tipográficas ni CAD OEM descargado.

## Unidades y reproducción

CAD STEP: milímetros. GLB: metros. **Ambos usan X longitudinal (frente negativo), Y vertical y Z hacia el lado izquierdo del vehículo.** El STEP es parcial y utiliza Y vertical: un programa CAD que suponga Z vertical deberá ajustar la orientación de visualización.

```sh
python3 -m venv .venv-reference
.venv-reference/bin/pip install -r cad/requirements-reference-v3.txt
.venv-reference/bin/python cad/build_reference_v3.py --out public/cad --step reference-v3-partial.step
.venv-reference/bin/python cad/check_reference_v3.py --assets public/cad --report reference-validation.json
```

En Windows, usar los ejecutables de `.venv-reference\Scripts\`.

## Pruebas de aplicación pendientes de ejecutar en el repositorio completo

```sh
pnpm install --frozen-lockfile
node --experimental-strip-types scripts/check-reference-v3.mjs
pnpm exec tsc --noEmit
pnpm build
pnpm dev
```

Las comprobaciones CAD del paquete sí se ejecutaron. El script JavaScript está incluido para validar la importación con la dependencia Three.js del proyecto; no se ejecutó en el entorno de creación del paquete. Tampoco se ejecutaron el typecheck completo, la compilación de la aplicación ni las pruebas de navegador. La transpilación sintáctica de TypeScript no sustituye esas pruebas.

En el navegador deben revisarse carga de ambos GLB, consola sin errores, selección por clic, aislamiento, cambio de instancia, vistas, modo transparente, vista despiece y uso móvil. Medir el rendimiento conjunto y revisar el ajuste del motor con el capó, los rines con los frenos y las puertas con la nueva caja. No aprobar una publicación antes de esas comprobaciones.
