import * as THREE from 'three';

const matWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.08 });
const matSteel = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.65 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.2 });
const matTeal = new THREE.MeshStandardMaterial({ color: 0x0f768a, roughness: 0.45, metalness: 0.1 });
const matBlue = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, metalness: 0.1 });
const matWood = new THREE.MeshStandardMaterial({ color: 0xd6b88d, roughness: 0.75, metalness: 0.02 });
const matGreen = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4, metalness: 0.1 });
const matGlass = new THREE.MeshPhysicalMaterial({
  color: 0xbae6fd,
  transparent: true,
  opacity: 0.4,
  roughness: 0.1,
});

function tagEquipment(group: THREE.Group, roomId: string, eqType: string, idx: number): THREE.Group {
  const itemId = `${roomId}.eq-${idx}`;
  group.userData.itemId = itemId;
  group.userData.equipmentType = eqType;
  group.traverse((obj) => {
    obj.userData.itemId = itemId;
    obj.userData.equipmentType = eqType;
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}

/**
 * Procedural 3D medical furniture & clinical equipment library.
 */
export class Furniture {
  static create(eqType: string, roomId: string, idx: number): THREE.Group {
    const g = new THREE.Group();
    switch (eqType) {
      case 'hospital-bed':
      case 'exam-bed':
        this.buildBed(g, eqType === 'exam-bed');
        break;
      case 'bedside-cabinet':
        this.buildCabinet(g);
        break;
      case 'patient-monitor':
        this.buildMonitor(g);
        break;
      case 'headwall':
        this.buildHeadwall(g);
        break;
      case 'incubator':
        this.buildIncubator(g);
        break;
      case 'ventilator':
        this.buildVentilator(g);
        break;
      case 'iv-pole':
        this.buildIvPole(g);
        break;
      case 'chemo-recliner':
        this.buildRecliner(g);
        break;
      case 'operating-table':
        this.buildOperatingTable(g);
        break;
      case 'surgical-lights':
        this.buildSurgicalLights(g);
        break;
      case 'anesthesia-machine':
        this.buildAnesthesia(g);
        break;
      case 'mri-gantry':
        this.buildMriGantry(g);
        break;
      case 'control-console':
      case 'nurse-workstation':
      case 'office-desk':
        this.buildDeskWithMonitor(g, eqType === 'nurse-workstation' ? 2.2 : 1.4);
        break;
      case 'autoclave':
      case 'biosafety-cabinet':
      case 'milk-fridge':
        this.buildTallAppliance(g, eqType === 'biosafety-cabinet' ? matTeal : matSteel);
        break;
      case 'reception-desk':
        this.buildReceptionDesk(g);
        break;
      case 'waiting-chairs':
        this.buildWaitingRow(g);
        break;
      case 'cafeteria-table':
        this.buildDiningSet(g);
        break;
      case 'conference-table':
        this.buildConferenceTable(g);
        break;
      case 'medical-gas-manifold':
        this.buildMedGas(g);
        break;
      case 'sink':
        this.buildSink(g);
        break;
      case 'hepa-unit':
        this.buildHepa(g);
        break;
      case 'vr-station':
        this.buildVrPod(g);
        break;
      case 'hydro-pool':
        this.buildHydroPool(g);
        break;
      case 'physio-plinth':
        this.buildBed(g, true);
        break;
      case 'privacy-curtain':
        this.buildPrivacyCurtain(g);
        break;
      case 'toilet-fixture':
        this.buildToilet(g);
        break;
      case 'side-table':
        this.buildSideTable(g);
        break;
      case 'balcony-rail':
        this.buildBalconyRail(g);
        break;
      case 'glass-partition':
        this.buildGlassPartition(g);
        break;
      case 'lead-glass-window':
        this.buildLeadGlass(g);
        break;
      case 'sluice-sink':
        this.buildSluiceSink(g);
        break;
      case 'locker-bank':
      case 'utility-rack':
      default:
        this.buildRackOrLockers(g, eqType === 'locker-bank');
        break;
    }
    return tagEquipment(g, roomId, eqType, idx);
  }

  private static buildBed(g: THREE.Group, slim: boolean): void {
    const w = slim ? 0.8 : 1.05;
    const l = slim ? 1.9 : 2.1;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, l), matSteel);
    frame.position.y = 0.35;
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.18, l - 0.08), matWhite);
    mattress.position.y = 0.56;
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, 0.1, 0.35), matBlue);
    pillow.position.set(0, 0.68, -l / 2 + 0.28);
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(w, 0.55, 0.08), matTeal);
    headboard.position.set(0, 0.6, -l / 2);
    g.add(frame, mattress, pillow, headboard);
  }

  private static buildCabinet(g: THREE.Group): void {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.78, 0.45), matWood);
    box.position.y = 0.39;
    g.add(box);
  }

  private static buildMonitor(g: THREE.Group): void {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.35, 8), matSteel);
    stand.position.y = 0.675;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.08), matDark);
    screen.position.y = 1.4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), matGreen);
    face.position.set(0, 1.4, 0.042);
    g.add(stand, screen, face);
  }

  private static buildHeadwall(g: THREE.Group): void {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.08), matSteel);
    panel.position.y = 1.45;
    g.add(panel);
  }

  private static buildIncubator(g: THREE.Group): void {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.6), matWhite);
    base.position.y = 0.425;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.5, 0.54), matGlass);
    hood.position.y = 1.1;
    g.add(base, hood);
  }

  private static buildVentilator(g: THREE.Group): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.42), matWhite);
    body.position.y = 0.575;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.06), matBlue);
    screen.position.set(0, 1.28, 0.12);
    g.add(body, screen);
  }

  private static buildIvPole(g: THREE.Group): void {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), matSteel);
    base.position.y = 0.03;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.85, 8), matSteel);
    pole.position.y = 0.95;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.06), matBlue);
    bag.position.set(0.1, 1.72, 0);
    g.add(base, pole, bag);
  }

  private static buildRecliner(g: THREE.Group): void {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.85), matTeal);
    seat.position.y = 0.42;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.8, 0.2), matTeal);
    back.position.set(0, 0.78, -0.38);
    back.rotation.x = -0.25;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.45), matTeal);
    foot.position.set(0, 0.28, 0.58);
    g.add(seat, back, foot);
  }

  private static buildOperatingTable(g: THREE.Group): void {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.75, 12), matSteel);
    ped.position.y = 0.375;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 2.05), matDark);
    top.position.y = 0.82;
    g.add(ped, top);
  }

  private static buildSurgicalLights(g: THREE.Group): void {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), matSteel);
    boom.position.y = 2.9;
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 0.12, 16), matWhite);
    dish.position.y = 2.35;
    g.add(boom, dish);
  }

  private static buildAnesthesia(g: THREE.Group): void {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.15, 0.55), matWhite);
    cart.position.y = 0.575;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.3), matDark);
    top.position.set(0, 1.32, -0.1);
    g.add(cart, top);
  }

  private static buildMriGantry(g: THREE.Group): void {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.38, 12, 24), matWhite);
    ring.position.y = 1.25;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.1), matSteel);
    base.position.y = 0.2;
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 2.2), matTeal);
    table.position.set(0, 0.375, 1.45);
    g.add(ring, base, table);
  }

  private static buildDeskWithMonitor(g: THREE.Group, width: number): void {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.75, 0.75), matWood);
    desk.position.y = 0.375;
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.05), matDark);
    mon.position.set(0, 0.98, -0.15);
    g.add(desk, mon);
  }

  private static buildTallAppliance(g: THREE.Group, mat: THREE.Material): void {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.75), mat);
    body.position.y = 0.95;
    g.add(body);
  }

  private static buildReceptionDesk(g: THREE.Group): void {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 0.8), matTeal);
    base.position.y = 0.525;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.9), matWhite);
    counter.position.y = 1.08;
    g.add(base, counter);
  }

  private static buildWaitingRow(g: THREE.Group): void {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.1), matSteel);
    beam.position.y = 0.36;
    g.add(beam);
    for (let i = -1; i <= 1; i += 1) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.48), matTeal);
      seat.position.set(i * 0.7, 0.44, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.08), matTeal);
      back.position.set(i * 0.7, 0.68, -0.2);
      g.add(seat, back);
    }
  }

  private static buildDiningSet(g: THREE.Group): void {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 16), matWood);
    top.position.y = 0.74;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.72, 10), matSteel);
    leg.position.y = 0.36;
    g.add(top, leg);
  }

  private static buildConferenceTable(g: THREE.Group): void {
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.4), matWood);
    top.position.y = 0.74;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.5), matSteel);
    base.position.y = 0.35;
    g.add(top, base);
  }

  private static buildMedGas(g: THREE.Group): void {
    for (let i = -1; i <= 1; i += 1) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 12), matBlue);
      tank.position.set(i * 0.7, 0.8, 0);
      g.add(tank);
    }
  }

  private static buildSink(g: THREE.Group): void {
    const basin = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.82, 0.5), matWhite);
    basin.position.y = 0.41;
    g.add(basin);
  }

  private static buildHepa(g: THREE.Group): void {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.45), matWhite);
    unit.position.y = 0.8;
    g.add(unit);
  }

  private static buildVrPod(g: THREE.Group): void {
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 20), matTeal);
    mat.position.y = 0.03;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.7, 0.3), matDark);
    tower.position.set(0, 0.85, -0.8);
    g.add(mat, tower);
  }

  private static buildHydroPool(g: THREE.Group): void {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.55, 3.2), matWhite);
    rim.position.y = 0.275;
    const water = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.58, 2.6), matBlue);
    water.position.y = 0.28;
    g.add(rim, water);
  }

  private static buildRackOrLockers(g: THREE.Group, isLocker: boolean): void {
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.85, 0.5),
      isLocker ? matTeal : matSteel,
    );
    rack.position.y = 0.925;
    g.add(rack);
  }

  private static buildPrivacyCurtain(g: THREE.Group): void {
    const curtain = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 2.1, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.9 }),
    );
    curtain.position.y = 1.25;
    g.add(curtain);
  }

  private static buildToilet(g: THREE.Group): void {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.55), matWhite);
    base.position.y = 0.21;
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.18), matWhite);
    tank.position.set(0, 0.58, -0.2);
    g.add(base, tank);
  }

  private static buildSideTable(g: THREE.Group): void {
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), matWood);
    top.position.y = 0.58;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.14, 0.56, 8), matSteel);
    leg.position.y = 0.28;
    g.add(top, leg);
  }

  private static buildBalconyRail(g: THREE.Group): void {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 2.6), matGlass);
    rail.position.y = 0.525;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 2.65), matSteel);
    cap.position.y = 1.08;
    g.add(rail, cap);
  }

  private static buildGlassPartition(g: THREE.Group): void {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 2.4), matGlass);
    wall.position.y = 1.2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.45), matSteel);
    frame.position.y = 2.42;
    g.add(wall, frame);
  }

  private static buildLeadGlass(g: THREE.Group): void {
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.0, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0f768a, transparent: true, opacity: 0.55, roughness: 0.15 }),
    );
    pane.position.y = 1.45;
    g.add(pane);
  }

  private static buildSluiceSink(g: THREE.Group): void {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.88, 0.6), matSteel);
    unit.position.y = 0.44;
    g.add(unit);
  }
}
