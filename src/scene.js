import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Scene {
  constructor(container) {
    this.clock = new THREE.Clock();

    // No antialiasing = PS2 look
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth - 340, window.innerHeight);
    this.renderer.setPixelRatio(1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x012244);  // clearly ocean blue
    this.scene.fog = new THREE.Fog(0x012244, 320, 520);

    // Isometric-ish strategic camera
    this.camera = new THREE.PerspectiveCamera(
      48,
      (window.innerWidth - 340) / window.innerHeight,
      0.1, 1000
    );
    this.camera.position.set(0, 160, 115);
    this.camera.lookAt(0, 0, -10);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, -10);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minPolarAngle = Math.PI / 5;
    this.controls.minDistance = 55;
    this.controls.maxDistance = 380;
    // Pan on left drag, rotate on right drag
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Harsh directional light for flat PS2 shading
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
    sun.position.set(70, 130, 60);
    this.scene.add(sun);
    const ambient = new THREE.AmbientLight(0x1a2d44, 1.4);
    this.scene.add(ambient);
    // Subtle fill from opposite side
    const fill = new THREE.DirectionalLight(0x002244, 0.5);
    fill.position.set(-50, 40, -80);
    this.scene.add(fill);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Shared water time uniform
    this.waterUniforms = { time: { value: 0 } };

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth - 340;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.controls.update();
    this.waterUniforms.time.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
  }

  getMouseIntersects(event, objects) {
    this._setMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(objects, false);
  }

  getGroundPoint(event) {
    this._setMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const pt = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, pt);
    return pt;
  }

  _setMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
}
