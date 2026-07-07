import { useEffect, useRef, useState } from "react";
import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  Color,
  Group,
  Box3,
  Vector3,
  Mesh,
  MeshStandardMaterial,
  InstancedMesh,
  BoxGeometry,
  Object3D,
  AmbientLight,
  DirectionalLight,
  ShaderMaterial,
  SphereGeometry,
  BackSide,
} from "three";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { animate, createTimeline, createTimer, stagger, utils, cubicBezier } from "animejs";
import { getInstances } from "animejs/adapters/three";

// Faithful port of the "Anime.js 3D logo animation" demo (Julian Garnier),
// retargeted from the SVG "anime•js" wordmark to a font-generated "DropPulse".
// The scene, sky dome, floor crash/explode, camera choreography and slow-mo
// player are ported verbatim; only the glyph source and the per-glyph anime•js
// choreography (js-plug / three-d split) are replaced by a grouped letter POP.

const BG = "#252423";
const SLATE = "#334155";
const GREEN = "#059669";

const WORD = "DropPulse";
const DEPTH = 0.4;
const ITALIC_SKEW = 8;

export default function WelcomeIntro({ onDone }: { onDone: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const [ready, setReady] = useState(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    const disposables: { dispose: () => void }[] = [];

    const scene = new Scene();
    scene.background = new Color(BG);

    // --- Sky gradient dome (verbatim from the demo) ---
    const skyMaterial = new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color("#818198") },
        bottomColor: { value: new Color("#b6b6b9") },
        offset: { value: -38 },
        exponent: { value: 1.15 },
      },
      side: BackSide,
      fog: false,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    const sky = new Mesh(new SphereGeometry(600, 32, 15), skyMaterial);
    scene.add(sky);
    disposables.push(sky.geometry, skyMaterial);

    // --- Floor: instanced tile grid + solid skirts (verbatim technique) ---
    const FLOOR_COLS = 31;
    const FLOOR_ROWS = 31;
    const tileSize = 1;
    const floorGroup = new Group();
    const floorMat = new MeshStandardMaterial({
      color: new Color("#d4d4d8"),
      roughness: 0.7,
      metalness: 0.05,
    });
    const floor = new InstancedMesh(
      new BoxGeometry(tileSize, tileSize, tileSize),
      floorMat,
      FLOOR_COLS * FLOOR_ROWS,
    );
    const dummy = new Object3D();
    for (let r = 0; r < FLOOR_ROWS; r++) {
      for (let c = 0; c < FLOOR_COLS; c++) {
        dummy.position.set(c - (FLOOR_COLS - 1) / 2, 0, r - (FLOOR_ROWS - 1) / 2);
        dummy.updateMatrix();
        floor.setMatrixAt(r * FLOOR_COLS + c, dummy.matrix);
      }
    }
    floorGroup.add(floor);
    disposables.push(floor.geometry, floorMat);
    const tiles = getInstances(floor);

    const FLOOR_HALF_X = (FLOOR_COLS * tileSize) / 2;
    const FLOOR_HALF_Z = (FLOOR_ROWS * tileSize) / 2;
    const SKIRT_EXT = 5;
    const skirts: Mesh[] = [];
    const addSkirt = (width: number, depth: number, x: number, z: number) => {
      const g = new BoxGeometry(width, tileSize, depth);
      const skirt = new Mesh(g, floorMat);
      skirt.position.set(x, 0, z);
      floorGroup.add(skirt);
      skirts.push(skirt);
      disposables.push(g);
    };
    addSkirt(SKIRT_EXT, 2 * FLOOR_HALF_Z, FLOOR_HALF_X + SKIRT_EXT / 2, 0);
    addSkirt(SKIRT_EXT, 2 * FLOOR_HALF_Z, -FLOOR_HALF_X - SKIRT_EXT / 2, 0);
    addSkirt(2 * FLOOR_HALF_X + 2 * SKIRT_EXT, SKIRT_EXT, 0, FLOOR_HALF_Z + SKIRT_EXT / 2);
    addSkirt(2 * FLOOR_HALF_X + 2 * SKIRT_EXT, SKIRT_EXT, 0, -FLOOR_HALF_Z - SKIRT_EXT / 2);
    scene.add(floorGroup);

    // --- Accent cube (green "flash" mark, plays the demo's i-dot role) ---
    const cubeGeom = new BoxGeometry(tileSize, tileSize, tileSize);
    const cubeMat = new MeshStandardMaterial({
      color: new Color(GREEN),
      roughness: 0.4,
      metalness: 0.1,
    });
    const cube = new Mesh(cubeGeom, cubeMat);
    scene.add(cube);
    disposables.push(cubeGeom, cubeMat);
    utils.set(cube, { x: 0, y: 0, z: 0, transformOriginY: -0.5 });

    // --- Lights (verbatim) ---
    const ambient = new AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const keyLight = new DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(0, 30, 0);
    scene.add(keyLight);
    const rimLight = new DirectionalLight(0xaab8ff, 0.6);
    rimLight.position.set(-200, -50, 150);
    scene.add(rimLight);

    // --- Camera + rig ---
    const camera = new PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.01, 2000);
    const cameraRig = new Group();
    cameraRig.add(camera);
    scene.add(cameraRig);
    utils.set(camera, { x: 0, y: 5.64, z: 20.66, rotateX: -14.73, fov: 60, zoom: 1 });

    // --- Renderer ---
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.domElement.style.opacity = "0";
    mount.appendChild(renderer.domElement);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    addEventListener("resize", onResize);

    // --- fov-driven dolly hold (verbatim) ---
    const DEG2RAD = Math.PI / 180;
    const FLATTEN_BASE_FOV = 60;
    const FLATTEN_DIST_NUM = 20.66 * Math.tan(FLATTEN_BASE_FOV * 0.5 * DEG2RAD);
    const flattenDezoom = { value: 1 };
    const renderTimer = createTimer({
      onUpdate: () => {
        camera.position.z =
          (FLATTEN_DIST_NUM * flattenDezoom.value) / Math.tan(camera.fov * 0.5 * DEG2RAD);
        renderer.render(scene, camera);
      },
    });

    // --- Damped-shake helpers (verbatim) ---
    const shake =
      (
        amp: number,
        cycles: number,
        {
          decay = 1,
          sweep = 0,
          settle = 0,
          dir = 1,
          center = 0,
        }: { decay?: number; sweep?: number; settle?: number; dir?: number; center?: number } = {},
      ) =>
      (t: number) =>
        center +
        dir *
          (settle + (amp - settle) * (1 - t) ** decay) *
          Math.sin(cycles * (t + sweep * t * t) * 2 * Math.PI);
    const lateShake = (
      amp: number,
      cycles: number,
      start: number,
      opts: Record<string, number> = {},
    ) => {
      const inner = shake(amp, cycles, opts);
      return (t: number) => (t < start ? 0 : inner((t - start) / (1 - start)));
    };

    // --- Tile helpers (verbatim) ---
    const EXPLODE_RADIUS = 10;
    const tileRingDistance = (i: number) =>
      Math.hypot(
        (i % FLOOR_COLS) - Math.floor(FLOOR_COLS / 2),
        Math.floor(i / FLOOR_COLS) - Math.floor(FLOOR_ROWS / 2),
      );
    const getCenterTiles = (radius: number) =>
      tiles.filter((_t: unknown, i: number) => tileRingDistance(i) <= radius);
    const getOuterTiles = (radius: number) =>
      tiles.filter((_t: unknown, i: number) => tileRingDistance(i) > radius);
    const centerTile =
      tiles[Math.floor(FLOOR_ROWS / 2) * FLOOR_COLS + Math.floor(FLOOR_COLS / 2)];

    const explodeDurX = utils.createSeededRandom(4, 800, 1279);
    const explodeDurZ = utils.createSeededRandom(0, 800, 1279);
    const explodeDurY = utils.createSeededRandom(7, 800, 1279);
    const explodeRotX = utils.createSeededRandom(7, -1080, 1080);
    const explodeRotY = utils.createSeededRandom(13, -1080, 1080);
    const explodeRotZ = utils.createSeededRandom(21, -1080, 1080);
    const explodeScaleDur = utils.createSeededRandom(0, 500, 1200);
    const burstRotX = utils.createSeededRandom(10, -540, 540);
    const burstRotY = utils.createSeededRandom(7, -540, 540);
    const burstRotZ = utils.createSeededRandom(12, -540, 540);

    let cleanupWordmark: (() => void) | null = null;

    new FontLoader().load("/fonts/helvetiker_bold.typeface.json", (font: Font) => {
      if (disposed) return;

      // Build one extruded mesh per letter so we can POP/skew them in stagger.
      const logoGroup = new Group();
      const letters: Mesh[] = [];
      let cursorX = 0;
      const letterMat = new MeshStandardMaterial({
        color: new Color(SLATE),
        roughness: 0.4,
        metalness: 0.1,
      });
      for (const ch of WORD) {
        const g = new TextGeometry(ch, {
          font,
          size: 1.6,
          depth: DEPTH,
          curveSegments: 6,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.02,
          bevelSegments: 2,
        });
        g.computeBoundingBox();
        const bbox = g.boundingBox ?? new Box3();
        const size = bbox.getSize(new Vector3());
        const m = new Mesh(g, letterMat);
        m.position.x = cursorX - bbox.min.x;
        m.userData.halfHeight = size.y / 2;
        cursorX += (size.x || 0.6) + 0.18;
        letters.push(m);
        logoGroup.add(m);
        disposables.push(g);
      }
      disposables.push(letterMat);

      // Center the wordmark at the origin.
      const groupBox = new Box3().setFromObject(logoGroup);
      const groupCenter = groupBox.getCenter(new Vector3());
      logoGroup.position.set(-groupCenter.x, -groupCenter.y, 0);

      const wrapper = new Group();
      wrapper.add(logoGroup);
      wrapper.position.y = -5; // land the pop at the floor (verbatim intent)
      scene.add(wrapper);
      cleanupWordmark = () => {};

      // Initial letter poses: italic skew, hidden below.
      const bottomOrigin = (m: Mesh) => `0 ${-(m.userData.halfHeight as number)} 0`;
      letters.forEach((m) => utils.set(m, { skewX: -ITALIC_SKEW, transformOrigin: bottomOrigin(m) }));

      // ---- Master timeline (ported; per-anime•js-glyph steps replaced by grouped letter POP) ----
      const tl = createTimeline({ id: "FlashDrop 3D logo", autoplay: false })
        .add(renderer.domElement, { opacity: [0, 1], duration: 1300, ease: "inOut(2)" }, 0)
        .add(
          camera,
          {
            rotateX: [
              { to: 38, duration: 700, ease: "inOut(2)" },
              { to: 41, duration: 500, ease: "inOutSine" },
              { to: 40.5, duration: 200, ease: "inOutSine" },
              { to: 36, duration: 180, ease: "in(2)" },
              { to: 24, duration: 80, ease: "in(2)" },
              { to: -10, duration: 40, ease: "in(1.5)" },
              { to: -16.5, duration: 90, delay: 20, ease: "out(2)" },
              { to: -14.73, duration: 190, ease: "inOutSine" },
            ],
            y: [
              { to: 6.3, duration: 900, ease: "inOut(2)" },
              { to: 6.4, duration: 500, ease: "inOutSine" },
              { to: 6.15, duration: 180, ease: "in(2)" },
              { to: 5.04, duration: 120, ease: "in(2)" },
            ],
          },
          300,
        )
        .add(
          cube,
          {
            y: [
              { from: 24, to: 1, duration: 300, delay: 1700, ease: "in(5.0825)" },
              { from: 0, to: 0.138, duration: 60, ease: cubicBezier(0, 1.1575, 0.5712, 0.9605) },
              { to: -0.75, duration: 1040, ease: cubicBezier(0, 1.1575, 0.5712, 0.9605) },
              { from: -1.75, to: -2.5, duration: 146, ease: "out(9.8523)" },
            ],
            scaleX: [
              { from: 0, to: 1, duration: 2000 },
              { from: 1.3, to: 1, duration: 100, ease: "out(2)" },
            ],
            scaleY: [
              { from: 5, to: 2, duration: 2000 },
              { to: 1.25, duration: 200, ease: cubicBezier(0.1, 0.7, 0.5763, 0.7728) },
              { to: 1, duration: 900, ease: cubicBezier(0.1, 0.7, 0.5763, 0.7728) },
            ],
            scaleZ: [
              { from: 0, to: 1, duration: 2000 },
              { from: 1.3, to: 1, duration: 100, ease: "out(2)" },
            ],
            ease: "in(2.4146)",
            skewX: { from: 0, to: 1, duration: 1143, delay: 2000, ease: "linear", modifier: shake(8, 18, { decay: 2 }) },
            skewZ: { from: 0, to: 1, duration: 1143, delay: 2000, ease: "linear", modifier: shake(8, 18, { decay: 2 }) },
          },
          0,
        )
        .set(centerTile!, { scale: 0 }, 2000)
        .add(
          tiles,
          {
            y: [
              { from: 0, to: stagger([0.15, 0], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), duration: 50, delay: stagger([0, 451], { from: "center", ease: "in(2.5507)", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: cubicBezier(0.5621, 0.9568, 0.5, 1) },
              { to: stagger([-1.5, 0], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 0.102, seed: 0 }), duration: 1050, ease: cubicBezier(0, 0.8, 0, 1.0128) },
              { to: stagger([-3, 0], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 0.3, seed: 0 }), duration: 656, ease: cubicBezier(0, 1.0807, 0.3512, 1.2537) },
            ],
            rotateX: { to: stagger([0, 0], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 20, seed: 6 }), duration: 1200 },
            rotateY: { to: stagger([0, 0], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 20, seed: 12 }), duration: 1260 },
            rotateZ: { to: stagger([0, 0], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 20, seed: 3 }), duration: 1200, delay: 50 },
          },
          2000,
        )
        .add(
          camera,
          {
            y: { from: 0, to: 1, duration: 1412, ease: "linear", modifier: (t: number) => shake(0.12, 15, { decay: 2, center: 5.64 })(t) + lateShake(0.97, 2, 0.78, { decay: 1.6 })(t) },
            rotateZ: { from: 0, to: 1, duration: 1437, ease: "linear", modifier: (t: number) => shake(0.42, 10, { decay: 1.8 })(t) + lateShake(0.42, 2, 0.79, { decay: 1.4 })(t) },
            ease: "inOutSine",
          },
          2000,
        )
        .label("POP", 8000)
        .label("slowmo start", "POP-=0")
        .label("slowmo end", "POP+=500")
        .add(camera, { zoom: { to: 2, duration: 5500, ease: cubicBezier(0.6985, 0.1061, 0.5527, 0.7364) } }, 2500)
        .add(
          cameraRig,
          {
            rotateY: [
              { from: -270, to: -180, duration: 3600 },
              { to: 0, duration: 700, delay: 1000, ease: cubicBezier(0.375, -0.0148, 0, 1.0101) },
            ],
            rotateX: { to: 0, duration: 1900, delay: 2700 },
            y: [
              { to: 0, duration: 1900, delay: 2700 },
              { to: 0, duration: 300, ease: "out(2)" },
            ],
            ease: "inOut(2)",
          },
          3400,
        )
        .add(
          getCenterTiles(EXPLODE_RADIUS),
          {
            x: { to: stagger([1, 40], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], axis: "x", jitter: 5, seed: 0 }), duration: () => explodeDurX(), delay: stagger([0, 137], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: "out(5.3605)" },
            z: { to: stagger([1, 40], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], axis: "z" }), duration: () => explodeDurZ(), delay: stagger([0, 137], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 5, seed: 0 }), ease: "out(5.3605)" },
            y: { to: stagger([40, 1], { from: "center", ease: cubicBezier(0.3326, 0.0289, 0.9886, 0.4057), grid: [FLOOR_COLS, FLOOR_ROWS], jitter: 5, seed: 0 }), duration: () => explodeDurY(), delay: stagger([0, 137], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: "out(5.3605)" },
            rotateX: { to: () => explodeRotX(), duration: 815, delay: stagger([0, 314], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: "out(2)" },
            rotateY: { to: () => explodeRotY(), duration: 815, delay: stagger([0, 314], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: "out(2)" },
            rotateZ: { to: () => explodeRotZ(), duration: 815, delay: stagger([0, 314], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: "out(2)" },
            scale: { to: 0, duration: () => explodeScaleDur(), delay: stagger([0, 314], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS] }), ease: "out(2.8731)" },
            duration: 113,
            delay: stagger([0, 210], { from: "center", grid: [FLOOR_COLS, FLOOR_ROWS], seed: 0 }),
            ease: "linear",
          },
          "POP-=15",
        )
        .add(
          [...getOuterTiles(EXPLODE_RADIUS), ...skirts],
          { y: { to: -50, duration: 604, delay: 146, ease: cubicBezier(0.8109, 0.0308, 0.9152, 0.5479) } },
          "POP-=150",
        )
        // Grouped letter POP (replaces per-glyph anime•js pop)
        .add(
          letters,
          {
            y: [
              { from: -0.39, to: 3.23, duration: 240, ease: cubicBezier(0.225, 1, 0.915, 0.98) },
              { to: 1.9, duration: 120, delay: 20, ease: "inQuad" },
              { to: 1.9, duration: 120, ease: "outQuad" },
            ],
            scaleY: [
              { to: [0.4, 1.5], duration: 120, ease: "outSine" },
              { to: 0.6, duration: 120, delay: 180, ease: "inOutSine" },
              { to: 1.2, duration: 180, delay: 25, ease: "outQuad" },
              { to: 1, duration: 190, delay: 15, ease: "outQuad" },
            ],
            duration: 400,
            ease: "outSine",
            delay: stagger(60, { from: "center" }),
          },
          "POP",
        )
        .add(wrapper, { scale: { from: 1.25, to: 1, duration: 600 }, y: { from: -5.28, to: 0, duration: 600 }, duration: 900, ease: "outExpo" }, "POP")
        .add(camera, { y: { to: 7, duration: 1100, ease: "out(4.9225)" }, rotateX: [{ to: 9.1, duration: 260, ease: "out(3.2713)" }, { to: 0, duration: 700, ease: "out(3)", delay: 140 }], zoom: { to: 1, duration: 400, ease: "out(3)" } }, "POP")
        // Remove the counter-skew so letters slant into italic (grouped SWEECH)
        .add(letters, { skewX: 0, duration: 1350, ease: "outElastic(1.1, .9)" }, "POP+=1050")
        .add(camera, { fov: { to: 2, duration: 700, ease: "out(2)" } }, "POP+=1450")
        .add(flattenDezoom, { value: { to: 1.5, duration: 1125 }, duration: 1150, ease: "out(2)" }, "POP+=1050")
        .add(skyMaterial, { topColor: BG, bottomColor: BG, duration: 465, ease: "inOut(4.348)" }, "POP+=1500")
        .add(ambient, { intensity: [{ to: 3, duration: 300 }, { to: 1, duration: 700, delay: 1050 }], duration: 240, ease: "inOut(1.8042)" }, "POP+=1650")
        .add(camera, { fov: 35, duration: 1500, ease: "out(2)" }, 11000)
        .add(
          [...letters, cube],
          {
            z: 62.1,
            y: 0.5,
            rotateX: () => burstRotX(),
            rotateY: () => burstRotY(),
            rotateZ: () => burstRotZ(),
            delay: stagger(100, { from: "last", ease: "in(2.3145)" }),
            duration: 1140,
            ease: "in(2)",
          },
          10960,
        )
        .init();

      // Slow-mo scrub player (verbatim), looping.
      animate(tl, {
        id: "Player",
        currentTime: [
          { to: () => tl.labels["slowmo start"], duration: () => tl.labels["slowmo start"], ease: cubicBezier(1, 0.7, 1, 0.85) },
          { to: () => tl.labels["slowmo end"], duration: 2000, ease: cubicBezier(0.0314, 0.3616, 0.8994, -0.2122) },
          { to: () => tl.duration, duration: () => tl.duration - tl.labels["slowmo end"] },
        ],
        duration: tl.duration,
        loop: true,
        ease: "linear",
      });

      setReady(true);
    });

    return () => {
      disposed = true;
      renderTimer.pause();
      removeEventListener("resize", onResize);
      cleanupWordmark?.();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#252423]">
      <div ref={mountRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={finish}
        className="absolute bottom-8 right-8 z-10 rounded-md border-2 border-white/70 bg-black/30 px-5 py-2.5 font-heading text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-black/50"
      >
        {ready ? "Passer" : "Chargement…"}
      </button>
    </div>
  );
}
