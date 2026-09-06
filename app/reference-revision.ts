import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildCadGroups, disposeCadObject} from './cad-model';

const ASSEMBLY = 'CDL_Cascadia_DD15_53ft';
const MODES = {rim: 'replace', hub: 'replace', kingpin: 'replace',
  trailerbody: 'replace', engine: 'append', fifth: 'append'} as const;
const EXPECTED = {rim: 18, hub: 10, kingpin: 1, trailerbody: 1, engine: 5, fifth: 1};
export const REFERENCE_REVISION = 'reference-v3';
export type CadAssembly = ReturnType<typeof buildCadGroups>;

/** Consume both scenes. Do not hide a missing revision by silently showing v2. */
export function mergeReferenceScenes(baseSource: T.Group, extraSource: T.Group): CadAssembly {
  let base: CadAssembly | undefined;
  let extra: CadAssembly | undefined;
  try {
    const assembly = extraSource.getObjectByName(ASSEMBLY);
    if (!assembly || assembly.userData.revision !== REFERENCE_REVISION ||
        assembly.userData.units !== 'metres' || assembly.userData.verifiedOemReplica !== false) {
      throw new Error('Unrecognized reference overlay, units or accuracy metadata');
    }
    const sourceLabels: Record<string, string[]> = {};
    for (const group of assembly.children) {
      if (!(group.name in MODES)) throw new Error(`Unexpected overlay group: ${group.name}`);
      const key = group.name as keyof typeof MODES;
      if (group.children.length !== EXPECTED[key]) throw new Error(`Invalid instance count: ${key}`);
      if (sourceLabels[key]) throw new Error(`Duplicate overlay group: ${key}`);
      sourceLabels[key] = group.children.map(instance => {
        const label: unknown = instance.userData.label;
        if (typeof label !== 'string' || !label.trim()) throw new Error(`Missing overlay label: ${key}`);
        return label;
      });
    }
    if (Object.keys(sourceLabels).length !== Object.keys(MODES).length) {
      throw new Error('Incomplete reference overlay');
    }
    base = buildCadGroups(baseSource);
    extra = buildCadGroups(extraSource);
    const originalCount = Object.keys(base.groups).length;
    // Check the full plan before replacing or moving any base instances.
    for (const key of Object.keys(MODES) as (keyof typeof MODES)[]) {
      if (!base.groups[key] || !extra.groups[key]) throw new Error(`Missing assembly group: ${key}`);
      extra.groups[key].children.forEach((instance, index) => {
        instance.userData.label = sourceLabels[key][index];
        instance.userData.referenceRevision = REFERENCE_REVISION;
        instance.userData.verifiedOemReplica = false;
      });
    }
    for (const key of Object.keys(MODES) as (keyof typeof MODES)[]) {
      const oldGroup = base.groups[key], newGroup = extra.groups[key];
      if (MODES[key] === 'replace') {
        base.root.remove(oldGroup);
        disposeCadObject(oldGroup);
        base.root.add(newGroup); // Three reparents it from the temporary root.
        base.groups[key] = newGroup;
      } else {
        // Keep original engine/radiator indices and append new physical instances.
        // Direct mesh -> instance -> inspection group hierarchy is preserved.
        oldGroup.add(...[...newGroup.children]);
      }
    }
    if (Object.keys(base.groups).length !== originalCount) throw new Error('Inspection groups changed');
    base.root.userData.referenceRevision = REFERENCE_REVISION;
    base.root.userData.verifiedOemReplica = false;
    base.root.updateMatrixWorld(true);
    disposeCadObject(extra.root);
    return base;
  } catch (error) {
    if (base) disposeCadObject(base.root);
    if (extra) disposeCadObject(extra.root);
    throw error;
  } finally {
    // buildCadGroups consumes source resources; disposal is also safe when it
    // throws before consuming a scene, and does not affect its cloned geometry.
    disposeCadObject(baseSource);
    disposeCadObject(extraSource);
  }
}

/** Fetch the unchanged v2 base and the small original-detail revision in parallel. */
export async function loadReferenceRevision(
  loader: GLTFLoader, onProgress?: (percent: number) => void,
): Promise<CadAssembly> {
  const paths = ['/cad/cascadia-dd15-v2.glb', '/cad/reference-v3-web.glb'];
  const fractions = [0, 0];
  const loads = paths.map((path, index) => loader.loadAsync(path, event => {
    if (event.lengthComputable && event.total > 0) {
      fractions[index] = Math.min(1, event.loaded / event.total);
      onProgress?.(Math.min(99, Math.round(50 * (fractions[0] + fractions[1]))));
    }
  }).then(gltf => {fractions[index] = 1; return gltf;}));
  const results = await Promise.allSettled(loads);
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    for (const result of results) if (result.status === 'fulfilled') disposeCadObject(result.value.scene);
    throw new Error(`Reference revision failed to load: ${failures.map(r => String(r.reason)).join('; ')}`);
  }
  const first = results[0], second = results[1];
  if (first.status !== 'fulfilled' || second.status !== 'fulfilled') throw new Error('Incomplete CAD load');
  const cad = mergeReferenceScenes(first.value.scene, second.value.scene);
  onProgress?.(100);
  return cad;
}
