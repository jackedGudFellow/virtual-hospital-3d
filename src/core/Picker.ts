import * as THREE from 'three';
import { EventBus } from './Events';

/**
 * Raycasting, hover/selection emissive highlighting, and click/double-click room resolution.
 */
export class Picker {
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private domElement: HTMLElement;
  private camera: THREE.Camera;
  private bus: EventBus;
  private getTargets: () => THREE.Object3D[];
  private getRoomGroup: (id: string) => THREE.Group | undefined;

  private hoveredRoomId: string | null = null;
  private selectedRoomId: string | null = null;
  private downPos = { x: 0, y: 0 };
  private enabled = true;
  private itemMode = false;

  constructor(
    domElement: HTMLElement,
    camera: THREE.Camera,
    bus: EventBus,
    getTargets: () => THREE.Object3D[],
    getRoomGroup: (id: string) => THREE.Group | undefined,
  ) {
    this.domElement = domElement;
    this.camera = camera;
    this.bus = bus;
    this.getTargets = getTargets;
    this.getRoomGroup = getRoomGroup;

    domElement.addEventListener('pointermove', this.onPointerMove);
    domElement.addEventListener('pointerdown', this.onPointerDown);
    domElement.addEventListener('pointerup', this.onPointerUp);
    domElement.addEventListener('dblclick', this.onDoubleClick);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.setHoveredRoom(null, 0, 0);
      this.domElement.style.cursor = '';
    }
  }

  setItemMode(active: boolean): void {
    this.itemMode = active;
    if (active) {
      this.setHoveredRoom(null, 0, 0);
    } else {
      this.bus.emit('item:hover', { equipmentType: null, x: 0, y: 0 });
    }
  }

  setSelectedRoom(roomId: string | null): void {
    if (this.selectedRoomId === roomId) return;
    const prev = this.selectedRoomId;
    this.selectedRoomId = roomId;
    if (prev) this.refreshRoomHighlight(prev);
    if (roomId) this.refreshRoomHighlight(roomId);
  }

  resolveId(object: THREE.Object3D | null): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData?.id === 'string') {
        return current.userData.id;
      }
      current = current.parent;
    }
    return null;
  }

  private pickRoomAt(clientX: number, clientY: number): string | null {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.getTargets(), true);
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const id = this.resolveId(hit.object);
      if (id) return id;
    }
    return null;
  }

  private pickItemAt(
    clientX: number,
    clientY: number,
  ): {
    itemId?: string;
    equipmentType?: string;
    drugId?: string;
    cabinetId?: string;
    pharmacyAction?: string;
    floorPoint?: THREE.Vector3;
  } | null {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.getTargets(), true);
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      const ud = hit.object.userData ?? {};
      if (typeof ud.drugId === 'string') return { drugId: ud.drugId, cabinetId: ud.cabinetId };
      if (typeof ud.pharmacyAction === 'string') return { pharmacyAction: ud.pharmacyAction };
      if (typeof ud.cabinetId === 'string') return { cabinetId: ud.cabinetId };
      if (typeof ud.itemId === 'string' && typeof ud.equipmentType === 'string') {
        return { itemId: ud.itemId, equipmentType: ud.equipmentType };
      }
      if (ud.isFloor) {
        return { floorPoint: hit.point.clone() };
      }
    }
    return null;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return;
    if (this.itemMode) {
      const hit = this.pickItemAt(e.clientX, e.clientY);
      this.domElement.style.cursor = hit ? 'pointer' : '';
      this.bus.emit('item:hover', { equipmentType: hit?.equipmentType ?? null, x: e.clientX, y: e.clientY });
      return;
    }
    const roomId = this.pickRoomAt(e.clientX, e.clientY);
    this.setHoveredRoom(roomId, e.clientX, e.clientY);
    this.domElement.style.cursor = roomId ? 'pointer' : '';
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.downPos = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.enabled || e.button !== 0) return;
    const dist = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    if (dist > 6) return; // Was an orbit drag, not a click

    if (this.itemMode) {
      const hit = this.pickItemAt(e.clientX, e.clientY);
      if (hit?.drugId) {
        this.bus.emit('pharmacy:drug', { drugId: hit.drugId });
        return;
      }
      if (hit?.pharmacyAction === 'dispense') {
        this.bus.emit('pharmacy:dispenseOpen', {});
        return;
      }
      if (hit?.cabinetId) {
        this.bus.emit('pharmacy:cabinet', { cabinetId: hit.cabinetId });
        return;
      }
      if (hit?.floorPoint) {
        this.bus.emit('walk:goto', {
          x: hit.floorPoint.x,
          y: hit.floorPoint.y,
          z: hit.floorPoint.z,
        });
        return;
      }
      this.bus.emit('item:select', {
        itemId: hit?.itemId ?? null,
        equipmentType: hit?.equipmentType ?? null,
      });
      return;
    }

    const roomId = this.pickRoomAt(e.clientX, e.clientY);
    this.setSelectedRoom(roomId);
    this.bus.emit('room:select', { roomId });
  };

  private onDoubleClick = (e: MouseEvent): void => {
    if (!this.enabled || this.itemMode) return;
    const roomId = this.pickRoomAt(e.clientX, e.clientY);
    if (roomId) {
      this.setSelectedRoom(roomId);
      this.bus.emit('room:select', { roomId });
      this.bus.emit('room:enter', { roomId });
    }
  };

  private setHoveredRoom(roomId: string | null, x: number, y: number): void {
    const changed = this.hoveredRoomId !== roomId;
    const prev = this.hoveredRoomId;
    this.hoveredRoomId = roomId;

    if (changed) {
      if (prev) this.refreshRoomHighlight(prev);
      if (roomId) this.refreshRoomHighlight(roomId);
    }

    this.bus.emit('room:hover', { roomId, x, y });
  }

  private refreshRoomHighlight(roomId: string): void {
    const group = this.getRoomGroup(roomId);
    if (!group) return;

    const isSelected = roomId === this.selectedRoomId;
    const isHovered = roomId === this.hoveredRoomId;
    const emissiveHex = isSelected ? 0x0f768a : isHovered ? 0x38bdf8 : 0x000000;
    const intensity = isSelected ? 0.25 : isHovered ? 0.16 : 0;

    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
        obj.material.emissive.setHex(emissiveHex);
        obj.material.emissiveIntensity = intensity;
      }
    });
  }

  dispose(): void {
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('dblclick', this.onDoubleClick);
  }
}
