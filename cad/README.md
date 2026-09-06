# CDL Atlas — CAD detail revision 2

Same Cascadia 126 / DD15 Gen 5 / nominal 53-foot dry-van study configuration.

This revision adds exterior construction detail to the existing reference reconstruction: engine access covers and flange hardware, gasket seams, fuel-line unions, wiring plugs and harness routes, finned control-module casing, filter-cap grips and mounting ears, starter solenoid, radiator brackets, alternator copper end-turns, reservoir mounts, hose clamps, brake hardware, air-bag seams, fuel-tank supports and landing-gear hardware.

CAD units are millimetres; the derived web model uses metres. The named inspection groups and chassis coordinates remain unchanged. Web materials recover the authored metallic/roughness values, which were absent from the original CAD color-only export.

## Accuracy

This is an educational reference reconstruction, **not a verified 1:1 OEM replica**. Fine component dimensions, wire and hose routing, exact mounting points and chassis option combinations remain estimated. Additional small features do not establish dimensional accuracy. Assembly bodies may overlap intentionally; this is not manufacturing-ready CAD.

Reference: [Detroit DD15](https://www.demanddetroit.com/engines/dd15/) and [Detroit DD15 Gen 5 technical sheet](https://detroitadsaem.azureedge.net/content/dam/enterprise/documents/DDCPWR%2015904%20-%20DD15%20Gen%205%20Engine%20Vocational%20Spec%20Sheet_3.0.pdf). These identify the engine family and visible construction, but do not supply dimensioned manufacturing drawings for all components.

`validation.json` records all exported solids and bounding boxes. `geometry.json` and `build_cad.py` reproduce the assembly with CadQuery 2.8.0. The web GLB is a compressed tessellation of those CAD solids.
