import * as THREE from 'three';
import { DrugSpec } from './PharmacyTypes';

const labelTexCache = new Map<string, THREE.CanvasTexture>();

const boxGeo = new THREE.BoxGeometry(0.16, 0.11, 0.08);
const bottleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 12);
const vialGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10);
const ivBagGeo = new THREE.BoxGeometry(0.13, 0.18, 0.04);
const inhalerGeo = new THREE.BoxGeometry(0.06, 0.14, 0.05);
const penGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10);

const capMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

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

  ctx.fillStyle = '#0f768a';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(drug.strength.slice(0, 24), 10, 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelTexCache.set(drug.id, tex);
  return tex;
}

/**
 * Creates a procedural 3D medication mesh shaped by dosage form with a labeled texture.
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
  let body: THREE.Mesh;

  if (form.includes('bottle')) {
    body = new THREE.Mesh(bottleGeo, mat);
    body.position.y = 0.07;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10), capMat);
    cap.position.y = 0.155;
    g.add(cap);
  } else if (form.includes('vial')) {
    body = new THREE.Mesh(vialGeo, mat);
    body.position.y = 0.045;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 10), capMat);
    cap.position.y = 0.098;
    g.add(cap);
  } else if (form.includes('iv bag')) {
    body = new THREE.Mesh(ivBagGeo, mat);
    body.position.y = 0.09;
  } else if (form.includes('inhaler')) {
    body = new THREE.Mesh(inhalerGeo, mat);
    body.position.y = 0.07;
  } else if (form.includes('pen')) {
    body = new THREE.Mesh(penGeo, mat);
    body.position.y = 0.08;
  } else {
    body = new THREE.Mesh(boxGeo, mat);
    body.position.y = 0.055;
  }

  g.add(body);
  g.userData.drugId = drug.id;
  g.userData.cabinetId = drug.cabinet;
  g.traverse((obj) => {
    obj.userData.drugId = drug.id;
    obj.userData.cabinetId = drug.cabinet;
  });

  return g;
}
