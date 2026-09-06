# CDL Atlas

Interactive, bilingual CDL Class A pre-trip study app for a tractor and 53-foot semitrailer.

**Live app:** https://cdl-atlas-pretrip.alangael2412.workers.dev/

Explore the truck in 3D, zoom into components, tap parts to identify them, and study English/Spanish inspection notes. Includes 54 selectable study components, a 102-item checklist, speech synthesis and progress stored on your device.

## Run locally

Requires Node.js 22.13+ and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Build and deploy

```sh
pnpm exec tsc --noEmit
pnpm build
pnpm exec wrangler login
pnpm exec wrangler deploy --config wrangler.cloudflare.json
```

Deploys to the Cloudflare account you authenticate with. Change `name` in `wrangler.cloudflare.json` for your own Worker. Credentials and local deployment state are excluded from Git.

## Project structure

- `app/`: interactive viewer, study content, camera controls and mobile interface.
- `public/cad/cascadia-dd15-v2.glb`: current compressed model with 9,449 source CAD solids and 57 groups, including 54 study groups.
- `app/truck-model.ts`: procedural geometry authoring source.
- `cad/`: portable CadQuery generator and geometry definition for editable STEP export.
- `scripts/`: geometry and camera validation.

The current web mesh contains 1,900,896 triangles and is approximately 8.46 MB. Its materials distinguish metal, plastic, rubber and copper. The v1 asset is retained as an earlier revision.

## Rebuild the editable CAD

```sh
python3 -m venv .venv
.venv/bin/pip install -r cad/requirements.txt
.venv/bin/python cad/build_cad.py --out cad/generated
```

This creates STEP, GLB, OpenCascade assembly data and a validation report. The full STEP export is large and is generated locally, not stored in this repository. Its raw GLB is not the optimized web asset.

## Scope and references

The Cascadia 126 / DD15 Gen 5 / 53-foot dry van is an educational reference reconstruction, **not verified 1:1 OEM CAD**. Component dimensions and installation positions remain estimates. Study the applicable state CDL manual and practice in the actual vehicle with an instructor.

Interaction concept inspired by [Human Atlas](https://github.com/ashemag/human-atlas); no anatomy assets or source code were copied. Mechanical reference sources include Detroit DD15, Freightliner Cascadia, Bendix and SAF-HOLLAND documentation. No OEM photographs or third-party OEM CAD files are redistributed. Draco decoder licensing is included in `public/cad/draco/LICENSE`.
