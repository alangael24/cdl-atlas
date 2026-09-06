// Run from the repository: node --experimental-strip-types scripts/check-reference-v3.mjs
// Requires the project's existing three dependency. Does not require WebGL or Draco.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildCadGroups, disposeCadObject} from '../app/cad-model.ts';

const manifest = JSON.parse(fs.readFileSync(new URL('../public/cad/reference-v3.json', import.meta.url)));
const raw = fs.readFileSync(new URL('../public/cad/reference-v3.glb', import.meta.url));
const {createHash} = await import('node:crypto');
assert.equal(createHash('sha256').update(raw).digest('hex'), manifest.sha256);
const gltf = await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset+raw.byteLength), '');
const source = gltf.scene.getObjectByName('CDL_Cascadia_DD15_53ft');
assert.equal(source.userData.revision, 'reference-v3');
assert.equal(source.userData.verifiedOemReplica, false);
const labels = Object.fromEntries(source.children.map(g => [g.name,g.children.map(i => i.userData.label)]));
const {root,groups} = buildCadGroups(gltf.scene);
assert.deepEqual(Object.keys(groups).sort(), Object.keys(manifest.groupModes).sort());
let instances = 0, triangles = 0;
for (const [id, group] of Object.entries(groups)) {
  assert.deepEqual(labels[id],manifest.instanceLabels[id]);
  assert.equal(group.children.length, manifest.instanceLabels[id].length);
  for (const instance of group.children) {
    instances++;
    assert.ok(instance.userData.base instanceof T.Vector3);
    assert.equal(instance.userData.part,id);
    const bounds = new T.Box3().setFromObject(instance);
    assert.ok(!bounds.isEmpty());
    assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));
    for (const mesh of instance.children) {
      assert.ok(mesh instanceof T.Mesh);
      assert.equal(mesh.parent,instance);
      assert.equal(mesh.userData.part,id);
      triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count)/3;
    }
  }
}
assert.equal(instances,36);
assert.equal(triangles,manifest.triangles);
assert.ok(triangles < 500000);
assert.equal(groups.rim.children.length,18);
assert.equal(groups.hub.children.length,10);
console.log({status:'passed',instances,triangles,groups:Object.keys(groups).length});
disposeCadObject(root);
