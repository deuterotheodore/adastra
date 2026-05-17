// galaxymap.js — Galaxy map module for adastra.html
// Renders the galaxy combined-viewer scene into a caller-supplied canvas element.
import { starData, milkywayData, tcToSpectralClass } from './physics.js';
import { GalaxyDots } from './data.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const SOL_X = 0.0, SOL_Y = -162.0, SOL_Z = 0.47;
const FADE_NEAR = 20.0, FADE_MID = 80.0, FADE_FAR = 160;
const GAL_SCALE = 1.4, GAL_OPAC = 0.3;
const GEO_SCALE = 0.9, GEO_OPAC = 0.04;
const ROTATE_SPEED = 0.001, PAN_SPEED = 0.001;
const FOV_MIN = 5, FOV_MAX = 120;
const WASD_ACCEL = 0.0005, WASD_DAMP = 0.92, WASD_MAX = 0.1;
const ARROW_ACCEL = 0.0008, ARROW_DAMP = WASD_DAMP, ARROW_MAX = 0.04;
const CLOSEUP_DIST = 10 * 0.0059;
const LY_TO_PX = 0.0059;
const KLY = 1 / 5.9;
const PLANE_R = 354, RING_STEP = 59, N_SEGS = 36;
const RETICLE_R = 12, RETICLE_GAP = 4, RETICLE_TICK = 8;
const PICK_PX_TOL = 4;
const ORBIT_ALIGN_SPEED = 0.12;
const DEG = Math.PI / 180;

// ── Module state ──────────────────────────────────────────────────────────────
let _renderer = null, _scene = null, _camera = null;
let _hudScene = null, _hudCamera = null;
let _canvas = null, _container = null;
let _w = 0, _h = 0;
let _animId = null;
let _active = false;
let _sceneBuilt = false;
let _dataLoaded = false;

// Scene objects
let galCloud = null, geoCloud = null, starCloud = null;
let _shipSphere = null, _shipWire = null, _shipRings = null;
let _reticle = null, _starReticle = null;
let _lineHyp = null, _lineZ = null, _lineXY = null;
let _planeGroup = null, _gcGroup = null;
let _planeMat = null, _planeWireMat = null, _ringMat = null;
const _allMats = [];

// Ship / selection state
const SOL_POS = new THREE.Vector3(SOL_X, SOL_Y, SOL_Z);
let shipPos = SOL_POS.clone();
let _selectedStarPos = null, _selectedStarMeta = null;
let _gcFadeLast = -1;
let starsDotScale = 1.0;

// Controls state
let _mouseDown = false;
let _lastX = 0, _lastY = 0, _mouseDownX = 0, _mouseDownY = 0;
const _vel = new THREE.Vector3();
const _angVel = new THREE.Vector3();
const _keysHeld = {
    w: false, a: false, s: false, d: false,
    arrowleft: false, arrowright: false, arrowup: false, arrowdown: false
};
const _ARROW_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown']);

// Auto-move state
let _autoMoving = false, _autoT = 0;
const _autoStartPos = new THREE.Vector3(), _autoTargetPos = new THREE.Vector3();
const _autoStartQuat = new THREE.Quaternion(), _autoTargetQuat = new THREE.Quaternion();

// DOM elements
let _starAnnotation = null, _infoEl = null, _controlsEl = null;

let _onStarSelected = null;
export function setOnStarSelected(cb) { _onStarSelected = cb; }

// Shared HUD line material (safe to create at module level; THREE is a script-loaded global)
const _hudLineMat = new THREE.LineBasicMaterial({
    color: 0xffaa66, depthTest: false, transparent: true, opacity: 0.7
});
const _raycaster = new THREE.Raycaster();
const _pickMouse = new THREE.Vector2();

// ── Equatorial → Galactic rotation matrix (computed once at module load) ──────
let M0, M1, M2;
{
    const ngpRa = 192.860*DEG, ngpDec = 27.128*DEG;
    const gcRa  = 266.405*DEG, gcDec  = -28.936*DEG;
    M0 = [Math.cos(gcDec)*Math.cos(gcRa),  Math.cos(gcDec)*Math.sin(gcRa),  Math.sin(gcDec)];
    M2 = [Math.cos(ngpDec)*Math.cos(ngpRa), Math.cos(ngpDec)*Math.sin(ngpRa), Math.sin(ngpDec)];
    const r = [M2[1]*M0[2]-M2[2]*M0[1], M2[2]*M0[0]-M2[0]*M0[2], M2[0]*M0[1]-M2[1]*M0[0]];
    const len = Math.sqrt(r.reduce((s,v) => s+v*v, 0));
    M1 = r.map(v => v/len);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function smoothstep(near, far, x) {
    const t = Math.max(0, Math.min(1, (x-near)/(far-near)));
    return t*t*(3-2*t);
}
function scaledDist(pos) {
    const dx = _camera.position.x - pos.x;
    const dy = _camera.position.y - pos.y;
    const dz = (_camera.position.z - pos.z) * 3;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}
function gaussianRandom(mean, stdev) {
    const u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v) * stdev + mean;
}
function eqToGal(raDeg, decDeg) {
    const ra = raDeg*DEG, dec = decDeg*DEG;
    const ex = Math.cos(dec)*Math.cos(ra), ey = Math.cos(dec)*Math.sin(ra), ez = Math.sin(dec);
    const gx = M0[0]*ex+M0[1]*ey+M0[2]*ez;
    const gy = M1[0]*ex+M1[1]*ey+M1[2]*ez;
    const gz = M2[0]*ex+M2[1]*ey+M2[2]*ez;
    return [Math.atan2(gy, gx), Math.asin(Math.max(-1, Math.min(1, gz)))];
}

// Blackbody colour / visible-fraction tables (matches physics.js values)
const _TLOG = [0, 0.833, 1.361, 1.668, 1.792, 1.988, 2.303, 3.497, 4.605];
const _TCOL = [
    {r:.251,g:.000,b:.000}, {r:1,g:.404,b:.129}, {r:1,g:.784,b:.529},
    {r:.973,g:1,b:.914},    {r:.894,g:.996,b:1},  {r:.706,g:.878,b:1},
    {r:.529,g:.753,b:1},    {r:.337,g:.592,b:1},  {r:.298,g:.545,b:.973}
];
const _VFRAC = [6e-6, 0.03, 0.24, 0.39, 0.42, 0.43, 0.35, 0.035, 0.0017];

function _tempRGB(kK) {
    const t = Math.max(1, Math.min(100, kK)), logT = Math.log(t);
    for (let i = 0; i < _TLOG.length-1; i++) {
        if (logT < _TLOG[i+1]) {
            const f = (logT-_TLOG[i]) / (_TLOG[i+1]-_TLOG[i]);
            return { r: _TCOL[i].r + f*(_TCOL[i+1].r-_TCOL[i].r),
                     g: _TCOL[i].g + f*(_TCOL[i+1].g-_TCOL[i].g),
                     b: _TCOL[i].b + f*(_TCOL[i+1].b-_TCOL[i].b) };
        }
    }
    return _TCOL[_TCOL.length-1];
}
function _visFrac(kK) {
    const t = Math.max(1, Math.min(100, kK)), logT = Math.log(t);
    for (let i = 0; i < _TLOG.length-1; i++) {
        if (logT < _TLOG[i+1]) {
            const f = (logT-_TLOG[i]) / (_TLOG[i+1]-_TLOG[i]);
            return _VFRAC[i] + f*(_VFRAC[i+1]-_VFRAC[i]);
        }
    }
    return _VFRAC[_VFRAC.length-1];
}
function colorFromIR(ir, opt) {
    const fIR = _visFrac(1.2);
    const cO = _tempRGB(5.8), cI = _tempRGB(1.2);
    const irC = ir * fIR * 150, totV = opt + irC;
    const A = Math.min(0.1*(opt+ir), 1.0);
    const dark = Math.min(Math.exp(1 - 0.5*ir/opt), 1.0);
    return [(cO.r + cI.r*irC)/totV*dark, (cO.g + cI.g*irC)/totV*dark, (cO.b + cI.b*irC)/totV*dark, A];
}

// ── Shaders ───────────────────────────────────────────────────────────────────
const FRAG = `
  varying vec3 vColor; varying float vOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5; float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vColor, smoothstep(1.0, 0.7, d) * vOpacity);
  }`;

const VERT_DOT = `
  uniform float viewportH, dotScale, opacScale, camFade;
  attribute float pSize; attribute vec3 pColor; attribute float pOpacity;
  varying vec3 vColor; varying float vOpacity;
  void main() {
    vColor = pColor; vOpacity = pOpacity * opacScale * camFade;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = pSize * dotScale * 2.0 * projectionMatrix[1][1] * (viewportH * 0.5) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const VERT_STAR = `
  uniform float viewportH, dotScale, opacScale, camFade, camDistScale;
  attribute float pSize; attribute vec3 pColor; attribute float pOpacity;
  varying vec3 vColor; varying float vOpacity;
  void main() {
    vColor = pColor; vOpacity = pOpacity * opacScale;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = pSize * dotScale * camDistScale * 2.0 * projectionMatrix[1][1] * (viewportH * 0.5) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

// ── Material / geometry builders ──────────────────────────────────────────────
function _baseUni(dotScale, opacScale, camFade = 1.0) {
    return {
        viewportH:    { value: _h * devicePixelRatio },
        dotScale:     { value: dotScale },
        opacScale:    { value: opacScale },
        camFade:      { value: camFade },
        camDistScale: { value: 1.0 },
    };
}
function _makeMat(vert, dotScale, opacScale, camFade = 1.0) {
    const m = new THREE.ShaderMaterial({
        vertexShader: vert, fragmentShader: FRAG,
        uniforms: _baseUni(dotScale, opacScale, camFade),
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    _allMats.push(m);
    return m;
}
function _buildCloud(dots, vert, dotScale, opacScale, camFade = 1.0) {
    const N = dots.length;
    const pos = new Float32Array(N*3), col = new Float32Array(N*3),
          siz = new Float32Array(N),   opa = new Float32Array(N);
    dots.forEach((d, i) => {
        pos[i*3]   = (d.x||0) - 400;
        pos[i*3+1] = -((d.y||0) - 400);
        pos[i*3+2] = (d.z||0);
        col[i*3] = d.R||1; col[i*3+1] = d.G||1; col[i*3+2] = d.B||1;
        siz[i] = d.r||4; opa[i] = d.A||0;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('pColor',   new THREE.BufferAttribute(col, 3));
    geo.setAttribute('pSize',    new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('pOpacity', new THREE.BufferAttribute(opa, 1));
    return new THREE.Points(geo, _makeMat(vert, dotScale, opacScale, camFade));
}
function _buildStars() {
    const N = starData.length;
    const pos = new Float32Array(N*3), col = new Float32Array(N*3),
          siz = new Float32Array(N),   opa = new Float32Array(N);
    let i = 0;
    for (const s of starData) {
        const t = Math.max(0, Math.min(1, (12 - s.M) / 17));
        const [l, b] = eqToGal(s.ra, s.dec);
        const dpx = s.dist0 * LY_TO_PX;
        pos[i*3]   = (400 + (-Math.sin(l))*Math.cos(b)*dpx) - 400;
        pos[i*3+1] = -((400 - SOL_Y + (-Math.cos(l))*Math.cos(b)*dpx) - 400);
        pos[i*3+2] = SOL_Z + Math.sin(b)*dpx;
        const rgb = (s.temp && isFinite(s.temp) && s.temp > 0)
                    ? _tempRGB(s.temp) : { r: 0.9, g: 0.9, b: 1 };
        col[i*3] = rgb.r; col[i*3+1] = rgb.g; col[i*3+2] = rgb.b;
        siz[i] = 0.002 + t*0.018; opa[i] = 1.0; i++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('pColor',   new THREE.BufferAttribute(col, 3));
    geo.setAttribute('pSize',    new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('pOpacity', new THREE.BufferAttribute(opa, 1));
    return new THREE.Points(geo, _makeMat(VERT_STAR, 1.0, 0.8));
}

// ── HUD scene helpers ─────────────────────────────────────────────────────────
const _fwdVec = new THREE.Vector3();
function _worldToHUD(v, margin) {
    _fwdVec.set(0, 0, -1).applyQuaternion(_camera.quaternion);
    const tp = v.clone().sub(_camera.position), len = tp.length();
    const cosA = len > 1e-9 ? tp.dot(_fwdVec)/len : 1;
    const n = v.clone().project(_camera);
    const x = n.x * _w/2, y = n.y * _h/2;
    const drawable = n.z <= 1.0 && cosA >= 0.5;
    return { x, y, ok: drawable && Math.abs(x) <= _w/2-margin && Math.abs(y) <= _h/2-margin, drawable };
}
function _setHudLine(line, p0, p1) {
    const a = line.geometry.attributes.position.array;
    a[0]=p0.x; a[1]=p0.y; a[2]=0; a[3]=p1.x; a[4]=p1.y; a[5]=0;
    line.geometry.attributes.position.needsUpdate = true;
}
function _makeHudLine() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, _hudLineMat);
    line.visible = false; _hudScene.add(line); return line;
}

// ── Star annotation ───────────────────────────────────────────────────────────
function _updateAnnotation() {
    const meta = _selectedStarMeta, pos = _selectedStarPos;
    if (!meta || !pos) { _starAnnotation.style.display = 'none'; return; }
    const hx = pos.x-SOL_POS.x, hy = pos.y-SOL_POS.y, hz = pos.z-SOL_POS.z;
    const r_hc = Math.sqrt(hx*hx + hy*hy + hz*hz);
    const lon = (Math.atan2(-hx, hy)*180/Math.PI + 360) % 360;
    const lat = Math.asin(hz/r_hc) * 180/Math.PI;
    const dx = pos.x-shipPos.x, dy = pos.y-shipPos.y, dz = pos.z-shipPos.z;
    const dKly = Math.sqrt(dx*dx+dy*dy+dz*dz) * KLY;
    const dstr = dKly < 1 ? (dKly*1000).toFixed(1)+' ly' : dKly.toFixed(2)+' kly';
    const idstr = meta.hip < 1e6 ? 'HIP '+meta.hip : ''+meta.hip;
    const lcs = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
    const lc = (meta.lc >= 1 && meta.lc <= 6) ? lcs[meta.lc] : '';
    const tcStr = meta.tc ? tcToSpectralClass(meta.tc)+' '+lc : '';
    _starAnnotation.textContent =
        `${idstr}\ndist ${dstr}\nmag ${meta.M.toFixed(2)}\n` +
        (meta.temp > 0 ? `temp ${meta.temp.toFixed(2)} kK\n` : '') +
        (meta.tc ? `class ${tcStr}\n` : '') +
        (meta.cl ? `${meta.cl}${meta.fe ? ' (Fe '+meta.fe+')' : ''}\n` : '') +
        `pos ${lon.toFixed(1)}° / ${lat.toFixed(1)}° / ${(r_hc*KLY).toFixed(3)} kly`;
    _starAnnotation.style.display = 'block';
}

// ── Static scene builders ─────────────────────────────────────────────────────
function _buildReticle() {
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc, depthTest: false });
    _reticle = new THREE.Group();
    const cPts = [];
    for (let i = 0; i <= 32; i++) {
        const a = i/32*Math.PI*2;
        cPts.push(new THREE.Vector3(Math.cos(a)*RETICLE_R, Math.sin(a)*RETICLE_R, 0));
    }
    _reticle.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cPts), mat));
    for (const [x0,y0,x1,y1] of [
        [RETICLE_GAP,0,RETICLE_GAP+RETICLE_TICK,0],
        [-RETICLE_GAP,0,-RETICLE_GAP-RETICLE_TICK,0],
        [0,RETICLE_GAP,0,RETICLE_GAP+RETICLE_TICK],
        [0,-RETICLE_GAP,0,-RETICLE_GAP-RETICLE_TICK],
    ]) _reticle.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
            [new THREE.Vector3(x0,y0,0), new THREE.Vector3(x1,y1,0)]), mat));
    _hudScene.add(_reticle);
}
function _buildStarReticle() {
    const R=18, GAP=5, TICK=10;
    const mat = new THREE.LineBasicMaterial({ color: 0xffcc00, depthTest: false });
    _starReticle = new THREE.Group(); _starReticle.visible = false;
    const cPts = [];
    for (let i = 0; i <= 32; i++) {
        const a = i/32*Math.PI*2;
        cPts.push(new THREE.Vector3(Math.cos(a)*R, Math.sin(a)*R, 0));
    }
    _starReticle.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cPts), mat));
    for (const [x0,y0,x1,y1] of [
        [GAP,0,GAP+TICK,0], [-GAP,0,-GAP-TICK,0],
        [0,GAP,0,GAP+TICK], [0,-GAP,0,-GAP-TICK],
    ]) _starReticle.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(
            [new THREE.Vector3(x0,y0,0), new THREE.Vector3(x1,y1,0)]), mat));
    _hudScene.add(_starReticle);
}

function _buildGalPlane() {
    _planeGroup = new THREE.Group(); _scene.add(_planeGroup);
    const pGeo = new THREE.CircleGeometry(PLANE_R, N_SEGS);
    _planeMat = new THREE.MeshBasicMaterial({
        color: 0xbb4488, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false });
    _planeWireMat = new THREE.MeshBasicMaterial({
        color: 0xdd66aa, transparent: true, opacity: 0.35, wireframe: true, depthWrite: false });
    _planeGroup.add(new THREE.Mesh(pGeo, _planeMat));
    _planeGroup.add(new THREE.Mesh(pGeo, _planeWireMat));

    _ringMat = new THREE.LineBasicMaterial({ color: 0xcc4499, transparent: true, opacity: 0.45, depthWrite: false });
    const sRingMat = new THREE.LineBasicMaterial({ color: 0xffff77, transparent: true, opacity: 0.5, depthWrite: false });
    _shipRings = new THREE.Group();
    _shipRings.scale.set(0.0002, 0.0002, 1);
    _shipRings.position.copy(SOL_POS);
    _planeGroup.add(_shipRings);

    const uPts = [];
    for (let j = 0; j <= N_SEGS; j++) {
        const a = j/N_SEGS*Math.PI*2;
        uPts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const uGeo = new THREE.BufferGeometry().setFromPoints(uPts);
    for (let i = 1; i <= 5; i++) {
        const pl = new THREE.Line(uGeo, _ringMat); pl.scale.setScalar(i*RING_STEP); _planeGroup.add(pl);
        if (i <= 4) { const sl = new THREE.Line(uGeo, sRingMat); sl.scale.setScalar(i*RING_STEP); _shipRings.add(sl); }
    }
    const sGeo = new THREE.SphereGeometry(PLANE_R/6000, 32, 16);
    _shipSphere = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({
        color: 0xdddd66, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    _shipWire = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({
        color: 0xeeee66, transparent: true, opacity: 0.1, wireframe: true, depthWrite: false }));
    _shipSphere.position.copy(SOL_POS); _shipWire.position.copy(SOL_POS);
    _shipWire.scale.set(1/6000, 1/6000, 1);
    _planeGroup.add(_shipSphere); _planeGroup.add(_shipWire);
}

function _buildGCGroup() {
    _gcGroup = new THREE.Group(); _scene.add(_gcGroup);
    function gcSphere(color, opacity, radius, scaleZ = 1) {
        const geo = new THREE.SphereGeometry(radius, 16, 8);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.NormalBlending });
        const mesh = new THREE.Mesh(geo, mat);
        if (scaleZ !== 1) mesh.scale.set(1, 1, scaleZ);
        mesh.userData.baseOpacity = opacity; _gcGroup.add(mesh); return mesh;
    }
    gcSphere(0xffffff, 0.05, 2.9, 0.3);   // Nuclear Stellar Disk
    gcSphere(0xffffff, 0.10, 0.1);          // Nuclear Star Cluster
    gcSphere(0xffffff, 0.90, 0.01);         // S-star cusp
    {
        const KPC = 3.26156*5.9;
        const BL = 0.70*KPC, BM = 0.44*KPC, BS = 0.18*KPC;
        const N = 5, OP = 0.3, SOFT = 1.5;
        const BV = `varying vec3 vN,vVP; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vVP=mv.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*mv;}`;
        const BF = `uniform vec3 uC; uniform float uO,uS; varying vec3 vN,vVP; void main(){float f=abs(dot(normalize(vN),normalize(-vVP)));gl_FragColor=vec4(uC,uO*pow(f,uS));}`;
        const barGroup = new THREE.Group(); barGroup.rotation.z = Math.PI/4; _gcGroup.add(barGroup);
        const bGeo = new THREE.SphereGeometry(1, 32, 16);
        for (let i = 0; i < N; i++) {
            const m = 0.5 + i*((4.5-0.5)/(N-1)), t = i/(N-1), op = OP*(1-t*0.8);
            const mat = new THREE.ShaderMaterial({
                vertexShader: BV, fragmentShader: BF,
                uniforms: { uC: { value: new THREE.Color(0xffd890) }, uO: { value: op }, uS: { value: SOFT } },
                transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.FrontSide,
            });
            const mesh = new THREE.Mesh(bGeo, mat);
            mesh.scale.set(BL*m, BM*m, BS*m); mesh.userData.baseOpacity = op; barGroup.add(mesh);
        }
    }
}

// ── Auto-move ─────────────────────────────────────────────────────────────────
function _startAutoMove() {
    if (!_selectedStarPos) return;
    const dir = _selectedStarPos.clone().sub(_camera.position).normalize();
    _autoStartPos.copy(_camera.position);
    _autoTargetPos.copy(_selectedStarPos).addScaledVector(dir, -CLOSEUP_DIST);
    _autoStartQuat.copy(_camera.quaternion);
    let camUp = new THREE.Vector3(0,1,0).applyQuaternion(_camera.quaternion);
    let right = new THREE.Vector3().crossVectors(dir, camUp);
    if (right.lengthSq() < 1e-6) { camUp.set(0,0,1); right.crossVectors(dir, camUp); }
    right.normalize();
    const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
    _autoTargetQuat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up2, dir.clone().negate()));
    _autoT = 0; _autoMoving = true;
    _starAnnotation.classList.add('flying');
    shipPos.copy(_selectedStarPos);
    _shipSphere.position.copy(_selectedStarPos);
    _shipWire.position.copy(_selectedStarPos);
    _shipRings.position.copy(_selectedStarPos);
}
function _applyAutoMove() {
    _autoT = Math.min(1, _autoT + 1/60);
    const e = (1 - Math.cos(Math.PI*_autoT)) / 2;
    _camera.position.lerpVectors(_autoStartPos, _autoTargetPos, e);
    _camera.quaternion.slerpQuaternions(_autoStartQuat, _autoTargetQuat, e);
    if (_autoT >= 1) { _autoMoving = false; _starAnnotation.classList.remove('flying'); }
}

// ── WASD + arrow inertia ──────────────────────────────────────────────────────
function _applyWASD() {
    const db = 1 + 5*smoothstep(6, 18, Math.min(scaledDist(shipPos), scaledDist(SOL_POS)));
    const fwd   = new THREE.Vector3(0,0,-1).applyQuaternion(_camera.quaternion);
    const right = new THREE.Vector3(1,0, 0).applyQuaternion(_camera.quaternion);
    const imp = new THREE.Vector3();
    if (_keysHeld.w) imp.addScaledVector(fwd,    WASD_ACCEL*db);
    if (_keysHeld.s) imp.addScaledVector(fwd,   -WASD_ACCEL*db);
    if (_keysHeld.a) imp.addScaledVector(right, -WASD_ACCEL*db);
    if (_keysHeld.d) imp.addScaledVector(right,  WASD_ACCEL*db);
    if (imp.lengthSq() > 0) { _vel.add(imp); if (_vel.length() > WASD_MAX*db) _vel.setLength(WASD_MAX*db); }
    _vel.multiplyScalar(WASD_DAMP);
    if (_vel.lengthSq() > 1e-8) _camera.position.add(_vel);

    if (_keysHeld.arrowleft)  _angVel.z = Math.min(_angVel.z - ARROW_ACCEL, ARROW_MAX);
    if (_keysHeld.arrowright) _angVel.z = Math.max(_angVel.z + ARROW_ACCEL, -ARROW_MAX);
    if (_keysHeld.arrowup)    _angVel.x = Math.min(_angVel.x - ARROW_ACCEL, ARROW_MAX);
    if (_keysHeld.arrowdown)  _angVel.x = Math.max(_angVel.x + ARROW_ACCEL, -ARROW_MAX);
    if (Math.abs(_angVel.z) > 1e-8) {
        const ax = new THREE.Vector3(0,0,-1).applyQuaternion(_camera.quaternion);
        _camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, _angVel.z)).normalize();
    }
    if (Math.abs(_angVel.x) > 1e-8) {
        const ax = new THREE.Vector3(1,0,0).applyQuaternion(_camera.quaternion);
        _camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, -_angVel.x)).normalize();
    }
    _angVel.multiplyScalar(ARROW_DAMP);
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function _setupEvents() {
    window.addEventListener('keydown', e => {
        if (!_active) return;
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') return;
        const k = e.key.toLowerCase();
        if (k in _keysHeld) { if (_ARROW_KEYS.has(k)) e.preventDefault(); _keysHeld[k] = true; }
    });
    window.addEventListener('keyup', e => {
        if (!_active) return;
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'text') return;
        const k = e.key.toLowerCase();
        if (k in _keysHeld) _keysHeld[k] = false;
    });

    _canvas.addEventListener('mousedown', e => {
        if (!_active) return;
        _mouseDown = true; _lastX = e.clientX; _lastY = e.clientY;
        _mouseDownX = e.clientX; _mouseDownY = e.clientY;
        _canvas.style.cursor = e.shiftKey ? 'move' : 'grabbing';
    });
    window.addEventListener('mouseup', () => { _mouseDown = false; if (_canvas) _canvas.style.cursor = 'grab'; });
    window.addEventListener('mousemove', e => {
        if (!_active || !_mouseDown) return;
        const dx = e.clientX - _lastX, dy = e.clientY - _lastY;
        _lastX = e.clientX; _lastY = e.clientY;
        if (e.shiftKey) {
            const db = 1 + 5*smoothstep(6, 18, Math.min(scaledDist(shipPos), scaledDist(SOL_POS)));
            _camera.position.addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(_camera.quaternion), -dx*PAN_SPEED*db);
            _camera.position.addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(_camera.quaternion),  dy*PAN_SPEED*db);
        } else if (e.ctrlKey) {
            const centre = (_selectedStarPos ? _selectedStarPos : shipPos).clone();
            const off = _camera.position.clone().sub(centre);
            const camUp    = new THREE.Vector3(0,1,0).applyQuaternion(_camera.quaternion);
            const camRight = new THREE.Vector3(1,0,0).applyQuaternion(_camera.quaternion);
            const yQ = new THREE.Quaternion().setFromAxisAngle(camUp,    dx*ROTATE_SPEED);
            const pQ = new THREE.Quaternion().setFromAxisAngle(camRight, dy*ROTATE_SPEED);
            off.applyQuaternion(yQ).applyQuaternion(pQ);
            _camera.position.copy(centre).add(off);
            _camera.quaternion.premultiply(yQ).premultiply(pQ).normalize();
            const curL = new THREE.Vector3(0,0,-1).applyQuaternion(_camera.quaternion);
            const tarL = centre.clone().sub(_camera.position).normalize();
            const dot  = curL.dot(tarL);
            if (dot < 0.9999 && dot > -0.9999) {
                const aQ = new THREE.Quaternion().setFromUnitVectors(curL, tarL);
                _camera.quaternion.premultiply(new THREE.Quaternion().slerp(aQ, ORBIT_ALIGN_SPEED)).normalize();
            }
        } else {
            const camUp    = new THREE.Vector3(0,1,0).applyQuaternion(_camera.quaternion);
            const camRight = new THREE.Vector3(1,0,0).applyQuaternion(_camera.quaternion);
            _camera.quaternion
                .premultiply(new THREE.Quaternion().setFromAxisAngle(camUp,    dx*ROTATE_SPEED))
                .premultiply(new THREE.Quaternion().setFromAxisAngle(camRight, dy*ROTATE_SPEED))
                .normalize();
        }
    });

    _canvas.addEventListener('wheel', e => {
        if (!_active) return;
        e.preventDefault();
        _camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, _camera.fov + e.deltaY*0.05));
        _camera.updateProjectionMatrix();
        _syncViewport();
    }, { passive: false });

    _canvas.addEventListener('click', e => {
        if (!_active || !starCloud) return;
        if (Math.abs(e.clientX-_mouseDownX) > 4 || Math.abs(e.clientY-_mouseDownY) > 4) return;
        const rect = _canvas.getBoundingClientRect();
        _pickMouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        _pickMouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        const refDist   = _camera.position.distanceTo(SOL_POS);
        const tanHFov   = Math.tan(_camera.fov/2 * Math.PI/180);
        _raycaster.params.Points.threshold = PICK_PX_TOL * 2 * tanHFov * Math.max(1, refDist) / _h;
        _raycaster.setFromCamera(_pickMouse, _camera);
        const hits = _raycaster.intersectObject(starCloud);
        if (!hits.length) {
            _selectedStarPos = null; _selectedStarMeta = null;
            _starAnnotation.style.display = 'none'; _starReticle.visible = false; return;
        }
        _selectedStarPos  = hits[0].point.clone();
        _selectedStarMeta = (starData && starData[hits[0].index]) || null;
        _updateAnnotation();
        if (_onStarSelected && _selectedStarMeta) _onStarSelected(_selectedStarMeta);
    });

    _starAnnotation.addEventListener('click', _startAutoMove);
    _canvas.style.cursor = 'grab';
}

function _syncViewport() {
    const h = _h * devicePixelRatio;
    for (const m of _allMats) m.uniforms.viewportH.value = h;
}

// ── DOM overlay creation ──────────────────────────────────────────────────────
function _injectStyles() {
    if (document.getElementById('gm-styles')) return;
    const s = document.createElement('style');
    s.id = 'gm-styles';
    s.textContent = `
.gm-annotation {
    position:absolute; display:none; font-family:'Share Tech Mono',monospace;
    font-size:11px; line-height:1.7; color:#ffdd66;
    background:rgba(0,0,0,.65); border:1px solid rgba(255,204,0,.35);
    border-radius:3px; padding:5px 9px; pointer-events:auto; cursor:pointer;
    white-space:pre; letter-spacing:.03em;
    transition:background .15s,border-color .15s; z-index:10; }
.gm-annotation:hover { background:rgba(255,204,0,.15); border-color:rgba(255,204,0,.75); }
.gm-annotation.flying { border-color:rgba(100,220,255,.75); color:#88eeff; }
.gm-info {
    position:absolute; top:12px; left:12px; color:#555;
    font-size:12px; line-height:1.7; pointer-events:none; z-index:10; }
.gm-controls {
    padding:4px 0; font-size:11px; color:#777;
    user-select:none; font-family:monospace; }
.gm-controls h3 {
    color:#aaa; font-size:10px; letter-spacing:.15em; text-transform:uppercase;
    margin-bottom:10px; border-bottom:1px solid #222; padding-bottom:6px; }
.gm-section { margin-bottom:12px; }
.gm-sh { display:flex; align-items:center; gap:8px; color:#888; font-size:10px;
    letter-spacing:.1em; text-transform:uppercase; margin-bottom:4px; }
.gm-sh input[type=checkbox] { accent-color:#5af; cursor:pointer; }
.gm-row { display:flex; align-items:center; gap:8px; margin:3px 0; }
.gm-row label { width:72px; color:#555; flex-shrink:0; }
.gm-row input[type=range] { flex:1; accent-color:#5af; cursor:pointer; }
.gm-row .gv { width:40px; text-align:right; color:#999; }
`;
    document.head.appendChild(s);
}

function _buildControlsPanel() {
    const el = document.createElement('div');
    el.className = 'gm-controls';
    el.style.display = 'none';
    el.innerHTML = `<h3>Rendering</h3>
<div class="gm-section">
  <div class="gm-sh"><input type="checkbox" id="gm-chkGal" checked> Galaxy</div>
  <div class="gm-row"><label>opacity ×</label>
    <input type="range" id="gm-slGalOp" min="0.01" max="1" step="0.01" value="0.3">
    <span class="gv" id="gm-vGalOp">0.3</span></div></div>
<div class="gm-section">
  <div class="gm-sh"><input type="checkbox" id="gm-chkGeo" checked> Geocentric</div>
  <div class="gm-row"><label>opacity ×</label>
    <input type="range" id="gm-slGeoOp" min="0.001" max="0.1" step="0.001" value="0.04">
    <span class="gv" id="gm-vGeoOp">0.04</span></div></div>
<div class="gm-section">
  <div class="gm-sh"><input type="checkbox" id="gm-chkStar" checked> Stars</div>
  <div class="gm-row"><label>opacity ×</label>
    <input type="range" id="gm-slStarOp" min="0.01" max="2" step="0.01" value="0.8">
    <span class="gv" id="gm-vStarOp">0.8</span></div></div>
<div class="gm-section">
  <div class="gm-sh"><input type="checkbox" id="gm-chkPlane" checked> Galactic plane</div>
  <div class="gm-row"><label>opacity</label>
    <input type="range" id="gm-slPlaneOp" min="0" max="0.5" step="0.005" value="0.08">
    <span class="gv" id="gm-vPlaneOp">0.08</span></div></div>`;
    return el;
}

function _wireControls() {
    function wire(slId, vId, cb) {
        const sl = document.getElementById(slId), vl = document.getElementById(vId);
        if (!sl || !vl) return;
        sl.addEventListener('input', () => { const v = parseFloat(sl.value); vl.textContent = v; cb(v); });
    }
    wire('gm-slGalOp',  'gm-vGalOp',  v => { if (galCloud)  galCloud.material.uniforms.opacScale.value = v; });
    wire('gm-slGeoOp',  'gm-vGeoOp',  v => { if (geoCloud)  geoCloud.material.uniforms.opacScale.value = v; });
    wire('gm-slStarOp', 'gm-vStarOp', v => { if (starCloud) starCloud.material.uniforms.opacScale.value = v; });

    const slPlane = document.getElementById('gm-slPlaneOp');
    const vPlane  = document.getElementById('gm-vPlaneOp');
    if (slPlane) slPlane.addEventListener('input', e => {
        const v = parseFloat(e.target.value); vPlane.textContent = v;
        if (_planeMat)     _planeMat.opacity     = v;
        if (_planeWireMat) _planeWireMat.opacity = Math.min(1, v*4.5);
        if (_ringMat)      _ringMat.opacity       = Math.min(1, v*5.5);
    });

    ['Gal','Geo','Star'].forEach(k => {
        const chk = document.getElementById('gm-chk'+k); if (!chk) return;
        chk.addEventListener('change', e => {
            const obj = k==='Gal' ? galCloud : k==='Geo' ? geoCloud : starCloud;
            if (obj) obj.visible = e.target.checked;
        });
    });
    const chkPlane = document.getElementById('gm-chkPlane');
    if (chkPlane) chkPlane.addEventListener('change', e => {
        if (_planeGroup) _planeGroup.visible = e.target.checked;
    });
}

// ── Data loading ──────────────────────────────────────────────────────────────
let _galRaw = null;

export async function loadGalaxyMapData() {
    if (_dataLoaded) return;
    _dataLoaded = true;
    _galRaw = GalaxyDots.get();
}

// ── Scene assembly (called after loadGalaxyMapData + starData is populated) ───
export function buildGalaxyScene() {
    if (_sceneBuilt) return;
    if (!_galRaw)          { console.error('galaxymap: galaxy dots not loaded'); return; }
    if (!milkywayData)     { console.error('galaxymap: milkywayData not ready'); return; }
    if (!starData.length)  { console.error('galaxymap: starData empty');         return; }

    // ── Galaxy dots ──────────────────────────────────────────────────────────
    const _galCoreSq = Math.pow(6*5.9, 2);
    function galCent(d) {
        const I = 0.7071, dx = d.x-400, dy = d.y-400;
        const du = (dx+dy)*I, dv = (-dx+dy)*I;
        const cSq = du*du + 0.25*dv*dv;
        return cSq > 3*_galCoreSq ? 0 : Math.exp(-cSq / (2*_galCoreSq));
    }
    const galProc = _galRaw.map(d => {
        const c = galCent(d);
        const r = Math.min(30, (d.r||4) * (1 + 0.5*c));
        const A = Math.min(1.0, (d.A||0) * (1 + 0.2*c));
        const thick = 5.9*(1 + 1.0*c);
        const shift = gaussianRandom(0, thick - d.r);
        const z = d.r > thick ? 0 : (shift < 0 ? -1 : 1)*2*(thick - d.r) + shift;
        return { x: d.x, y: d.y, z, r, R: d.R, G: d.G, B: d.B, A };
    });
    galCloud = _buildCloud(galProc, VERT_DOT, GAL_SCALE, GAL_OPAC); _scene.add(galCloud);
    _galRaw = null; // data is now in GPU buffer

    // ── Geocentric survey (pre-parsed by loadMilkyWayParticles in physics.js) ──
    const geoRaw = [];
    for (const p of milkywayData) {
        const lon  = (p.lon + 180) % 360;
        const lat  = p.lat; // already negated by physics.js
        const dist = p.dist * 5.9;
        const { ir, opt } = p;
        const lonRad = -lon * DEG + Math.PI, latRad = lat * DEG;
        const cosLat = Math.cos(latRad);
        const px = cosLat * Math.cos(lonRad);
        const py = Math.sin(latRad);
        const pz = cosLat * Math.sin(lonRad);
        let sz = 1.5 * (1 + ir*2) * (dist/170);
        const angD = Math.min(Math.abs(lon+180)%360, Math.abs(180-lon)%180);
        if (angD < 15) sz *= 1 + 0.1*(1 - angD/15);
        const [R,G,B,A] = colorFromIR(ir, opt);
        geoRaw.push({ x: pz*dist+400, y: px*dist+162+400, z: py*dist+0.08, r: sz, R, G, B, A });
    }
    geoCloud = _buildCloud(geoRaw, VERT_DOT, GEO_SCALE, GEO_OPAC); _scene.add(geoCloud);

    // ── Nearby stars ─────────────────────────────────────────────────────────
    starCloud = _buildStars(); _scene.add(starCloud);

    if (_infoEl) _infoEl.innerHTML =
        `galaxy: ${galProc.length.toLocaleString()} &nbsp;|&nbsp; ` +
        `geo: ${geoRaw.length.toLocaleString()} &nbsp;|&nbsp; ` +
        `stars: ${starData.length.toLocaleString()}<br>` +
        `drag: trackball &nbsp; shift+drag: strafe &nbsp; ctrl+drag: orbit &nbsp; scroll: zoom`;

    // Wire slider callbacks now that clouds exist
    _wireControls();
    _sceneBuilt = true;
}

// ── Initialization ────────────────────────────────────────────────────────────
export function initGalaxyMap(canvas, container) {
    _canvas = canvas; _container = container;
    _w = canvas.width; _h = canvas.height;

    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setSize(_w, _h);
    _renderer.setPixelRatio(devicePixelRatio);

    _scene = new THREE.Scene();
    _camera = new THREE.PerspectiveCamera(45, _w/_h, 0.001, 50000);
    _camera.position.set(SOL_POS.x, SOL_POS.y - CLOSEUP_DIST, SOL_POS.z + CLOSEUP_DIST*0.2);
    // Look toward galactic centre
    const lookDir = new THREE.Vector3(-SOL_X, -SOL_Y, -SOL_Z).normalize();
    const up = new THREE.Vector3(0, 0, 1);
    const right = new THREE.Vector3().crossVectors(lookDir, up).normalize();
    const up2 = new THREE.Vector3().crossVectors(right, lookDir).normalize();
    _camera.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(right, up2, lookDir.clone().negate()));

    _hudScene  = new THREE.Scene();
    _hudCamera = new THREE.OrthographicCamera(-_w/2, _w/2, _h/2, -_h/2, 0, 1);

    _buildReticle();
    _buildStarReticle();
    _lineHyp = _makeHudLine(); _lineZ = _makeHudLine(); _lineXY = _makeHudLine();
    _buildGalPlane();
    _buildGCGroup();

    _injectStyles();
    _starAnnotation = document.createElement('div');
    _starAnnotation.className = 'gm-annotation';
    _container.appendChild(_starAnnotation);

    _infoEl = document.createElement('div');
    _infoEl.className = 'gm-info';
    _infoEl.textContent = 'Loading galaxy data…';
    _container.appendChild(_infoEl);

    _controlsEl = _buildControlsPanel();
    const _settingsPanel = document.getElementById('controls-settings');
    if (_settingsPanel) _settingsPanel.appendChild(_controlsEl);
    else _container.appendChild(_controlsEl);

    _setupEvents();
}

// ── Resize ────────────────────────────────────────────────────────────────────
export function resizeGalaxyMap(w, h) {
    _w = w; _h = h;
    _renderer.setSize(w, h);
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
    _hudCamera.left   = -w/2; _hudCamera.right  =  w/2;
    _hudCamera.top    =  h/2; _hudCamera.bottom = -h/2;
    _hudCamera.updateProjectionMatrix();
    _syncViewport();
}

// ── Animation loop ────────────────────────────────────────────────────────────
function _animate() {
    _animId = requestAnimationFrame(_animate);

    if (_autoMoving) _applyAutoMove();
    else             _applyWASD();

    const camDist = scaledDist(SOL_POS);

    if (galCloud) galCloud.material.uniforms.camFade.value = 0.1 + 0.9*smoothstep(FADE_NEAR, FADE_FAR, camDist*1.4);
    if (geoCloud) geoCloud.material.uniforms.camFade.value = 1 - smoothstep(FADE_NEAR, FADE_MID, camDist*1.1);

    const gcFade = 0.1 + 0.9*smoothstep(FADE_NEAR, FADE_FAR, camDist*1.4);
    if (gcFade !== _gcFadeLast) {
        _gcFadeLast = gcFade;
        _gcGroup.traverse(obj => {
            if (!obj.isMesh) return;
            const base = obj.userData.baseOpacity ?? 1.0;
            const u = obj.material.uniforms;
            if (u?.uOpacity !== undefined) u.uOpacity.value = base * gcFade;
            else if (u?.uO !== undefined)  u.uO.value       = base * gcFade;
            else                           obj.material.opacity = base * gcFade;
        });
    }

    if (starCloud) {
        starsDotScale = 1.0 * Math.max(1, Math.min(3, camDist/6)) * (1 + (_camera.fov/90 - 0.5));
        starCloud.material.uniforms.camDistScale.value = 0.1 + 0.9*Math.min(1, camDist/400);
        starCloud.material.uniforms.dotScale.value     = starsDotScale;
    }

    // Reticle at ship/Sol position
    const sNDC = shipPos.clone().project(_camera);
    const sx = sNDC.x * _w/2, sy = sNDC.y * _h/2;
    const behind = sNDC.z > 1.0;
    const margin = RETICLE_R + RETICLE_TICK + 2;
    _reticle.visible = !behind && Math.abs(sx) <= _w/2-margin && Math.abs(sy) <= _h/2-margin;
    if (_reticle.visible) _reticle.position.set(sx, sy, 0);

    // Star reticle + annotation + measurement lines
    if (_selectedStarPos) {
        const toStar   = _selectedStarPos.clone().sub(_camera.position);
        const camRight = new THREE.Vector3(1,0,0).applyQuaternion(_camera.quaternion);
        const camUp    = new THREE.Vector3(0,1,0).applyQuaternion(_camera.quaternion);
        const camFwd   = new THREE.Vector3(0,0,-1).applyQuaternion(_camera.quaternion);
        const lx = toStar.dot(camRight), ly = toStar.dot(camUp), lz = toStar.dot(camFwd);
        const tanH = Math.tan(_camera.fov * Math.PI/360);
        const asp  = _w/_h, dep = Math.max(1e-6, Math.abs(lz)), sign = lz > 0 ? 1 : -1;
        const ndx  = sign * lx / (dep * tanH * asp);
        const ndy  = sign * ly / (dep * tanH);
        const M = 22;
        const stx = ndx * _w/2, sty = ndy * _h/2;
        const onScr = lz > 0 && Math.abs(stx) <= _w/2-M && Math.abs(sty) <= _h/2-M;
        _starReticle.visible = onScr;
        if (onScr) _starReticle.position.set(stx, sty, 0);

        const AW=155, AH=72, AM=8;
        let ax, ay;
        if (onScr) {
            ax = _w/2  + stx + 20; ay = _h/2 - sty - 20 - AH;
        } else {
            const magX = Math.abs(ndx), magY = Math.abs(ndy);
            const t = (magX > 1e-9 || magY > 1e-9) ? 1/Math.max(magX,magY) : 1;
            ax = _w/2  + ndx*t * (_w/2  - AW/2 - AM) - AW/2;
            ay = _h/2  - ndy*t * (_h/2  - AH/2 - AM) - AH/2;
        }
        _starAnnotation.style.display = 'block';
        _starAnnotation.style.left = Math.max(AM, Math.min(_w-AW-AM, ax)) + 'px';
        _starAnnotation.style.top  = Math.max(AM, Math.min(_h-AH-AM, ay)) + 'px';

        const knee  = new THREE.Vector3(_selectedStarPos.x, _selectedStarPos.y, shipPos.z);
        const hShip = _worldToHUD(shipPos,         4);
        const hStar = _worldToHUD(_selectedStarPos, 4);
        const hKnee = _worldToHUD(knee,             4);
        _lineHyp.visible = hShip.drawable && hStar.drawable;
        _lineZ.visible   = hStar.drawable && hKnee.drawable;
        _lineXY.visible  = hShip.drawable && hKnee.drawable;
        if (_lineHyp.visible) _setHudLine(_lineHyp, hShip, hStar);
        if (_lineZ.visible)   _setHudLine(_lineZ,   hStar, hKnee);
        if (_lineXY.visible)  _setHudLine(_lineXY,  hShip, hKnee);
    } else {
        _starReticle.visible = false;
        _lineHyp.visible = _lineZ.visible = _lineXY.visible = false;
        if (_starAnnotation) _starAnnotation.style.display = 'none';
    }

    // World pass then HUD overlay
    _renderer.autoClear = true;
    _renderer.render(_scene, _camera);
    _renderer.autoClear = false;
    _renderer.clearDepth();
    _renderer.render(_hudScene, _hudCamera);
    _renderer.autoClear = true;
}

export function startGalaxyLoop() {
    _vel.set(0, 0, 0);
    _angVel.set(0, 0, 0);
    _active = true;
    _animId = requestAnimationFrame(_animate);
    if (_infoEl)    _infoEl.style.display    = 'block';
    if (_controlsEl) _controlsEl.style.display = 'block';
}

export function stopGalaxyLoop() {
    _active = false;
    _autoMoving = false;
    if (_animId) { cancelAnimationFrame(_animId); _animId = null; }
    if (_starAnnotation) _starAnnotation.style.display = 'none';
    if (_infoEl)    _infoEl.style.display    = 'none';
    if (_controlsEl) _controlsEl.style.display = 'none';
}

// ── Ship position sync ────────────────────────────────────────────────────────
// posLY: {x,y,z} in the adastra Three.js equatorial convention
//   (x=cos(dec)cos(ra), y=sin(dec), z=-cos(dec)sin(ra)), units: light-years from Sol
export function setShipPositionLY(posLY) {
    // Restate in standard equatorial Cartesian (ex=cos(dec)cos(ra), ey=cos(dec)sin(ra), ez=sin(dec))
    const ex = posLY.x, ey = -posLY.z, ez = posLY.y;
    // Project onto galactic axes (M0→l=0/GC, M1→l=90°, M2→NGP)
    const gx = M0[0]*ex + M0[1]*ey + M0[2]*ez;
    const gy = M1[0]*ex + M1[1]*ey + M1[2]*ez;
    const gz = M2[0]*ex + M2[1]*ey + M2[2]*ez;
    // Convert to viewer-space position (see _buildStars for the same mapping)
    shipPos.set(
        SOL_POS.x - gy * LY_TO_PX,
        SOL_POS.y + gx * LY_TO_PX,
        SOL_POS.z + gz * LY_TO_PX
    );
    if (_shipSphere) {
        _shipSphere.position.copy(shipPos);
        _shipWire.position.copy(shipPos);
        _shipRings.position.copy(shipPos);
    }
    // Clear any previous selection and auto-move
    _selectedStarPos = null; _selectedStarMeta = null;
    _autoMoving = false;
    if (_starAnnotation) _starAnnotation.style.display = 'none';
    if (_starReticle) _starReticle.visible = false;
    // Reset camera to 10-ly view around ship, looking toward galactic centre
    if (_camera) {
        _camera.up.set(0, 0, 1);
        _camera.position.set(shipPos.x, shipPos.y - CLOSEUP_DIST, shipPos.z + CLOSEUP_DIST * 0.2);
        _camera.lookAt(0, 0, 0);
    }
}

export function getSelectedStar() {
    return _selectedStarMeta;
}

export function setSelectedStarInMap(star) {
    if (!star || star.ra == null || star.dec == null || !star.dist0) return;
    const [l, b] = eqToGal(star.ra, star.dec);
    const dpx = star.dist0 * LY_TO_PX;
    _selectedStarPos = new THREE.Vector3(
        SOL_POS.x + (-Math.sin(l)) * Math.cos(b) * dpx,
        SOL_POS.y + Math.cos(l) * Math.cos(b) * dpx,
        SOL_POS.z + Math.sin(b) * dpx
    );
    _selectedStarMeta = star;
    _updateAnnotation();
}
