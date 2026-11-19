import * as THREE from 'three';
import { DrugSpec } from './PharmacyTypes';

const labelTexCache = new Map<string, THREE.CanvasTexture>();

const boxGeo = new THREE.BoxGeometry(0.16, 0.11, 0.08);
const blisterStripGeo = new THREE.BoxGeometry(0.14, 0.015, 0.06);
const bottleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.13, 12);
const bottleNeckGeo = new THREE.CylinderGeometry(0.025, 0.032, 0.025, 10);
const bottleCapGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.025, 10);
const vialGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10);
const vialCapGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.018, 10);
const ivBagGeo = new THREE.BoxGeometry(0.13, 0.17, 0.038);
const ivPortGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8);
const inhalerBodyGeo = new THREE.BoxGeometry(0.045, 0.12, 0.045);
const inhalerMouthGeo = new THREE.BoxGeometry(0.042, 0.04, 0.06);
const inhalerCanGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.05, 10);
const penGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.16, 10);
const tubeGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.14, 10);

const capMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
const metalCapMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.75 });
const blisterMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.45 });

function getDrugLabelTexture(drug: DrugSpec, accentColor: string): THREE.CanvasTexture {
  const cached = labelTexCache.get(drug.id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, 256, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`CAB ${drug.cabinet} · ${drug.form.toUpperCase()}`, 10, 18);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(drug.genericName.slice(0, 22), 10, 62);

  ctx.fillStyle = '#0c6273';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(drug.strength.slice(0, 24), 10, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelTexCache.set(drug.id, tex);
  return tex;
}

/**
 * Creates distinct procedural 3D medication packaging by dosage form
 * (blister carton, bottle with neck/cap, crimp-cap vial, L-shaped inhaler, IV pouch, injector pen, tube).
 */
export function createDrugMesh(drug: DrugSpec, accentColor: string): THREE.Group {
  const g = new THREE.Group();
  const tex = getDrugLabelTexture(drug, accentColor);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.45,
    metalness: 0.05,
  });

  const form = drug.form.toLowerCase();

  if (form.includes('bottle')) {
    const body = new THREE.Mesh(bottleGeo, mat);
    body.position.y = 0.065;
    const neck = new THREE.Mesh(bottleNeckGeo, capMat);
    neck.position.y = 0.142;
    const cap = new THREE.Mesh(bottleCapGeo, capMat);
    cap.position.y = 0.165;
    g.add(body, neck, cap);
  } else if (form.includes('vial')) {
    const body = new THREE.Mesh(vialGeo, mat);
    body.position.y = 0.045;
    const cap = new THREE.Mesh(vialCapGeo, metalCapMat);
    cap.position.y = 0.098;
    g.add(body, cap);
  } else if (form.includes('iv bag')) {
    const body = new THREE.Mesh(ivBagGeo, mat);
    body.position.y = 0.1;
    const port = new THREE.Mesh(ivPortGeo, capMat);
    port.position.y = 0.012;
    g.add(body, port);
  } else if (form.includes('inhaler')) {
    const body = new THREE.Mesh(inhalerBodyGeo, mat);
    body.position.y = 0.06;
    const mouth = new THREE.Mesh(inhalerMouthGeo, capMat);
    mouth.position.set(0, 0.02, 0.035);
    const can = new THREE.Mesh(inhalerCanGeo, metalCapMat);
    can.position.y = 0.135;
    g.add(body, mouth, can);
  } else if (form.includes('pen')) {
    const body = new THREE.Mesh(penGeo, mat);
    body.position.y = 0.08;
    const cap = new THREE.Mesh(vialCapGeo, capMat);
    cap.position.y = 0.168;
    g.add(body, cap);
  } else if (form.includes('tube')) {
    const body = new THREE.Mesh(tubeGeo, mat);
    body.position.y = 0.07;
    const cap = new THREE.Mesh(vialCapGeo, capMat);
    cap.position.y = 0.145;
    g.add(body, cap);
  } else {
    const body = new THREE.Mesh(boxGeo, mat);
    body.position.y = 0.055;
    if (form.includes('tablet') || form.includes('capsule')) {
      const blister = new THREE.Mesh(blisterStripGeo, blisterMat);
      blister.position.set(0, 0.118, 0);
      g.add(blister);
    }
    g.add(body);
  }

  g.userData.drugId = drug.id;
  g.userData.cabinetId = drug.cabinet;
  g.traverse((obj) => {
    obj.userData.drugId = drug.id;
    obj.userData.cabinetId = drug.cabinet;
  });

  return g;
}
