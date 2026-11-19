import * as THREE from 'three';
import './styles/main.css';
import hospitalJson from './data/hospital.json';
import roomTypesJson from './data/roomTypes.json';
import equipmentJson from './data/equipment.json';
import drugsJson from './data/drugs.json';
import { HospitalData, RoomTypesMap } from './core/HospitalTypes';
import { DrugSpec } from './rooms/PharmacyTypes';
import { HospitalIndex } from './core/HospitalIndex';
import { EventBus } from './core/Events';
import { StateStore } from './core/StateStore';
import { Engine } from './core/Engine';
import { CameraRig } from './core/CameraRig';
import { Picker } from './core/Picker';
import { Lighting } from './world/Lighting';
import { BuildingBuilder } from './world/BuildingBuilder';
import { Atmosphere } from './world/Atmosphere';
import { AmbientAudio } from './core/AmbientAudio';
import { GuidedTour } from './core/GuidedTour';
import { EquipmentEntry } from './ui/InfoPanel';
import { Hud } from './ui/Hud';

function setLoadingProgress(pct: number, text: string): void {
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  if (bar) bar.style.width = `${pct}%`;
  if (status) status.textContent = text;
}

function bootstrap(): void {
  const container = document.getElementById('canvas-container');
  const hudRoot = document.getElementById('hud-root');
  if (!container || !hudRoot) {
    throw new Error('Required DOM containers (#canvas-container, #hud-root) are missing.');
  }

  setLoadingProgress(25, 'Loading hospital floor plans & 120 medications...');
  const hospitalData = hospitalJson as HospitalData;
  const roomTypes = roomTypesJson as RoomTypesMap;
  const equipmentMap = equipmentJson as Record<string, EquipmentEntry>;
  const drugs = drugsJson as DrugSpec[];
  const index = new HospitalIndex(hospitalData);

  const bus = new EventBus();
  const store = new StateStore(bus, {
    activeFloor: null,
    ceilingsVisible: true,
  });

  const engine = new Engine(container, bus);
  const lighting = new Lighting(engine.scene);

  const cameraRig = new CameraRig(engine.camera, engine.renderer.domElement);
  cameraRig.setOrbitPreset();

  setLoadingProgress(65, 'Building 3D floors, interiors & pharmacy...');
  const buildingBuilder = new BuildingBuilder();
  buildingBuilder.build(hospitalData, drugs);
  buildingBuilder.setCeilingsVisible(store.getState().ceilingsVisible);
  engine.scene.add(buildingBuilder.root);

  const atmosphere = new Atmosphere(hospitalData);
  engine.scene.add(atmosphere.group);
  const ambientAudio = new AmbientAudio();
  const guidedTour = new GuidedTour(bus);

  const picker = new Picker(
    engine.renderer.domElement,
    engine.camera,
    bus,
    () => buildingBuilder.getRaycastTargets(),
    (id) => buildingBuilder.getRoomGroup(id),
  );

  const hud = new Hud(hudRoot, store, bus, index, roomTypes, equipmentMap, drugs, (jx, jy) => {
    cameraRig.setWalkInput(jx, jy);
  });

  bus.on('state:changed', ({ key, value }) => {
    if (key === 'ceilingsVisible') {
      buildingBuilder.setCeilingsVisible(Boolean(value));
    }
  });

  bus.on('floor:view', ({ viewMode, floorId }) => {
    cameraRig.exitWalkMode();
    hud.setJoystickVisible(false);
    picker.setItemMode(false);
    picker.setEnabled(true);
    buildingBuilder.setHiddenCeilingRoom(null);
    buildingBuilder.setViewMode(viewMode, floorId);

    if (viewMode === 'isolate' && floorId) {
      store.set('activeFloor', floorId);
      store.set('mode', 'FLOOR');
      const floor = index.floors.find((f) => f.id === floorId);
      if (floor) {
        cameraRig.flyToFloor((floor.level - 1) * hospitalData.building.floorHeight);
      }
    } else {
      store.set('activeFloor', null);
      store.set('activeRoom', null);
      store.set('mode', 'EXTERIOR');
      picker.setSelectedRoom(null);
      if (viewMode === 'whole') {
        cameraRig.setOrbitPreset();
      }
    }
  });

  bus.on('room:select', ({ roomId }) => {
    if (!roomId) {
      if (store.getState().mode !== 'ROOM') {
        store.set('activeRoom', null);
      }
      return;
    }
    const entry = index.rooms.get(roomId);
    if (!entry) return;
    store.set('activeFloor', entry.floor.id);
    store.set('activeRoom', roomId);
    if (store.getState().mode === 'EXTERIOR') {
      store.set('mode', 'FLOOR');
    }
  });

  bus.on('room:enter', ({ roomId }) => {
    const entry = index.rooms.get(roomId);
    if (!entry) return;

    buildingBuilder.setViewMode('isolate', entry.floor.id);
    buildingBuilder.setHiddenCeilingRoom(roomId);
    picker.setSelectedRoom(roomId);
    picker.setItemMode(true);
    picker.setEnabled(true);

    store.set('activeFloor', entry.floor.id);
    store.set('activeRoom', roomId);
    store.set('mode', 'ROOM');

    hud.setJoystickVisible(false);
    cameraRig.flyToRoomDollhouse(entry.center, entry.floorY);
  });

  bus.on('camera:toggleWalk', () => {
    if (cameraRig.isWalking()) {
      cameraRig.exitWalkMode();
      hud.setJoystickVisible(false);
      const s = store.getState();
      const entry = s.activeRoom ? index.rooms.get(s.activeRoom) : null;
      if (entry) cameraRig.flyToRoomDollhouse(entry.center, entry.floorY);
      return;
    }

    const s = store.getState();
    const floorId = s.activeFloor ?? 'L1';
    const floorWalk = index.getFloorWalkData(floorId);
    const entry = s.activeRoom ? index.rooms.get(s.activeRoom) : null;
    if (!floorWalk) return;

    const startPos = entry ? entry.doorEntry.inside : new THREE.Vector3(0, floorWalk.floorY + 1.65, 0);
    const lookAt = entry ? entry.doorEntry.lookAt : startPos.clone().add(new THREE.Vector3(0, 0, -2));
    cameraRig.enterWalkMode(floorWalk, startPos, lookAt);
    hud.setJoystickVisible(true);
  });

  bus.on('search:flyto', ({ roomId }) => {
    const entry = index.rooms.get(roomId);
    if (!entry) return;

    cameraRig.exitWalkMode();
    picker.setItemMode(false);
    picker.setEnabled(true);
    buildingBuilder.setHiddenCeilingRoom(null);
    buildingBuilder.setViewMode('isolate', entry.floor.id);
    picker.setSelectedRoom(roomId);

    store.set('activeFloor', entry.floor.id);
    store.set('activeRoom', roomId);
    store.set('mode', 'FLOOR');

    const camPos = entry.center.clone().add(new THREE.Vector3(12, 16, 14));
    cameraRig.flyToOrbit(entry.center, camPos, 0.8);
  });

  bus.on('nav:up', () => {
    const s = store.getState();
    if (s.mode === 'ITEM') {
      store.set('selectedItem', null);
      store.set('mode', 'ROOM');
      return;
    }
    if (s.mode === 'ROOM') {
      cameraRig.exitWalkMode();
      picker.setItemMode(false);
      picker.setEnabled(true);
      buildingBuilder.setHiddenCeilingRoom(null);
      store.set('mode', 'FLOOR');
      const entry = s.activeRoom ? index.rooms.get(s.activeRoom) : null;
      if (entry) {
        const camPos = entry.center.clone().add(new THREE.Vector3(10, 14, 12));
        cameraRig.flyToOrbit(entry.center, camPos, 0.65);
      }
      return;
    }
    if (s.mode === 'FLOOR') {
      if (s.activeRoom) {
        store.set('activeRoom', null);
        picker.setSelectedRoom(null);
      } else {
        bus.emit('floor:view', { viewMode: 'whole', floorId: null });
        cameraRig.setOrbitPreset();
      }
    }
  });

  bus.on('camera:preset', ({ preset }) => {
    picker.setEnabled(true);
    if (preset === 'topdown') {
      cameraRig.setTopDownPreset();
    } else {
      cameraRig.setOrbitPreset();
    }
  });

  bus.on('labels:toggle', ({ visible }) => {
    buildingBuilder.setLabelsVisible(visible);
  });

  bus.on('pharmacy:cabinet', ({ cabinetId }) => {
    const cab = buildingBuilder.pharmacyBuilder.cabinets.get(cabinetId);
    if (!cab) return;
    if (cab.meta.isControlled && !buildingBuilder.pharmacyBuilder.controlledUnlocked) {
      hud.pharmacyPanel.openControlledBadgePrompt();
      return;
    }
    buildingBuilder.pharmacyBuilder.toggleCabinet(cabinetId);
    cameraRig.faceTarget(cab.facePos, cab.lookAt);
  });

  bus.on('pharmacy:unlockControlled', () => {
    buildingBuilder.pharmacyBuilder.unlockControlled();
    const cab = buildingBuilder.pharmacyBuilder.cabinets.get('K');
    if (cab) cameraRig.faceTarget(cab.facePos, cab.lookAt);
  });

  bus.on('pharmacy:drug', ({ drugId }) => {
    hud.pharmacyPanel.showDrug(drugId);
  });

  bus.on('pharmacy:dispenseOpen', () => {
    hud.pharmacyPanel.openDispenseModal();
  });

  bus.on('pharmacy:dispense', ({ drugId }) => {
    buildingBuilder.pharmacyBuilder.triggerDispenseAnimation(drugId);
  });

  bus.on('pharmacy:search', ({ query }) => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? drugs.filter((d) =>
          `${d.genericName} ${d.brandExamples.join(' ')} ${d.drugClass}`.toLowerCase().includes(q),
        )
      : [];
    buildingBuilder.pharmacyBuilder.highlightDrugs(new Set(matches.map((m) => m.id)));
    if (matches.length > 0) {
      const cab = buildingBuilder.pharmacyBuilder.cabinets.get(matches[0].cabinet);
      if (cab) {
        if (!cab.meta.isControlled || buildingBuilder.pharmacyBuilder.controlledUnlocked) {
          if (!cab.isOpen) buildingBuilder.pharmacyBuilder.toggleCabinet(cab.meta.id);
        }
        cameraRig.faceTarget(cab.facePos, cab.lookAt);
      }
    }
  });

  bus.on('ui:daynight', ({ night }) => {
    lighting.setNightMode(night, engine.scene);
  });

  bus.on('ui:sound', ({ enabled }) => {
    ambientAudio.setEnabled(enabled);
  });

  bus.on('ui:quality', ({ low }) => {
    engine.setLowQuality(low);
  });

  bus.on('tour:start', () => {
    guidedTour.start();
  });

  bus.on('tour:stop', () => {
    guidedTour.stop();
  });

  engine.onUpdate((dt) => {
    buildingBuilder.update(dt);
    atmosphere.update(dt);
    guidedTour.update(dt);
    cameraRig.update(dt);
    hud.updateMinimap(engine.camera.position, cameraRig.getYaw());
  });

  engine.start();

  setLoadingProgress(100, 'Ready!');
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    setTimeout(() => loadingScreen.classList.add('fade-out'), 180);
  }
}

bootstrap();
