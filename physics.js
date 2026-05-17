const PC_TO_LY = 3.26156;
const PC_TO_AU   = 206265.0;
const AU_IN_LY = 0.0000158125;
const AU_PER_LY = 63241.1;
const ECLIPTIC_OBLIQUITY = 23.44 * Math.PI / 180;
const DEG_TO_RAD = Math.PI / 180;
const MAS_PER_RAD = 206264806.0;
const AU_TO_KM    = 1.496e8;
const SEC_PER_YEAR = 3.156e7;

export let starData = [];
export let nameToHip = {};
export let hipToNames = {};
export let hipToStar = {};

import {mercuryB64, venusB64, earthB64, marsB64, jupiterB64, saturnB64, uranusB64, neptuneB64, moonB64, callistoB64, europaB64, ganymedeB64, ioB64} from './texture.js'; // base64 -w 0 earth.jpg > earth_b64.txt , prefix "data:image/jpeg;base64,"
import {EXODATA} from './extrasolar.js';

    const mercuryTexture = new THREE.TextureLoader().load(mercuryB64);
    mercuryTexture.wrapS = THREE.RepeatWrapping;
    mercuryTexture.mapping = THREE.EquirectangularReflectionMapping; // optional, helps with pole pinching
    const venusTexture = new THREE.TextureLoader().load(venusB64);
    venusTexture.wrapS = THREE.RepeatWrapping;
    venusTexture.mapping = THREE.EquirectangularReflectionMapping; // optional, helps with pole pinching
    const earthTexture = new THREE.TextureLoader().load(earthB64);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.mapping = THREE.EquirectangularReflectionMapping; // optional, helps with pole pinching
    const marsTexture = new THREE.TextureLoader().load(marsB64);
    marsTexture.wrapS = THREE.RepeatWrapping;
    marsTexture.mapping = THREE.EquirectangularReflectionMapping;
    const jupiterTexture = new THREE.TextureLoader().load(jupiterB64);
    jupiterTexture.wrapS = THREE.RepeatWrapping;
    jupiterTexture.mapping = THREE.EquirectangularReflectionMapping;
    const saturnTexture = new THREE.TextureLoader().load(saturnB64);
    saturnTexture.wrapS = THREE.RepeatWrapping;
    saturnTexture.mapping = THREE.EquirectangularReflectionMapping;
    const uranusTexture = new THREE.TextureLoader().load(uranusB64);
    uranusTexture.wrapS = THREE.RepeatWrapping;
    uranusTexture.mapping = THREE.EquirectangularReflectionMapping;
    const neptuneTexture = new THREE.TextureLoader().load(neptuneB64);
    neptuneTexture.wrapS = THREE.RepeatWrapping;
    neptuneTexture.mapping = THREE.EquirectangularReflectionMapping;

    const moonTexture = new THREE.TextureLoader().load(moonB64);
    moonTexture.wrapS = THREE.RepeatWrapping;
    moonTexture.mapping = THREE.EquirectangularReflectionMapping;
    const callistoTexture = new THREE.TextureLoader().load(callistoB64);
    callistoTexture.wrapS = THREE.RepeatWrapping;
    callistoTexture.mapping = THREE.EquirectangularReflectionMapping;
    const europaTexture = new THREE.TextureLoader().load(europaB64);
    europaTexture.wrapS = THREE.RepeatWrapping;
    europaTexture.mapping = THREE.EquirectangularReflectionMapping;
    const ganymedeTexture = new THREE.TextureLoader().load(ganymedeB64);
    ganymedeTexture.wrapS = THREE.RepeatWrapping;
    ganymedeTexture.mapping = THREE.EquirectangularReflectionMapping;
    const ioTexture = new THREE.TextureLoader().load(ioB64);
    ioTexture.wrapS = THREE.RepeatWrapping;
    ioTexture.mapping = THREE.EquirectangularReflectionMapping;


    export const PLANET_TEXTURE = {'Mercury' : mercuryTexture, 'Venus' : venusTexture, 'Earth' : earthTexture, 'Mars' : marsTexture, 'Jupiter': jupiterTexture, 'Saturn': saturnTexture, 'Uranus' : uranusTexture, 'Neptune' : neptuneTexture};
    

import {Milkyway, StarNameMap, Stars} from './data.js';

// orbital parameters (to draw orbital ellipses)
// [a, e, i_deg, Omega_deg, w_deg] = semi-major axis, eccentricity, inclination, longitude of ascending node, argument of perihelion
// needs perihelion precession or the ellipses are stuck at J2000 orbit
export const SOL_SYSTEM =  {
  "Mercury": [0.387098, 0.20563, 7.005, 48.331, 29.124],
  "Venus": [0.723332, 0.006772, 3.39458, 76.68, 54.884],
  "Earth": [1, 0.0167086, 0.00005, -11.26064, 114.20783], // a = 1 AU; i negligible
  "Mars": [1.52368055, 0.0934, 1.85, 49.57854, 286.5],
  "Jupiter": [5.4570, 0.0489, 1.303, 100.464, 273.867],
  "Saturn": [9.5826, 0.0565, 2.485, 113.665, 339.392],
  "Uranus": [19.19126, 0.04717, 0.773, 74.006, 96.998857],
  "Neptune": [30.07, 0.008678, 1.770, 131.783, 273.187],
  "Pluto": [39.482, 0.2488, 17.16, 110.299, 113.834],
  "Eris": [67.69, 0.44, 44.18, 36.02, 151.66]
  }

//orbital parameters array:
// a [AU], e, i_deg, Omega_deg, w_deg_J2000, t_period [days], time_of_perigee [days], prec_rate_node [rad/day], prec_rate_perigee [rad/day], mabs, r [r_E] 
// t_perigee = days from J2000 when mean anomaly was zero
// = -(mean_longitude - w_deg) / (360/T_period)
// Source: Lainey et al. 2006 L1 ephemeris / JPL JUP365
// JPL Horizons https://ssd.jpl.nasa.gov/horizons/app.html#/

export const MOONS = [									//18.9743 <- systemic 2d offset?
{name: 'Moon', parent: 2, mass: 0.0123, 
	orbit: [2.5695e-3, 0.0549, 5.154, 125.06, 319.30986, 27.321661, 17.44, -9.243835e-4, 1.9438e-3, 0.21, 0.2727], // t_perigee: 16.97 (verify w_deg_J2000)
	temp: 100, ir: 0.14, texture: moonTexture, color: new THREE.Color(0x9d9998),
	tilt: 6.687, tiltdir: 266.86, period: 27.321661, periodoffset: 0.5, precession: 0},
{name: 'Ganymede', parent: 4, mass: 0.025,  // mean longitude ≈ 317.5°, w ≈ 192.4°
	orbit: [7.155e-3, 0.0015, 0.20,  0, 192.4, 7.154553, -2.410, 0, 0, -2.09, 0.413],
	temp: 120, ir: 0.43, texture: ganymedeTexture, color: new THREE.Color(0.668, 0.596, 0.514)},
{name: 'Callisto', parent: 4, mass: 0.018, 	// mean longitude ≈ 181.4°, w ≈ 52.6°
	orbit: [1.2585e-2,0.0074, 0.19,  0, 52.6, 16.689018, -5.542, 0, 0, -1.05, 0.378],
	temp: 130, ir: 0.22, texture: callistoTexture, color: new THREE.Color(0.647, 0.570, 0.436)},
{name: 'Io', parent: 4, mass: 0.015, 	 // mean longitude at J2000 ≈ 106.1°, w ≈ 84.1°, t_perihel = -(106.1-84.1)/( 360/1.769138) = -0.108 days
	orbit: [2.81e-3,  0.0041, 0.05,  0, 84.1, 1.769138, -0.308, 0, 0, -1.68, 0.2859],
	temp: 140, ir: 0.63, texture: ioTexture, color: new THREE.Color(0.755, 0.626, 0.519)},
{name: 'Europa', parent: 4, mass: 0.008, 	// mean longitude ≈ 175.1°, w ≈ 88.9°
	orbit: [4.485e-3, 0.0095, 0.47, 0, 88.9, 3.551181, -0.843, 0, 0, -1.41, 0.245],
	temp: 110, ir: 0.67, texture: europaTexture, color: new THREE.Color(1.0, 0.965, 0.848)},
{name: 'Titan', parent: 5, mass: 0.0225, 	// mean longitude ≈ 176.0°, w ≈ 185.3°
	orbit: [8.168e-3, 0.0288, 0.349, 0, 185.3, 15.9454,  -0.372, 0, 0, -1, 0.404],
	temp: 94, ir: 0.22, texture: null, color: new THREE.Color(0.918, 0.847, 0.514)},
{name: 'Triton', parent: 7,  mass: 0.00358, 	// retrograde, mean longitude ≈ 264.8°, w ≈ 318.5°
	orbit: [2.3715e-3, 0.000, 129.6,  0, 318.5,  5.876854, -0.723, 0, 0, -1.15, 0.212],
	temp: 38, ir: 0.76, texture: null, color: new THREE.Color(0x999999)},
{name: 'Titania', parent: 6,  mass: 5.768e-4, 
	orbit: [2.9138e-3, 0.0011, 0.34,  0, 0, 8.706, 0, 0, 0, 1.2, 0.1235],
	temp: 180, ir: 0.35, texture: null, color: new THREE.Color(0x999999)},
{name: 'Rhea', parent: 5, mass: 3.9e-4,
	orbit: [3.52e-3, 0.001, 0.35, 0, 0, 4.518212,  0, 0, 0, 0.15, 0.1198],
	temp: 75, ir: 0.95, texture: null, color: new THREE.Color(0x999999)},
{name: 'Oberon', parent: 6, mass: 5.19e-4,
	orbit: [3.90e-3, 0.0014, 0.06, 0, 0, 13.463234,  0, 0, 0, 1.22, 0.11536],
	temp: 75, ir: 0.31, texture: null, color: new THREE.Color(0x999999)},
{name: 'Iapetus', parent: 5, mass: 3.01e-4,
	orbit: [0.02380, 0.02768, 17.28, 0, 0, 79.3215,  0, 0, 0, 1, 0.1154],
	temp: 110, ir: 0.2, texture: null, color: new THREE.Color(0x888888)}, // bicolor, use texture or vertex coloring
{name: 'Charon', parent: 8, mass: 2.66e-4,
	orbit: [1.3e-3, 2e-4, 119.6, 223.046, 0, 6.38722,  0, 0, 0, 0.5, 0.095],
	temp: 53, ir: 0.38, texture: null, color: new THREE.Color(0x999696)},
{name: 'Umbriel', parent: 6, mass: 2.15e-4,
	orbit: [1.78e-3, 0.0039, 0.128, 0, 0, 4.144,  0, 0, 0, 2.1, 0.092],
	temp: 80, ir: 0.26, texture: null, color: new THREE.Color(0x888888)},
{name: 'Ariel', parent: 6, mass: 2.06e-4,
	orbit: [1.28e-3, 0.0012, 0.26, 0, 0, 2.52,  0, 0, 0, 1.45, 0.091],
	temp: 70, ir: 0.53, texture: null, color: new THREE.Color(0x888888)},
{name: 'Dione', parent: 5, mass: 1.83e-4,
	orbit: [2.523e-3, 0.0022, 0.019, 0, 0, 2.737,  0, 0, 0, 0.85, 0.088],
	temp: 87, ir: 0.998, texture: null, color: new THREE.Color(0x999999)},
{name: 'Tethys', parent: 5, mass: 1.03e-4,
	orbit: [1.9695e-3, 0.0001, 1.12, 0, 0, 1.888,  0, 0, 0, 0.65, 0.083],
	temp: 86, ir: 1.229, texture: null, color: new THREE.Color(0x999999)},
{name: 'Enceladus', parent: 5, mass: 1.8e-5,
	orbit: [1.591e-3, 0.0047, 0.009, 0, 0, 1.370,  0, 0, 0, 2.15, 0.0395],
	temp: 75, ir: 1.375, texture: null, color: new THREE.Color(0x999999)},
{name: 'Miranda', parent: 6, mass: 1.05e-5,
	orbit: [8.650e-4, 0.0047, 4.232, 0, 0, 1.4135,  0, 0, 0, 3.9, 0.0370],
	temp: 70, ir: 0.32, texture: null, color: new THREE.Color(0x999999)},
{name: 'Proteus', parent: 7, mass: 4e-6,
	orbit: [7.8646e-4, 0.0005, 0.524, 0, 0, 1.1223,  0, 0, 0, 1, 0.0329],
	temp: 70, ir: 0.32, texture: null, color: new THREE.Color(0x999999)},
{name: 'Mimas', parent: 5, mass: 6.3e-6,
	orbit: [1.240e-3, 0.0196, 1.574, 0, 0, 0.94242,  0, 0, 0, 3.35, 0.0311],
	temp: 64, ir: 0.962, texture: null, color: new THREE.Color(0x999999)},
{name: 'Nereid', parent: 7, mass: 6.3e-6,
	orbit: [0.03679, 0.749, 5.8, 0, 0, 360.14,  0, 0, 0, 4, 0.0280],
	temp: 50, ir: 0.24, texture: null, color: new THREE.Color(0x999999)},	// as good as invisible
{name: 'Dysnomia', parent: 9, mass: 1.37e-5,
	orbit: [2.4916e-4, 0.0062, 78.29, 126, 181, 15.785,  326, 290, 0, 4, 0.0483],
	temp: 42, ir: 0.05, texture: null, color: new THREE.Color(0x888888)}
];


  // name,   RA°,       Dec°,dist/kly, app-mag, diam°, obl(b/a), rot°, diff, temp kK
export const DEEPSKY_OBJECTS = [
    ["LMC",  80.892,   -69.757,  163, 0.13, 10.0, 0.5,  30,  0.04, 7.0],
    ["SMC",  13.187,   -72.829,  204, 2.4,  5.3,  0.66, 320, 0.1,  7.0],
    ["M31",  10.6846,  41.2692, 2500, 3.44, 4.0, 0.315, 315, 0.25, 4.5], // Andromeda
    ["M33",  23.82,    30.7944, 2880, 5.72, 1.18, 0.59, 280, 0.25, 4.5],
    ["M45",  56.4,      24.15,   0.4, 2.0,  1.8,  1,    0,   0.2,  9.0], // Pleiades
    ["M42",  83.82,    -5.388,  1.34, 4.0,  2.5,  1,    0,   0.25, 4.5], // Orion nebula
    ["M8",   270.904,  -24.3867, 4.1, 4.6,  1.0,  1,    0,   0.4,  4.5],
    ["M20",  270.596,  -23.03,   4.1, 6.3,  0.5,  1,    0,   0.4,  7.0],
    ["M16",  274.6879, -13.7869, 5.7, 6.4,  1.17, 0.71, 315, 0.7,  4.0],
    ["M24",  274.25,   -18.5,     10, 2.5,  2.0,  0.5,  0,   0.15, 5.0],
    ["M17",  275.108,  -16.18,   5.5, 6.0,  0.5,  1,    0,   0.2,  4.5], // Swan nebula
    ["M7",   268.463,  -34.793, 0.98, 3.3,  1.33, 1,    0,   0.15, 5.0],
    ["M22",  279.10,   -23.905, 10.6, 5.1,  0.1,  1,    0,   0.7,  5.5],
    ["M4",   245.897,  -26.5258, 7.2, 5.6,  0.43, 1,    0,   0.03, 5.5],
    ["M5",   229.638,    2.081, 24.5, 5.6,  0.38, 1,    0,   0.03, 5.5]
  ];


        // Convert Tc (temperature class code) to spectral class string
        export function tcToSpectralClass(tc) {
            // Tc encoding: O=10, B=20, A=30, F=40, G=50, K=60, M=70, L=80, T=90, S=100, C=110, R=120, N=130
            // Plus subclass 0-9
            const classes = {
                10: 'O', 20: 'B', 30: 'A', 40: 'F', 50: 'G', 
                60: 'K', 70: 'M', 80: 'L', 90: 'T', 100: 'S',
                110: 'C', 120: 'R', 130: 'N'
            };
            const baseClass = Math.floor(tc / 10) * 10;
            const subClass = tc % 10;
            const letter = classes[baseClass] || '?';
            return `${letter}${subClass}`;
        }

        // Spectral type color mapping
	//pre-calculated spectral colors (Planck radiation)
	//O0 (>100kK): 4c8bf8
	//B0 (33kK): 5697ff
	//A0 (10kK): 87c0ff
	//F0 (7.3kK): b4e0ff
	//G0 (6kK): e4feff
	//K0 (5.3 kK): f8ffe9
	//M0 (3.9 kK): ffc887
	//M9 (2.3kK) ff6721 

        // L=80 T=90 S=100 C=110 R=120 N=130
        // S, R, N, C are cool carbon-rich stars, set to #ff2000
        // L, T are infrared, set to #400000
        const TEMPERATURES = [100,33,10,7.3,6,5.3,3.9,2.3];
	const SPECTRAL_COLORS_CARBON = { r: 0xff/255, g: 0x20/255, b: 0x00/255 }; // Tc >= 100
	const SPECTRAL_COLORS_IR = { r: 0x40/255, g: 0x00/255, b: 0x00/255 };   // 80 <= Tc < 100
        const SPECTRAL_COLORS = [
            { r: 0x4c/255, g: 0x8b/255, b: 0xf8/255 },  // Tc 10
            { r: 0x56/255, g: 0x97/255, b: 0xff/255 },  // Tc 20
            { r: 0x87/255, g: 0xc0/255, b: 0xff/255 },  // Tc 30
            { r: 0xb4/255, g: 0xe0/255, b: 0xff/255 },  // Tc 40
            { r: 0xe4/255, g: 0xfe/255, b: 0xff/255 },  // Tc 50
            { r: 0xf8/255, g: 0xff/255, b: 0xf9/255 },  // Tc 60
            { r: 0xff/255, g: 0xc8/255, b: 0x87/255 },  // Tc 70
            { r: 0xff/255, g: 0x67/255, b: 0x21/255 },  // Tc 79
        ];

        function lerp(a, b, t) {
            return a + (b - a) * t;
        }

	export function tcTokK(tc) {
            // Non-standard types (L, T, S, C, R, N) 
            if (tc >= 100) {return 2.5;}
            if (tc >= 80) {return 1;}            
            if (tc < 10) {return 6;}            
            // Standard O B A F G K M sequence: Tc 10-79
            const i = Math.floor((tc-10)/10);
	    const t = (tc % 10) / 10;
            return Math.floor(lerp(TEMPERATURES[i], TEMPERATURES[i+1], t)*100)/100;
	}

	export function tcToColor(tc) {
            // Non-standard types (L, T, S, C, R, N) 
            if (tc >= 100) {
                return SPECTRAL_COLORS_CARBON;
            }
             if (tc >= 80) {
                return SPECTRAL_COLORS_IR;
            }

             if (tc < 10) {
                return SPECTRAL_COLORS[5]; // spectral class unknown, make it "white"?
            }
            
            // Standard O B A F G K M sequence: Tc 10-79
            const i = Math.floor((tc-10)/10);
	    const t = (tc % 10) / 10;
            return {
                    r: lerp(SPECTRAL_COLORS[i].r, SPECTRAL_COLORS[i+1].r, t),
                    g: lerp(SPECTRAL_COLORS[i].g, SPECTRAL_COLORS[i+1].g, t),
                    b: lerp(SPECTRAL_COLORS[i].b, SPECTRAL_COLORS[i+1].b, t)
            };
        }

// Absolute magnitudes by luminosity class
// Data from standard stellar tables (Allen's Astrophysical Quantities, etc.)
export const stellarAbsMag = {
    // Supergiants (I) - relatively flat around -5 to -7
    1: [
        { temp: 42000, absMag: -6.8 },  // O5I
        { temp: 30000, absMag: -6.5 },  // B0I
        { temp: 15200, absMag: -6.2 },  // B5I
        { temp: 9600,  absMag: -6.0 },  // A0I
        { temp: 7200,  absMag: -6.0 },  // F0I
        { temp: 6000,  absMag: -6.0 },  // G0I
        { temp: 5200,  absMag: -6.0 },  // K0I
        { temp: 3800,  absMag: -5.5 },  // M0I
        { temp: 3200,  absMag: -5.5 },  // M5I
    ],
    
    // Giants (III) - varies significantly with temperature
    3: [
        { temp: 30000, absMag: -5.1 },  // B0III
        { temp: 15200, absMag: -2.2 },  // B5III
        { temp: 9600,  absMag: -0.2 },  // A0III
        { temp: 7200,  absMag: +1.5 },  // F0III
        { temp: 6000,  absMag: +0.9 },  // G0III
        { temp: 5200,  absMag: +0.7 },  // K0III
        { temp: 4400,  absMag: -0.2 },  // K5III
        { temp: 3800,  absMag: -0.4 },  // M0III
        { temp: 3200,  absMag: -0.3 },  // M5III
    ],
    
    // Main Sequence (V)
    5: [
        { temp: 42000, absMag: -5.7 },  // O5V
        { temp: 30000, absMag: -4.0 },  // B0V
        { temp: 15200, absMag: -1.2 },  // B5V
        { temp: 9600,  absMag: +0.6 },  // A0V
        { temp: 8200,  absMag: +1.9 },  // A5V
        { temp: 7200,  absMag: +2.7 },  // F0V
        { temp: 6400,  absMag: +3.5 },  // F5V
        { temp: 6000,  absMag: +4.4 },  // G0V
        { temp: 5778,  absMag: +4.83 }, // G2V (Sun)
        { temp: 5200,  absMag: +5.9 },  // K0V
        { temp: 4400,  absMag: +7.4 },  // K5V
        { temp: 3800,  absMag: +8.8 },  // M0V
        { temp: 3200,  absMag: +12.3 }, // M5V
    ],
};

// Interpolate absolute magnitude from temperature for a given luminosity class table
export function interpolateAbsMag(tempK, table) {
    // Handle out-of-range
    if (tempK >= table[0].temp) return table[0].absMag;
    if (tempK <= table[table.length - 1].temp) return table[table.length - 1].absMag;
    
    // Find bracketing entries (table is sorted hot→cool)
    for (let i = 0; i < table.length - 1; i++) {
        if (tempK <= table[i].temp && tempK > table[i + 1].temp) {
            // Interpolate in log(T) space for smoother results
            const logT = Math.log10(tempK);
            const logT1 = Math.log10(table[i].temp);
            const logT2 = Math.log10(table[i + 1].temp);
            const t = (logT - logT1) / (logT2 - logT1);
            return table[i].absMag + t * (table[i + 1].absMag - table[i].absMag);
        }
    }
    return 4.83; // fallback
}

// Get absolute magnitude for any luminosity class
export function getAbsoluteMagnitude(tempK, lc) {
    // Direct lookup for classes with tables
    if (stellarAbsMag[lc]) {
        return interpolateAbsMag(tempK, stellarAbsMag[lc]);
    }
    
    // Interpolate/approximate for intermediate classes
    const magV = interpolateAbsMag(tempK, stellarAbsMag[5]);
    const magIII = interpolateAbsMag(tempK, stellarAbsMag[3]);
    const magI = interpolateAbsMag(tempK, stellarAbsMag[1]);
    
    switch (lc) {
        case 2:  // Bright giants: between supergiants and giants
            return (magI + magIII) / 2;
        case 4:  // Subgiants: between giants and main sequence
            return (magIII + magV) / 2;
        case 6:  // Subdwarfs: ~1-2 mag dimmer than main sequence
            return magV + 1.5;
        default:
            return magV;
    }
}

// Main function: estimate distance from apparent magnitude, temperature, luminosity class
function estimateDistance(apparentMag, tempK, lc = 5) {
    const absMag = getAbsoluteMagnitude(tempK, lc);
    const distPc = Math.pow(10, (apparentMag - absMag + 5) / 5);
    return distPc * PC_TO_LY;
}

function estimateRadius(apparentMag, tempK, distanceLy) {
    const T_SUN = 5778;
    const M_BOL_SUN = 4.74;

    const distPc = distanceLy / PC_TO_LY;
    const absMagV = apparentMag - 5 * Math.log10(distPc) + 5;

    const BC = getBolometricCorrection(tempK);
    const absMagBol = absMagV + BC;

    // L/L_sun from bolometric magnitude difference
    const luminosityRatio = Math.pow(10, (M_BOL_SUN - absMagBol) / 2.5);

    // Stefan-Boltzmann: R/R_sun = sqrt(L/L_sun) * (T_sun/T)^2  ✓
    return Math.sqrt(luminosityRatio) * Math.pow(T_SUN / tempK, 2);
}

export function estimatePlanetSurfaceTemp(appmag, distly, startemp, distpl, albedo) {
//appmag, distly: star seen from Sol
//startemp: in kK
//distpl: in AU
    const T_SUN = 5778;
    const M_BOL_SUN = 4.74;
    const absMagV = appmag - 5 * Math.log10(distly/PC_TO_LY) + 5;
    const BC = getBolometricCorrection(startemp*1000);
    const absMagBol = absMagV + BC;
    const luminosityRatio = Math.pow(10, (M_BOL_SUN - absMagBol) / 2.5);

    // Equilibrium temperature formula: T = T_ref · L^¼ · (1−a)^¼ / √d
    // T_ref = 278 K: effective irradiation at 1 AU from the Sun with zero albedo
    return 278 * Math.pow(luminosityRatio, 0.25) * Math.pow(1 - albedo, 0.25) / Math.sqrt(distpl);
}

function getBolometricCorrection(tempK) {
    // Calibrated against Flower (1996) / Torres (2010) tables.
    // Convention: Mbol = Mv + BC,  BC ≤ 0 for essentially all stars.
    const table = [
        [3000, -3.00],
        [3500, -1.85],
        [4000, -0.84],
        [4500, -0.42],
        [5000, -0.20],
        [5500, -0.09],
        [5778, -0.07],   // Sun
        [6500, -0.06],
        [7000, -0.07],   // smooth through the old branch boundary
        [8000, -0.14],
        [9000, -0.25],
        [10000, -0.36],  // was -0.55 → root cause of the Sirius error
        [12000, -0.63],
        [15000, -0.92],
        [20000, -1.44],
        [25000, -2.00],
        [30000, -2.50],
        [40000, -3.15],
    ];

    if (tempK <= table[0][0])                   return table[0][1];
    if (tempK >= table[table.length - 1][0])    return table[table.length - 1][1];

    for (let i = 0; i < table.length - 1; i++) {
        const [t0, bc0] = table[i];
        const [t1, bc1] = table[i + 1];
        if (tempK >= t0 && tempK <= t1) {
            const frac = (tempK - t0) / (t1 - t0);
            return bc0 + frac * (bc1 - bc0);
        }
    }
}

export function estimateMass(radiusSolar, temp) {
    const T_SUN = 5.78;

    // Stefan-Boltzmann: L/L☉ = (R/R☉)² × (T/T☉)⁴
    const L = Math.pow(radiusSolar, 2) * Math.pow(temp / T_SUN, 4);

    // Invert the piecewise mass-luminosity relation (Carroll & Ostlie)
    //   M < 0.43:  L = 0.23 × M^2.3   (fully convective, steep)
    //   0.43–2:    L = M^4             (radiative envelope)
    //   2–55:      L = 1.4 × M^3.5    (CNO cycle dominant)
    //   > 55:      L = 32000 × M      (radiation-pressure dominated)

    if (L < 0.035) {
        return Math.pow(L / 0.23, 1 / 2.3);
    } else if (L < 16) {
        return Math.pow(L, 1 / 4);
    } else if (L < 1.75e6) {
        return Math.pow(L / 1.4, 1 / 3.5);
    } else {
        return L / 32000;
    }
}
   
// Estimate temperature from Tc (temperature class code)
// Tc encoding: O=10-19, B=20-29, A=30-39, F=40-49, G=50-59, K=60-69, M=70-79
function estimateTemperature(tc) {
    if (tc >= 100) return 2000;  // cool carbon-rich
    if (tc < 10 || tc > 79) return 100;  // infrared or invalid code
    //linear interpolation
    if (tc < 19) return 100000 - (tc - 10) * 6700;
    if (tc < 29) return 33000 - (tc - 20) * 1300;
    if (tc < 39) return 10000 - (tc - 30) * 270;
    if (tc < 49) return 7300 - (tc -40) * 130;
    if (tc < 59) return 6000 - (tc - 50) * 70;
    if (tc < 69) return 5300 - (tc - 60) * 140;
    return 3900 - (tc - 70) * 160;
}

//////////////////
// Shared parsed milkyway/geocentric survey data.
// Populated once by loadMilkyWayParticles(); exported for galaxymap.js.
export let milkywayData = null;

// data parsers

export async function loadMilkyWayParticles() {
    try {
        const text = await Milkyway.text();
        const lines = text.trim().split('\n');

        const particles = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 5) {
                particles.push({
                    lon:  parseFloat(parts[0]),
                    lat: -parseFloat(parts[1]),
                    dist: parseFloat(parts[2]),
                    ir:   parseFloat(parts[3]),
                    opt:  parseFloat(parts[4])
                });
            }
        }

        milkywayData = particles;
        console.log(`Loaded ${particles.length} Milky Way particles`);
        return particles;
    } catch (error) {
        console.error('Error loading Milky Way particles:', error);
        throw error;
    }
}

        export async function loadData() {
            document.getElementById('loading').style.display = 'block';            
            try {
                const nameMapResponse = StarNameMap;

                    const nameMapText = await nameMapResponse.text();
                    const namedCount = parseNameMap(nameMapText);
                    console.log(`Loaded ${namedCount} star name mappings`);

                const catalogueResponse = Stars;
                    const catalogueText = await catalogueResponse.text();
                    starData = parseStarData(catalogueText);
                    console.log(`Loaded ${starData.length} stars`);
		    // HIP designation lookup table
                    buildHipLookup();

            } catch (error) {
                console.error('Error loading data:', error);
            }            
            document.getElementById('loading').style.display = 'none';
        }
        
        //used to be parseXHIPData, now using merged data from XHIP and gaia
        function parseStarData(text) {
            const lines = text.split('\n');
            const data = [];
            let missingDistCount = 0;
            let distErr = 0;
	    let distErrSq = 0;
	    let distCount = 0;

	    // Sol - hardcoded as HIP 0
	    const posSol = raDecToXYZ(0, 0);
	    const sunStar = {
                hip: 0,
                // Dynamic values (updated based on camera position)
                mag: -26.7,
                ra: 0,
                dec: 0,
                dist: AU_IN_LY,
                x: posSol.x,
                y: posSol.y,
                z: posSol.z,
                // Baseline/reference values (constant)
                mag0: -26.7,              // Absolute reference magnitude at dist0
                dist0: AU_IN_LY,          // Reference distance (1 AU)
                M: 4.83,
                xEq: AU_IN_LY,                   // Sun's position in equatorial coords (origin)
                yEq: 0,
                zEq: 0,
                pmx: 0,
                pmy: 0,
                pmz: 0,
                // Properties
                distEstimated: false,
		radius: 1.0,
                tc: 52,  // G2V
                lc: 5,
		temp: 5.8,
		mass: 1.0,
		planets: 8,
		cl: 'Sol',
		fe: 0.0122
            };
            data.push(sunStar);

            // Expected format from stars.dat:
            //      id | mag | dist | ra | dec | pmra | pmdec | rv | temp | Tc | Lc | Classes | [Fe/H] | age
            // Idx: 0    1     2      3    4     5      6       7    8      9    10   11        12       13 

	   // distEstimated flag is now redundant, as we only used stars with parallax; maybe keep for future extension with remote stars

            for (const line of lines) {
                // Skip comments and empty lines
                if (line.startsWith('#') || line.trim() === '') continue;
                
                const fields = line.split('|');
                if (fields.length < 13) continue;
                
                const hip = parseInt(fields[0]);
                const hpmag = parseFloat(fields[1]);
                const distPc = parseFloat(fields[2]);  // Distance in parsecs
                const raDeg = parseFloat(fields[3]);
                const decDeg = parseFloat(fields[4]);
                const pmra = parseFloat(fields[5]);	//proper motion RA*cos(DE) in mas/yr
                const pmde = parseFloat(fields[6]);	//proper motion DE in mas/yr
                const rv = parseInt(fields[7]);		//radial velocity in km/s
                const tempK = parseInt(fields[8]);       // Temperature
                const tc = parseInt(fields[9]);       // Temperature class
                const lc = parseInt(fields[10]);       // Luminosity class
 		const cl = fields[11];			// SIMBAD classes ('**': double star etc.)
                const fe = parseInt(fields[12]);	// "iron" content
		const age = parseInt(fields[13]);	// stellar age in Gyr

		if (!(distPc > 0) && !(lc > 0)) continue; // no way of estimating distance
	               
                // Skip invalid entries
                if (isNaN(hip) || isNaN(hpmag) || isNaN(raDeg) || isNaN(decDeg)) continue;
                
                // Position on celestial sphere (for rendering as dots)
                const pos = raDecToXYZ(raDeg, decDeg);
                
                // Distance and 3D position
                let distLy;
                let distEstimated = false;
                let radius = 0;

		const estTemp = isNaN(tempK)? estimateTemperature(tc) : tempK;

		// there are entries with negative distance in the catalogue! E.g. id 5342349088962993792 = HD 102115
		// these are extremely remote stars where GAIA comes up with no measurable parallax, so 50% chance raw parallax shows up negative.

		const est_dist = (distPc>0)? distPc * 3.26156 : Math.min(25000,Math.max(15,estimateDistance(hpmag, estTemp, lc)));
		const est_radius = estimateRadius(hpmag, estTemp, est_dist);
		
                if (!isNaN(distPc) && distPc > 0) {
                    // Use catalogue distance
                    distLy = distPc * 3.26156; // PC_TO_LY 
                    radius = est_radius;
                    //most distant in catalogue: HIP 52558 at 8117 ly
		    //if(distLy > 7000) {console.log(`very distant HIP ${hip}: ${Math.floor(distLy)} ly`);} 
                    if(lc ==5 && !isNaN(est_dist) && est_dist > 0){
		        distErr = (distErr*distCount+((distLy-est_dist)/distLy))/(distCount+1);
            	        distErrSq = (distErrSq*distCount+Math.pow(Math.abs((distLy-est_dist)/distLy),2))/(distCount+1);
		        distCount++;
		        if(distLy > 40 * est_dist || est_dist > 40*distLy){
		            console.log(`Distance mismatch HIP ${hip} est. ${Math.floor(est_dist)}, data ${Math.floor(distLy)}`);
		        }
		    }
                } else {
                    // Estimate distance from magnitude and spectral type
                    missingDistCount++;
                    distLy = est_dist;
                    radius = est_radius;
                    distEstimated = true;
                    //if(est_dist == 100){console.log(`Dist 100 ly: HIP ${hip}, mag ${hpmag}, temp ${tempK}, lc ${lc}}`);}
                }
               
               if(distLy<0){console.log("Warning: negative distance " + distLy + " for id " + hip);} 
                // Calculate XYZ (either from catalogue or estimated distance)
               const xyz = raDecDistToXYZ_equatorial(raDeg, decDeg, distLy);
               const xEq = xyz.x;
               const yEq = xyz.y;
               const zEq = xyz.z; 
		//proper motion
		const [pmx,pmy,pmz] = properMotion3d(raDeg, decDeg, distLy, pmra, pmde, rv);
		const absmag = (hpmag - (5*Math.log10(distLy/3.26156) - 5));

                data.push({
                    hip: hip,
                    mag: hpmag,
                    M: absmag,
                    ra: raDeg,
                    dec: decDeg,
                    dist: distLy,           // Distance in light-years
                    distEstimated: distEstimated,  // Flag if distance was estimated
		    radius: radius, // radius (always estimated)
                    xEq: xEq,               // Equatorial 3D position in ly
                    yEq: yEq,
                    zEq: zEq,
                    tc: isNaN(tc) ? -1 : tc,  // Temperature class, -1 for missing
                    lc: isNaN(lc) ? -1 : lc,  // Luminosity class, -1 for missing
		    temp: estTemp/1000,	// Temperature in kK
                    // Celestial sphere position (always valid)
                    x: pos.x,
                    y: pos.y,
                    z: pos.z,
                    pmx: pmz,
                    pmy: pmy,
                    pmz: pmx,
                    // Baseline values for position updates
                    mag0: hpmag,            // Reference magnitude at dist0
                    dist0: distLy,          // Reference distance
		    planets: (EXODATA[hip]? EXODATA[hip].length : null),
		    cl: cl,
		    fe: fe
                });
            }
            console.log(`Number of stars: ${data.length}`);            
            console.log(`Stars missing distance information: ${missingDistCount} (${(100*missingDistCount/data.length).toFixed(1)}%)`);
            console.log(`Distance estimate verified for ${distCount} items, avg error ${distErr}, sd ${Math.sqrt(distErrSq)}`);
            return data;
        }

function properMotion3d(ra, dec, dist, pmra, pmde, vr) {
    const ra_r  = ra  * Math.PI / 180;
    const dec_r = dec * Math.PI / 180;
    
    const cosDec = Math.cos(dec_r), sinDec = Math.sin(dec_r);
    const cosRA  = Math.cos(ra_r),  sinRA  = Math.sin(ra_r);

    const rHat = [ cosDec*cosRA,   cosDec*sinRA,   sinDec          ];
    const aHat = [      -sinRA,         cosRA,      0               ];
    const dHat = [-sinDec*cosRA,  -sinDec*sinRA,    cosDec          ];

    const vr_ly_day = vr * 5.7755e-4 / 63241.1;

    // mas/yr × ly → ly/day:  4.84814e-9 rad/mas / 365.25 day/yr × dist[ly] = 1.32739e-11 × dist
    const PM_FACTOR = 1.32739e-11;
    const vPMra = pmra * dist * PM_FACTOR;
    const vPMde = pmde * dist * PM_FACTOR;

    return [
        vr_ly_day * rHat[0] + vPMra * aHat[0] + vPMde * dHat[0],
        vr_ly_day * rHat[1] + vPMra * aHat[1] + vPMde * dHat[1],
        vr_ly_day * rHat[2] + vPMra * aHat[2] + vPMde * dHat[2],
    ];
}

        // Parse star name mapping file (HIP|Designation|CommonName format)
        // Builds bidirectional lookups: nameToHip and hipToNames
        function parseNameMap(text) {
            nameToHip = {};
            hipToNames = {};
            
            const lines = text.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('#') || line.trim() === '') continue;
                
                const parts = line.split('|');
                if (parts.length >= 2) {
                    const hip = parseInt(parts[0]);
                    const designation = parts[1].trim();  // e.g., "Alpha UMi"
                    const commonName = parts.length > 2 ? parts[2].trim() : '';
                    
                    if (!isNaN(hip)) {
                        // Forward lookup: name -> HIP
                        if (designation) {
                            nameToHip[designation] = hip;
                        }
                        if (commonName) {
                            nameToHip[commonName] = hip;
                        }
                        
                        // Reverse lookup: HIP -> names
                        hipToNames[hip] = {
                            designation: designation || null,
                            commonName: commonName || null
                        };
                    }
                }
            }
            
            return Object.keys(hipToNames).length;
        }

        // Build HIP lookup map from star data
        export function buildHipLookup() {
            hipToStar = {};
            for (const star of starData) {
                hipToStar[star.hip] = star;
            }
        }

        // Convert RA/Dec to 3D cartesian coordinates on unit sphere
        function raDecToXYZ(raDeg, decDeg, radius = 100) {
            const ra = raDeg * Math.PI / 180;
            const dec = decDeg * Math.PI / 180;
            
            // Standard astronomical convention
            const x = radius * Math.cos(dec) * Math.cos(ra);
            const y = radius * Math.sin(dec);
            const z = -radius * Math.cos(dec) * Math.sin(ra);
            
            return { x, y, z };
        }

        // Convert RA/Dec/Distance to equatorial-aligned cartesian coordinates
        // X: toward RA=0, Dec=0 (vernal equinox)
        // Y: toward RA=90°, Dec=0
        // Z: toward Dec=+90° (north celestial pole)
        function raDecDistToXYZ_equatorial(raDeg, decDeg, distLy) {
            const ra = raDeg * Math.PI / 180;
            const dec = decDeg * Math.PI / 180;
            return {
                x: distLy * Math.cos(dec) * Math.cos(ra),
                y: distLy * Math.cos(dec) * Math.sin(ra),
                z: distLy * Math.sin(dec)
            };
        }

///////////
// SRT 

//Attention: temperature interpolation may be done in the linear or in the log scale, 
// check which is better and make sure the same method is used everywhere

function applyAberration(dir, beta, velocityDir) {
    // dir should be normalized
    const cosAlpha = dir.dot(velocityDir);
    const denom = 1.0 + beta * cosAlpha;
    const cosAlphaPrime = (cosAlpha + beta) / denom;
    
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
    const sinAlphaPrime = Math.sqrt(Math.max(0, 1 - cosAlphaPrime * cosAlphaPrime));
    
    if (sinAlpha < 1e-6) {
        return velocityDir.clone().multiplyScalar(Math.sign(cosAlphaPrime));
    }
    
    const parallel = velocityDir.clone().multiplyScalar(cosAlpha);
    const perp = dir.clone().sub(parallel);
    const scale = sinAlphaPrime / sinAlpha;
    
    return velocityDir.clone().multiplyScalar(cosAlphaPrime).add(perp.multiplyScalar(scale));
}

////////////////////

const TEMP_LOG_POINTS = [0, 0.833, 1.361, 1.668, 1.792, 1.988, 2.303, 3.497, 4.605];
const TEMP_COLORS = [
    {r: 0.251, g: 0.000, b: 0.000},  // 1 kK
    {r: 1.000, g: 0.404, b: 0.129},  // 2.3 kK
    {r: 1.000, g: 0.784, b: 0.529},  // 3.9 kK
    {r: 0.973, g: 1.000, b: 0.914},  // 5.3 kK
    {r: 0.894, g: 0.996, b: 1.000},  // 6 kK
    {r: 0.706, g: 0.878, b: 1.000},  // 7.3 kK
    {r: 0.529, g: 0.753, b: 1.000},  // 10 kK
    {r: 0.337, g: 0.592, b: 1.000},  // 33 kK
    {r: 0.298, g: 0.545, b: 0.973}   // 100 kK
];
const VISIBLE_FRACTIONS = [6e-6, 0.03, 0.24, 0.39, 0.42, 0.43, 0.35, 0.035, 0.0017];

export function temperatureToRGB(tempKK) {
    const t = Math.max(1.0, Math.min(100.0, tempKK));
    const logT = Math.log(t);
    
    for (let i = 0; i < TEMP_LOG_POINTS.length - 1; i++) {
        if (logT < TEMP_LOG_POINTS[i + 1]) {
            const frac = (logT - TEMP_LOG_POINTS[i]) / (TEMP_LOG_POINTS[i + 1] - TEMP_LOG_POINTS[i]);
            return {
                r: TEMP_COLORS[i].r + frac * (TEMP_COLORS[i + 1].r - TEMP_COLORS[i].r),
                g: TEMP_COLORS[i].g + frac * (TEMP_COLORS[i + 1].g - TEMP_COLORS[i].g),
                b: TEMP_COLORS[i].b + frac * (TEMP_COLORS[i + 1].b - TEMP_COLORS[i].b)
            };
        }
    }
    return TEMP_COLORS[TEMP_COLORS.length - 1];
}

export function visibleFraction(tempKK) {
    const t = Math.max(1.0, Math.min(100.0, tempKK));
    const logT = Math.log(t);
    
    for (let i = 0; i < TEMP_LOG_POINTS.length - 1; i++) {
        if (logT < TEMP_LOG_POINTS[i + 1]) {
            const frac = (logT - TEMP_LOG_POINTS[i]) / (TEMP_LOG_POINTS[i + 1] - TEMP_LOG_POINTS[i]);
            return VISIBLE_FRACTIONS[i] + frac * (VISIBLE_FRACTIONS[i + 1] - VISIBLE_FRACTIONS[i]);
        }
    }
    return VISIBLE_FRACTIONS[VISIBLE_FRACTIONS.length - 1];
}

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function aberratePosition(pos, beta, vdir) {
    if(Math.abs(beta) < 1e-10){return pos;}
    const radius = pos.length();
    const dir = pos.clone().normalize();
    const cosAlpha = dir.dot(vdir);
    const denom = 1.0 + beta * cosAlpha;
    const cosAlphaPrime = (cosAlpha + beta) / denom;
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
    const sinAlphaPrime = Math.sqrt(Math.max(0, 1 - cosAlphaPrime * cosAlphaPrime));

    let newDir;
    if (sinAlpha < 1e-6) {
        newDir = vdir.clone().multiplyScalar(Math.sign(cosAlphaPrime));
    } else {
        const perp = dir.clone().addScaledVector(vdir, -cosAlpha);
        newDir = vdir.clone().multiplyScalar(cosAlphaPrime)
                            .addScaledVector(perp, sinAlphaPrime / sinAlpha);
    }
    return newDir.multiplyScalar(radius);
}

function dopplerFactor(dir) {
    // cosAlpha: angle between velocity and direction TO observer (i.e. -dir)
    const cosAlpha = -dir.dot(velocityDir);
    return 1.0 / (gamma * (1.0 - beta * cosAlpha));
}

//this is for stellar proper motion to correct [gamma, velocityDir] values passed to shader.
// this may be a completely negligible effect in most if not all cases; to be tested.
export function AddStellarVelocity(gamma, velocityDir, pmx, pmy, pmz) {
    // Convert PM: equatorial ly/day → Three.js coords, units of c
    // Axis map from relY=yEq+coarse.z, relZ=zEq-coarse.y:
    // equatorial (x,y,z) → threejs (x, z, -y)
    const C_LY_DAY = 1 / 365.2425;  // ly/day per c
    const u = {
        x:  pmx / C_LY_DAY,
        y:  pmz / C_LY_DAY,   // equatorial z → threejs y
        z: -pmy / C_LY_DAY,   // equatorial y → threejs z (negated)
    };

    const u2 = u.x*u.x + u.y*u.y + u.z*u.z;
    if (u2 < 1e-10) return [gamma, velocityDir];  // negligible stellar motion beta<1e-5 = 3km/s

    // Ship velocity vector in Sol frame, units of c
    const beta = Math.sqrt(1 - 1/(gamma*gamma));
    const v = {
        x: velocityDir.x * beta,
        y: velocityDir.y * beta,
        z: velocityDir.z * beta,
    };

    // 3D relativistic subtraction: ship velocity in stellar rest frame
    // v'_par = (v_par - u) / (1 - v·u)
    // v'_perp = v_perp / (gamma_u * (1 - v·u))
    const gamma_u = 1 / Math.sqrt(1 - u2);
    const vDotU   = v.x*u.x + v.y*u.y + v.z*u.z;
    const denom   = 1 - vDotU;
    const f       = vDotU / u2;  // (v·u)/|u|², for decomposing parallel component

    const vp = {
        x: (v.x - u.x - f*u.x*(1 - 1/gamma_u)) / (gamma_u * denom),
        y: (v.y - u.y - f*u.y*(1 - 1/gamma_u)) / (gamma_u * denom),
        z: (v.z - u.z - f*u.z*(1 - 1/gamma_u)) / (gamma_u * denom),
    };

    const beta2p = vp.x*vp.x + vp.y*vp.y + vp.z*vp.z;
    const gammaPrime = 1 / Math.sqrt(1 - beta2p);
    const betaPrime  = Math.sqrt(beta2p);

    const vDirPrime = betaPrime > 1e-10
        ? { x: vp.x/betaPrime, y: vp.y/betaPrime, z: vp.z/betaPrime }
        : { x: 0, y: 0, z: 1 };  // arbitrary if essentially at rest

    return [gammaPrime, vDirPrime];
}

///////////////////////////
// planetary orbits (ephemerides)


//0 a: semi-major axis in AU
//1 e: eccentricity
//2 i_deg: inclination in degrees
//3 Omega_deg: longitude of ascending node in degrees
//4 w_deg_J2000: argument of perihelion in degrees
//5 t_period: orbital period in days
//6 time_of_perihelion : in days after 1 Jan 2000 00:00:00 UTC (JDAY 2451545)
//7  prec_rate_node
//8 prec_rate_perih: perihelion precession in radians per day (prograde, 8.6e-7 rad/day ~= 1.8 deg/century)
//9 abs magnitude
//10 r/r_E  (1rE = 4.26e-5 AU)

//note: partially duplicates SOL_SYSTEM defined above
export const ORBITS = {
  "Mercury": [0.387098, 0.20563, 7.005, 48.331, 29.124, 87.9691, 45.3, 0, 7.62e-8, -0.60, 0.3829], // 575'' per century
  "Venus": [0.723332, 0.006772, 3.39458, 76.68, 54.884, 224.701, 193.7, 0, 2.71e-8, -5.18, 0.950], // 204''
  "Earth": [1, 0.0167086, 0.00005, -11.26064, 114.20783, 365.256363004, 3.05331, 0, 1.57e-7, -3.99, 1], // 1145''
  "Mars": [1.52368055, 0.0934, 1.85, 49.57854, 286.5, 686.980, 650.2, 0, 2.161e-7, -1.52, 0.532], // 1628'' 
  "Jupiter": [5.4570, 0.0489, 1.303, 100.464, 273.867, 4332.59, 4088.4, 0, 8.69e-8, -9.40, 10.97], // 655''
  "Saturn": [9.5826, 0.0565, 2.485, 113.665, 339.392, 10755.70, 1302, 0, 2.588e-7, -9.7, 9.14], // 1950''
  "Uranus": [19.19126, 0.04717, 0.773, 74.006, 96.998857, 30688.5, 18492, 0, 4.43e-8, -7.19, 3.98], // 334''
  "Neptune": [30.07, 0.008678, 1.770, 131.783, 273.187, 60195, 15587, 0, 4.78e-9, -6.87, 3.86], // 36''
  "Pluto": [39.482, 0.2488, 17.16, 110.299, 113.834, 90560, -3767, 0, 5.8e-7, -0.44, 0.187], // see below
  "Eris": [67.69, 0.44, 44.18, 36.02, 151.66, 203915, 94207, 0, 0, -1.2, 0.183],
  "Ceres": [2.77, 0.116, 9.65, 80.7, 73.3, 1681.458, 0, -7.86e-7, 7.18e-7, 3.3, 0.0737]
};
//Pluto: The argument of perihelion oscillates with an amplitude of about 23° to 38° around 90°, preventing close encounters with Neptune and ensuring long-term orbital stability. While the argument of perihelion librates, the perihelion itself moves forward (precesses) at a slow rate, approximately 3 degrees per orbital cycle (248 years) [5.8e-7 rad/day].

function meanAnomaly(orbit, days) {
    const [a, e, i_deg, Omega_deg, w_deg_J2000, t_period, t_perihel,
           prec_node, prec_perih, mabs, rE] = orbit;
    const n_anom = 2 * Math.PI / t_period - prec_perih - prec_node;
    const dt = days - t_perihel;
    const M  = (n_anom * dt) % (2 * Math.PI);
    return M < 0 ? M + 2 * Math.PI : M;
}

function eccentricAnomaly(orbit, M, tol = 5e-6) { // 1'' = 4.8e-6 
    const [a, e, i_deg, Omega_deg, w_deg_J2000, t_period, t_perihel, prec_node, prec_perih, mabs, rE] = orbit;
    // Solve Kepler's equation M = E - e*sin(E) via Newton-Raphson
    // Good initial guess: E ≈ M for small e, with first-order correction
    let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
    let i = null;
    let dE = null;
    for (i = 0; i < 3; i++) { // max 3 iterations, enough for accuracy 1e-10 
        dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
        E += dE;
        if (Math.abs(dE) < tol) break;
    }
    return [E, dE];
}

function ellipticOrbit(orbit, E, days = 0, parent_i_deg = 0, parent_Omega_deg = 0) {
   const [a, e, i_deg, Omega_deg, w_deg_J2000, t_period, t_perihel, prec_node, prec_perih, mabs, rE] = orbit;
    
    const i     = i_deg * Math.PI / 180;
    const w     = w_deg_J2000 * Math.PI / 180 + prec_perih * days;
    const Omega = Omega_deg   * Math.PI / 180 + prec_node  * days;
    const b     = a * Math.sqrt(1 - e * e);

    let x = a * (Math.cos(E) - e);
    let y = b * Math.sin(E);

    // 1. Rotate by argument of perihelion (ω)
    let x1 = x * Math.cos(w) - y * Math.sin(w);
    let y1 = x * Math.sin(w) + y * Math.cos(w);

    // 2. Rotate by inclination (i) around x-axis
    let x2 = x1;
    let y2 = y1 * Math.cos(i);
    let z2 = y1 * Math.sin(i);

    // 3. Rotate by ascending node (Ω) around z-axis
    let x3 = x2 * Math.cos(Omega) - y2 * Math.sin(Omega);
    let y3 = x2 * Math.sin(Omega) + y2 * Math.cos(Omega);
    let z3 = z2;

    // 4a. Lift from parent orbital plane to ecliptic (skip for planets)
    let x5 = x3, y5 = y3, z5 = z3;
    if (parent_i_deg !== 0) {
        const pi  = parent_i_deg     * Math.PI / 180;
        const pOm = parent_Omega_deg * Math.PI / 180;

        const x4 = x3;
        const y4 = y3 * Math.cos(pi) - z3 * Math.sin(pi);
        const z4 = y3 * Math.sin(pi) + z3 * Math.cos(pi);

        x5 = x4 * Math.cos(pOm) - y4 * Math.sin(pOm);
        y5 = x4 * Math.sin(pOm) + y4 * Math.cos(pOm);
        z5 = z4;
    }

    // 4b. Ecliptic to equatorial
    const eps = ECLIPTIC_OBLIQUITY - Math.PI / 2;
    return {
        x: x5,
        y: y5 * Math.cos(eps) - z5 * Math.sin(eps),
        z: y5 * Math.sin(eps) + z5 * Math.cos(eps)
    };
}

export function orbitAtTime(orbit, days, parent_i_deg = 0, parent_Omega_deg = 0) {
    const M = meanAnomaly(orbit, days);
    const [E,err] = eccentricAnomaly(orbit, M);
    return ellipticOrbit(orbit, E, days, parent_i_deg, parent_Omega_deg);   // <-- pass t_days through for perihelion precession
}

/*
To improve accuracy, the highest-priority fix would be replacing the fixed e to represent secular drift in eccentricity.
For Earth eccentricity varies on the ~100,000-year Milankovitch cycle between nearly 0 and ~0.058, driven by Jupiter and Venus. The current rate of change is roughly 4×10⁻⁵ per century (currently decreasing). This is systematic and cumulative over the ~100ka timescale (but periodic over the Ma timescale), unlike the oscillatory Jupiter/Venus perturbations which average out over time.
*/

// BINARY/MULTIPLE SYSTEMS

// ── Binary system initialization ──────────────────────────────────────────────
// Call once after starData is fully loaded.
// Overwrites pmx/pmy/pmz for every star that belongs to a binary/multiple system
// so that all members move with the center-of-mass proper motion of their system.
// Their ra/dec/dist (J2000 catalogue position) are left untouched.

const BINARY_SYSTEMS = {
  104214: {
    com: {
      ra: 316.727424, dec: 38.745838,
      dist: 3.4897,
      pmra: 4135.926, pmdec: 3204.112,
      rv: -65.300,
    },
    members: ['104214', '104217'],
    pair: {
      ids: ['104214', '104217'],
      period_yr: 1047.91,
      quaternion: [0.800253, -0.199718, 0.403576, -0.396023],
      r:    [52.1008, 55.1625],
      phi0: [2.981634, -0.159959],
    },
  },
  12189: {
    com: {
      ra: 39.246831, dec: 24.647606,
      dist: 41.2717,
      pmra: 138.756, pmdec: -13.127,
      rv: 19.011,
    },
    members: ['12189', '12184'],
    pair: {
      ids: ['12189', '12184'],
      period_yr: 39099.85,
      quaternion: [-0.764604, -0.169764, 0.223768, 0.580077],
      r:    [724.0811, 842.5826],
      phi0: [-0.591530, 2.550063],
    },
  },
  22531: {
    com: {
      ra: 72.732889, dec: -53.460797,
      dist: 37.5798,
      pmra: -90.798, pmdec: 84.052,
      rv: 17.263,
    },
    members: ['22531', '22534'],
    pair: {
      ids: ['22531', '22534'],
      period_yr: 6096.64,
      quaternion: [-0.439879, 0.092986, -0.045852, 0.892052],
      r:    [214.3788, 260.2518],
      phi0: [-1.751098, 1.390495],
    },
  },
  26224: {
    com: {
      ra: 83.818829, dec: -5.387500,
      dist: 621.9100,
      pmra: -0.920, pmdec: 0.130,
      rv: 29.666,
    },
    members: ['26224', '26220'],
    pair: {
      ids: ['26224', '26220'],
      period_yr: 330369.76,
      quaternion: [0.998385, 0.001341, 0.026700, 0.050130],
      r:    [6324.6815, 6476.2614],
      phi0: [-3.034035, 0.107558],
    },
  },
  30419: {
    com: {
      ra: 95.942620, dec: 4.593953,
      dist: 37.3003,
      pmra: -16.462, pmdec: 5.179,
      rv: 13.059,
    },
    members: ['30419', '30422'],
    pair: {
      ids: ['30419', '30422'],
      period_yr: 5407.07,
      quaternion: [-0.053907, 0.523800, -0.033239, 0.849484],
      r:    [164.2218, 294.3839],
      phi0: [1.796478, -1.345115],
    },
  },
  19849: {
    com: {
      ra: 63.827186, dec: -7.654087,
      dist: 4.9944,
      pmra: -2243.081, pmdec: -3416.742,
      rv: -43.142,
    },
    members: ['19849', '3195919254111314816'],
    pair: {
      ids: ['19849', '3195919254111314816'],
      period_yr: 6795.04,
      quaternion: [0.961269, 0.014380, -0.270447, -0.051113],
      r:    [165.2503, 225.7048],
      phi0: [2.040862, -1.100731],
    },
  },
  3821: {
    com: {
      ra: 12.271394, dec: 57.817022,
      dist: 5.9415,
      pmra: 1108.125, pmdec: -526.160,
      rv: 9.141,
    },
    members: ['3821', '425040000962497792'],
    pair: {
      ids: ['3821', '425040000962497792'],
      period_yr: 114.21,
      quaternion: [-0.793913, 0.070355, -0.093616, 0.596648],
      r:    [10.2618, 17.4242],
      phi0: [-1.000096, 2.141497],
    },
  },
  1475: {
    com: {
      ra: 4.601927, dec: 44.025260,
      dist: 3.5755,
      pmra: 2876.108, pmdec: 371.369,
      rv: 10.957,
    },
    members: ['1475', '385334196532776576'],
    pair: {
      ids: ['1475', '385334196532776576'],
      period_yr: 1434.42,
      quaternion: [0.536739, -0.136637, -0.088585, 0.827885],
      r:    [67.7036, 58.4644],
      phi0: [0.698752, -2.442841],
    },
  },
  43103: {
    com: {
      ra: 131.671613, dec: 28.761671,
      dist: 95.7055,
      pmra: -22.301, pmdec: -44.615,
      rv: 14.483,
    },
    members: ['43103', '43100'],
    pair: {
      ids: ['43103', '43100'],
      period_yr: 61412.40,
      quaternion: [0.844214, -0.147254, -0.423729, 0.293381],
      r:    [979.7499, 1867.3718],
      phi0: [-2.924515, 0.217078],
    },
  },
  5131: {
    com: {
      ra: 16.422056, dec: 21.469518,
      dist: 84.7373,
      pmra: 56.764, pmdec: -17.360,
      rv: -7.121,
    },
    members: ['5131', '5132'],
    pair: {
      ids: ['5131', '5132'],
      period_yr: 54146.69,
      quaternion: [0.907342, 0.082873, 0.213180, 0.352727],
      r:    [1195.0735, 1315.6034],
      phi0: [-3.095410, 0.046183],
    },
  },
  5140693571158739840: {
    com: {
      ra: 24.756265, dec: -17.950506,
      dist: 2.6982,
      pmra: 3285.052, pmdec: 563.640,
      rv: 16.020,
    },
    members: ['5140693571158739840', '5140693571158946048'],
    pair: {
      ids: ['5140693571158739840', '5140693571158946048'],
      period_yr: 36.93,
      quaternion: [-0.118826, 0.115575, -0.013927, 0.986067],
      r:    [5.2896, 5.6111],
      phi0: [0.477183, -2.664409],
    },
  },
  5141: {
    com: {
      ra: 16.459289, dec: 4.908834,
      dist: 41.6483,
      pmra: 29.797, pmdec: -122.222,
      rv: -7.408,
    },
    members: ['5141', '5144'],
    pair: {
      ids: ['5141', '5144'],
      period_yr: 32392.47,
      quaternion: [0.993570, 0.006252, 0.069943, 0.088813],
      r:    [629.0357, 755.8117],
      phi0: [2.873090, -0.268503],
    },
  },
  71683: {
    com: {
      ra: 219.799675, dec: -60.924387,
      dist: 1.3472,
      pmra: -3650.695, pmdec: 691.248,
      rv: -20.260,
    },
    members: ['71683', '71681', '70890'],
    pair: {
      ids: ['71683', '71681'],
      period_yr: 94.47,
      quaternion: [-0.264919, -0.339353, 0.100224, 0.897002],
      r:    [11.2527, 14.4963],
      phi0: [-1.807659, 1.333934],
    },
    satellites: [
      { id: '70890',
        period_yr: 979938.39,
        quaternion: [0.707023, 0.292573, 0.440821, 0.469251],
        r: 9557.1522, phi0: 0.076148 },
    ],
  },
  73184: {
    com: {
      ra: 224.363898, dec: -21.412906,
      dist: 5.8304,
      pmra: 1009.072, pmdec: -1708.903,
      rv: 29.604,
    },
    members: ['73184', '73182'],
    pair: {
      ids: ['73184', '73182'],
      period_yr: 3755.86,
      quaternion: [0.346777, 0.099646, 0.037080, 0.931902],
      r:    [76.4347, 161.3823],
      phi0: [-2.283378, 0.858215],
    },
  },
  54211: {
    com: {
      ra: 166.373917, dec: 43.524189,
      dist: 4.8782,
      pmra: -4372.916, pmdec: 949.696,
      rv: 68.173,
    },
    members: ['54211', '778947608243864320'],
    pair: {
      ids: ['54211', '778947608243864320'],
      period_yr: 1980.79,
      quaternion: [-0.527193, 0.221601, -0.144680, 0.807483],
      r:    [76.6280, 75.5152],
      phi0: [0.594589, -2.547004],
    },
  },
  84405: {
    com: {
      ra: 258.894531, dec: -26.586596,
      dist: 5.9486,
      pmra: -481.319, pmdec: -1139.652,
      rv: 0.041,
    },
    members: ['84405', '4109030160308320128', '84478'],
    pair: {
      ids: ['84405', '4109030160308320128'],
      period_yr: 302.74,
      quaternion: [0.958574, -0.041356, 0.205084, -0.193301],
      r:    [26.7037, 26.7622],
      phi0: [-1.371006, 1.770587],
    },
    satellites: [
      { id: '84478',
        period_yr: 237510.62,
        quaternion: [0.979192, 0.017302, -0.178548, -0.094887],
        r: 2529.9744, phi0: 1.271804 },
    ],
  },
  84626: {
    com: {
      ra: 259.502705, dec: -24.285735,
      dist: 92.5220,
      pmra: -56.720, pmdec: -9.950,
      rv: -28.599,
    },
    members: ['84626', '84625'],
    pair: {
      ids: ['84626', '84625'],
      period_yr: 13131.05,
      quaternion: [0.885019, -0.043708, 0.455658, -0.084894],
      r:    [393.1893, 546.1104],
      phi0: [-1.280701, 1.860892],
    },
  },
  86614: {
    com: {
      ra: 265.487159, dec: 72.152640,
      dist: 22.9296,
      pmra: 62.715, pmdec: -274.133,
      rv: -6.371,
    },
    members: ['86614', '86620'],
    pair: {
      ids: ['86614', '86620'],
      period_yr: 12363.87,
      quaternion: [0.803141, 0.013218, 0.017830, 0.595376],
      r:    [324.3498, 424.4446],
      phi0: [-1.552183, 1.589410],
    },
  },
  4468557611984384512: {
    com: {
      ra: 271.363736, dec: 2.500589,
      dist: 5.0998,
      pmra: 265.966, pmdec: -1091.130,
      rv: -7.171,
    },
    members: ['4468557611984384512', '88601', '4468557611977674496'],
    pair: {
      ids: ['4468557611984384512', '88601'],
      period_yr: 206.79,
      quaternion: [0.987163, 0.002345, 0.159031, 0.014555],
      r:    [19.9678, 22.1858],
      phi0: [1.545326, -1.596266],
    },
    satellites: [
      { id: '4468557611977674496',
        period_yr: 113.73,
        quaternion: [0.985757, 0.004532, 0.165943, 0.026923],
        r: 15.7641, phi0: -1.583910 },
    ],
  },
  91768: {
    com: {
      ra: 280.694941, dec: 59.628895,
      dist: 3.5190,
      pmra: -1349.294, pmdec: 1822.133,
      rv: -0.374,
    },
    members: ['91768', '91772'],
    pair: {
      ids: ['91768', '91772'],
      period_yr: 385.55,
      quaternion: [-0.501789, 0.005912, -0.003430, 0.864963],
      r:    [19.0326, 25.7891],
      phi0: [-1.477311, 1.664282],
    },
  },
  97966: {
    com: {
      ra: 298.657647, dec: -8.231658,
      dist: 150.5143,
      pmra: 7.218, pmdec: -25.827,
      rv: -5.545,
    },
    members: ['97966', '97967'],
    pair: {
      ids: ['97966', '97967'],
      period_yr: 158638.36,
      quaternion: [0.619942, -0.353935, -0.368449, 0.595523],
      r:    [2442.8221, 2930.2494],
      phi0: [3.029436, -0.112156],
    },
  },
};

// ── Binary system initialization ──────────────────────────────────────────────
// Call once after starData is fully loaded.
// Overwrites pmx/pmy/pmz for every star that belongs to a binary/multiple system
// so that all members move with the center-of-mass proper motion of their system.
// Their ra/dec/dist (J2000 catalogue position) are left untouched.
// Also builds BINARY_MEMBER_MAP for O(1) lookup in getCurrentStarPosition.
 
export const BINARY_MEMBER_MAP = {};   // star.hip → {sys, pairIndex, satIndex, massIndex}

export function initBinarySystems() {

    // hip → star lookup
    const byHip = {};
    for (const star of Object.values(starData)) {
        if (star.hip != null) byHip[star.hip] = star;
    }
 
    for (const [primaryId, sys] of Object.entries(BINARY_SYSTEMS)) {
        const com = sys.com;
 
        // ── CoM position in equatorial Cartesian (light-years) ───────────────
        const ra  = com.ra  * Math.PI / 180;
        const dec = com.dec * Math.PI / 180;
        const d   = com.dist * PC_TO_LY;   // pc → ly
        const cx  = d * Math.cos(dec) * Math.cos(ra);
        const cy  = d * Math.cos(dec) * Math.sin(ra);
        const cz  = d * Math.sin(dec);
 
        // ── CoM velocity in equatorial Cartesian (ly/day) ────────────────────
        // properMotion3d returns ly/day already — compute once for all members
        const [cvx, cvy, cvz] = properMotion3d(
            com.ra, com.dec, d, com.pmra, com.pmdec, com.rv ?? 0
        );
 
        // ── Main pair ────────────────────────────────────────────────────────
        const pair  = sys.pair;
        const omega = 2 * Math.PI / (pair.period_yr * 365.2425);   // rad/day
 
        for (let i = 0; i < pair.ids.length; i++) {
            const hip  = +pair.ids[i];
            const star = byHip[hip];
            const r_ly = pair.r[i] / AU_PER_LY;
 
            BINARY_MEMBER_MAP[hip] = {
                com:  { x: cx, y: cy, z: cz, vx: cvx, vy: cvy, vz: cvz },
                r:    r_ly,
                phi0: pair.phi0[i],
                omega,
                quaternion: pair.quaternion,
            };
 
            if (star) { star.pmx = cvx; star.pmy = cvy; star.pmz = cvz; }
        }
 
        // ── Satellites ───────────────────────────────────────────────────────
        if (sys.satellites) {
            for (const sat of sys.satellites) {
                const hip    = +sat.id;
                const star   = byHip[hip];
                const omega_s = 2 * Math.PI / (sat.period_yr * 365.2425);
                const r_ly   = sat.r / AU_PER_LY;
 
                BINARY_MEMBER_MAP[hip] = {
                    com:  { x: cx, y: cy, z: cz, vx: cvx, vy: cvy, vz: cvz },
                    r:    r_ly,
                    phi0: sat.phi0,
                    omega: omega_s,
                    quaternion: sat.quaternion,
                };
 
                if (star) { star.pmx = cvx; star.pmy = cvy; star.pmz = cvz; }
            }
        }
    }
}


 
