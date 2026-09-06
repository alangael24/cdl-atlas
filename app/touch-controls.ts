import {TOUCH} from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function configureTouchControls(controls:OrbitControls){
 // Direct screen-space translation keeps an offscreen part reachable with one finger.
 controls.touches.ONE=TOUCH.PAN;
 controls.touches.TWO=TOUCH.DOLLY_ROTATE;
 controls.screenSpacePanning=true;
 controls.panSpeed=1;
 // Stop immediately on release; inertia makes close inspection hard to control.
 controls.enableDamping=false;
}
