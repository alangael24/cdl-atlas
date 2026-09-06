import {TOUCH} from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function configureTouchControls(controls:OrbitControls){
 // Direct screen-space translation keeps an offscreen part reachable with two fingers.
 controls.touches.ONE=TOUCH.ROTATE;
 controls.touches.TWO=TOUCH.DOLLY_PAN;
 controls.screenSpacePanning=true;
 controls.panSpeed=1;
 // Stop immediately on release; inertia makes close inspection hard to control.
 controls.enableDamping=false;
}
