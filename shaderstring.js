/*

three.js shader materials: 

1. star point: starVertexShaderString, starFragmentShaderString : lensflare, aberration on celestial sphere, doppler shift (black body, effective temperature),
2. star 3d mesh: starMeshVertexShaderString, starMeshFragmentShaderString : 3d calculation, with doppler shift (black body, effective temperature)
3. planet points: planetPointVertexString, planetPointFragmentString : 3d calculation, with doppler shift of both reflected light and proper temperature
4. planet 3d mesh: planetVertexString, planetFragmentString : 3d calculation, with doppler shift of both reflected light and proper temperature per-fragment

5. milky way: milkyWayVertexShaderString, milkyWayFragmentShaderString : special case of points with infrared component
6. deep sky: deepSkyVertexString, deepSkyFragmentString : aberration, beaming, plus draw ellipse in uv coordinates

7. constellation lines: lineShaderString : aberration on celestial sphere, no doppler shift (constellation lines) [could be collapsed with gridShaderString]
8. coordinate grids: gridShaderString : aberration on celestial sphere, no doppler shift (grid lines), allows opacity
9. orbital ellipses: localShaderString : 3d calculation (parallax), no doppler (for orbital ellipses)
10. 3d grid: spaceGridShaderString : 3d calculation, with dynamic fadeout distance and color calculation ('major' vs 'minor' grid lines)


getSpriteMaterial: standard THREE.SpriteMaterial with flare sprite for use with star 3d mesh

*/


/// tempLUT
// pre-calculated Planck radiation properties over temperature range:
// rgb color and "bolometric" fraction (percentage of radiated intensity falling into optical range)
// these values are extended by linear interpolation (on log(T), so exponential interpolation in T)
// and stored as a 256-entry (r,g,b,a) "texture" for quick lookup on the GPU

		//  1.0  2.3    3.9    5.3    6.0    7.3    10     33     100 kK
const LUT_LOGT = [0.0, 0.833, 1.361, 1.668, 1.792, 1.988, 2.303, 3.497, 4.605];
const LUT_COLORS  = [
         [0.251, 0.000, 0.000], [1.000, 0.404, 0.129],
         [1.000, 0.784, 0.529], [0.973, 1.000, 0.914],
         [0.894, 0.996, 1.000], [0.706, 0.878, 1.000],
         [0.529, 0.753, 1.000], [0.337, 0.592, 1.000],
         [0.298, 0.545, 0.973]
     ];
const LUT_FOPT = [1e-8, 6e-6, 0.03, 0.24, 0.39, 0.42, 0.43, 0.35, 0.035, 0.0017]; 

const tempLUT0 = buildTempLUT0();

function buildTempLUT0() {
     const LUT_SIZE  = 256;
     const LOG_T_MAX = Math.log(100); // 4.60517…
     const data      = new Float32Array(LUT_SIZE * 4); // RGBA float32


     for (let i = 0; i < LUT_SIZE; i++) {
         const logT = (i / (LUT_SIZE - 1)) * LOG_T_MAX;
         let seg = LUT_LOGT.length - 2;
         for (let j = 0; j < LUT_LOGT.length - 1; j++) {
             if (logT <= LUT_LOGT[j + 1]) { seg = j; break; }
         }
         const t = Math.min(1, Math.max(0, (logT - LUT_LOGT[seg]) / (LUT_LOGT[seg+1] - LUT_LOGT[seg])));
         const lerp = (a, b) => a + (b - a) * t;
         data[i*4+0] = lerp(LUT_COLORS[seg][0], LUT_COLORS[seg+1][0]);
         data[i*4+1] = lerp(LUT_COLORS[seg][1], LUT_COLORS[seg+1][1]);
         data[i*4+2] = lerp(LUT_COLORS[seg][2], LUT_COLORS[seg+1][2]);
         data[i*4+3] = lerp(LUT_FOPT[seg],   LUT_FOPT[seg+1]);
     }
     const tex = new THREE.DataTexture(data, LUT_SIZE, 1, THREE.RGBAFormat, THREE.FloatType);
     tex.magFilter = THREE.LinearFilter;
     tex.minFilter = THREE.LinearFilter;
     tex.needsUpdate = true;
     return tex;  // e.g. const tempLUT = buildTempLUT();
 }

//currently unused, allows looking up (r,g,b,a) for a given T on the javascript side
function evalTempLUT(tempKK) {

     const logT  = Math.log(Math.min(Math.max(tempKK, 1.0), 100.0));
     let seg = LUT_LOGT.length - 2;
     for (let j = 0; j < LUT_LOGT.length - 1; j++) {
         if (logT <= LUT_LOGT[j+1]) { seg = j; break; }
     }
     const t    = Math.min(1, Math.max(0, (logT - LUT_LOGT[seg]) / (LUT_LOGT[seg+1] - LUT_LOGT[seg])));
     const lerp = (a, b) => a + (b - a) * t;
     return {
         r:    lerp(LUT_COLORS[seg][0], LUT_COLORS[seg+1][0]),
         g:    lerp(LUT_COLORS[seg][1], LUT_COLORS[seg+1][1]),
         b:    lerp(LUT_COLORS[seg][2], LUT_COLORS[seg+1][2]),
         frac: lerp(LUT_FOPT[seg],   LUT_FOPT[seg+1]),
     };
 }


const tempLUT = buildTempLUT();

function buildTempLUT() {
     const LUT_SIZE  = 256;
     const LOG_T_MAX = Math.log(33);   // 3.497… — LUT upper bound (33 kK)
     const data      = new Float32Array(LUT_SIZE * 4); // RGBA float32

     for (let i = 0; i < LUT_SIZE; i++) {
         const logT = (i / (LUT_SIZE - 1)) * LOG_T_MAX;
         let seg = LUT_LOGT.length - 2;
         for (let j = 0; j < LUT_LOGT.length - 1; j++) {
             if (logT <= LUT_LOGT[j + 1]) { seg = j; break; }
         }
         const t = Math.min(1, Math.max(0, (logT - LUT_LOGT[seg]) / (LUT_LOGT[seg+1] - LUT_LOGT[seg])));
         const lerp = (a, b) => a + (b - a) * t;
         data[i*4+0] = lerp(LUT_COLORS[seg][0], LUT_COLORS[seg+1][0]);
         data[i*4+1] = lerp(LUT_COLORS[seg][1], LUT_COLORS[seg+1][1]);
         data[i*4+2] = lerp(LUT_COLORS[seg][2], LUT_COLORS[seg+1][2]);
         data[i*4+3] = lerp(LUT_FOPT[seg],      LUT_FOPT[seg+1]);
     }
     const tex = new THREE.DataTexture(data, LUT_SIZE, 1, THREE.RGBAFormat, THREE.FloatType);
     tex.magFilter = THREE.LinearFilter;
     tex.minFilter = THREE.LinearFilter;
     tex.needsUpdate = true;
     return tex;
 }

// JS mirror of GLSL tempLookup — operates on raw LUT arrays, no texture sampling.
// Returns {r, g, b, a} matching the GLSL vec4 exactly.
export function tempLookupJS(tempKK) {
    const logT = Math.log(Math.max(tempKK, 1e-4));
    const LOG_T_LUT_MAX = 3.497;
 
    // Blackout: fade dark-red and fopt uniformly to zero as logT → -0.5
    if (logT < 0.0) {
        const x = Math.max(0.0, Math.min(1.0, (logT + 0.5) / 0.5)); // linear ramp
        const s = x * x * (3.0 - 2.0 * x);                          // smoothstep
        return { r: 0.251 * s, g: 0.0, b: 0.0, a: 1e-8 * s };
    }
 
    // Whiteout extrapolation: linear continuation of 33 kK → 100 kK slope
    if (logT > LOG_T_LUT_MAX) {
        const t = (logT - 3.497) / (4.605 - 3.497);
        const lerp = (a, b) => a + (b - a) * t;
        return {
            r: lerp(0.337, 0.298),
            g: lerp(0.592, 0.545),
            b: lerp(1.000, 0.973),
            a: Math.max(lerp(0.35, 0.0017), 0.0)
        };
    }
 
    // LUT interior
    let seg = LUT_LOGT.length - 2;
    for (let j = 0; j < LUT_LOGT.length - 1; j++) {
        if (logT <= LUT_LOGT[j + 1]) { seg = j; break; }
    }
    const t = Math.min(1, Math.max(0, (logT - LUT_LOGT[seg]) / (LUT_LOGT[seg+1] - LUT_LOGT[seg])));
    const lerp = (a, b) => a + (b - a) * t;
    return {
        r: lerp(LUT_COLORS[seg][0], LUT_COLORS[seg+1][0]),
        g: lerp(LUT_COLORS[seg][1], LUT_COLORS[seg+1][1]),
        b: lerp(LUT_COLORS[seg][2], LUT_COLORS[seg+1][2]),
        a: lerp(LUT_FOPT[seg],      LUT_FOPT[seg+1])
    };
}

///////////////

export function getSpriteMaterial(col){
    return new THREE.SpriteMaterial({
        map: createFlareTexture(),
        color: col,
	transparent: false,
	depthWrite: false,
	depthTest:   true,
	blending: THREE.AdditiveBlending
    });
}

let flareTexture = null;
function createFlareTexture() {
    if (flareTexture) return flareTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const half = size / 2;

    for (let y = 0; y < size; y++) {
	for (let x = 0; x < size; x++) {
	    // r in [0, 1], where 1 = edge of the canvas circle
	    const r = Math.sqrt((x - half) ** 2 + (y - half) ** 2) / half;
	    const alpha = Math.min(1, Math.exp(-5 * (r - 0.03)));

	    const i = (y * size + x) * 4;
	    imageData.data[i]     = 255; // R
	    imageData.data[i + 1] = 255; // G
	    imageData.data[i + 2] = 255; // B
	    imageData.data[i + 3] = Math.round(alpha * 255);
	}
    }
    ctx.putImageData(imageData, 0, 0);
    flareTexture = new THREE.CanvasTexture(canvas);
    return flareTexture;
}

function createFlareTextureStepped() {
    if (flareTexture) return flareTexture;
    
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Radial gradient: bright center, fading to transparent
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.1, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    flareTexture = new THREE.CanvasTexture(canvas);
    return flareTexture;
}

export function initStarfieldMaterial(pr){
		return new THREE.ShaderMaterial({
   	        uniforms: {
 		       pixelRatio: { value: pr },
  		       gamma: { value: 1.0 },
 		       beta: { value: 0.0 },
  		       velocityDir: { value: new THREE.Vector3(1, 0, 0) },
  		       maglimit: { value: 6.5 },
  		       fov: { value: 45.0 },
  		       flareLimit: { value: 5.0 },
  		       gammaFlareFactor: { value: 1.0 },
  		       tempLUT: {value: tempLUT}
    		},
		vertexShader: starVertexShaderString,
		fragmentShader: starFragmentShaderString,
    		transparent: false,  // ! major performance gain, avoid sorting

		blending:           THREE.CustomBlending,
		blendEquation:      THREE.AddEquation,
		blendEquationAlpha: THREE.MaxEquation,

		blendSrc:           THREE.SrcAlphaFactor, // default SrcAlphaFactor
		blendDst:           THREE.DstAlphaFactor, // default OneMinusSrcAlphaFactor
		blendSrcAlpha:      THREE.OneFactor, // default null
		blendDstAlpha:      THREE.OneFactor, // default null

    		depthWrite: false,
		depthTest: false,
            });
}

	// 3d mesh (stars)
export function initStarMeshMaterial() {
	    return new THREE.ShaderMaterial({
		wireframe: false,
		uniforms: {
		    gamma: { value: 1.0 },
		    beta: { value: 0.0 },
		    velocityDir: { value: new THREE.Vector3(1, 0, 0) },
		    starPosition: { value: new THREE.Vector3(0, 0, 0) },
		    restTemperature: { value: 6.0 },  // kK
		    restMagnitude: { value: 0.0 },
		    tempLUT: {value: tempLUT}
		},
		vertexShader: starMeshVertexShaderString,
		fragmentShader: starMeshFragmentShaderString,
		transparent: false,
//		blending:   THREE.AdditiveBlending,
		depthWrite: true,
		depthTest:   true,
	    });
	}


export function initPlanetPointMaterial(dots) {
    return new THREE.ShaderMaterial({
        uniforms: {
	    pixelRatio:       { value: window.devicePixelRatio },
	    flareLimit:       { value: 0.0 },
	    gammaFlareFactor: { value: 1.0 },
	    fov:              { value: 60.0 },
	    T_star:           { value: 5.8 },
            beta:        { value: 0.0 },
            gamma:       { value: 1.0 },
            velocityDir: { value: new THREE.Vector3(1, 0, 0) },
            maglimit:    { value: 6.5 },
	    showOrbits: { value: dots },
	    tempLUT:          { value: tempLUT0 }
        },
        vertexShader:   planetPointVertexString,
        fragmentShader: planetPointFragmentString,
	transparent: true, // need true for NormalBlending
	blending: THREE.NormalBlending,
	depthWrite: false,
	depthTest:   false, // need true to render moon dots in front of planet mesh
//	polygonOffset: true,
//	polygonOffsetFactor: 1,
//	polygonOffsetUnits: 1
    });
}

export function initMilkyWayMaterial(pr, top, fop, tir, irb, fov) {
    return new THREE.ShaderMaterial({
        uniforms: {
            gamma: { value: 1.0 },
            beta: { value: 0.0 },
            velocityDir: { value: new THREE.Vector3(1, 0, 0) },
            pixelRatio: { value: pr },
            tempOptical: { value: top },  
            fRestOpt: {value: fop},
            tempIR: { value: tir },        // kK - peaks in IR
            irBoost: { value: irb },  // tune IR contribution
            fov: { value: fov },  // tune particle size with fov
            tempLUT: {value: tempLUT0}
        },
        vertexShader: milkyWayVertexShaderString,
        fragmentShader: milkyWayFragmentShaderString,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}

export function initDeepSkyMaterial(){
    return new THREE.ShaderMaterial({
    vertexShader: deepSkyVertexString,
    fragmentShader: deepSkyFragmentString,
    uniforms: {
      gamma:       { value: 1.0 },
      beta: { value: 0.0 },
      velocityDir: { value: new THREE.Vector3(0, 0, 1) },
      tempLUT: {value: tempLUT0}
    },
    transparent: false,
    depthWrite: false,
    depthTest:   true,
    blending: THREE.AdditiveBlending,
    side:     THREE.DoubleSide,
  });
}

export function initSpaceGridMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            // fractional observer offset within one grid cell, in world units [-SPACEGRID_SPACING/2, SPACEGRID_SPACING/2]
            gridOffset:      { value: new THREE.Vector3(0, 0, 0) },
            // same thing but at 10x scale — drives isMajor in the shader
            majorGridOffset: { value: new THREE.Vector3(0, 0, 0) },
            velocityDir:     { value: new THREE.Vector3(1, 0, 0) },
            gamma:           { value: 1.0 },
 	    beta: { value: 0.0 },
            // Physical AU per grid cell.
            gridScaleAU:     { value: 1.0 },
            // ratio: from 1 to 10 (multiplicative), where are we in between scale jumps?
            ratio:           { value: 0.0 }, // "fadeOut" has been removed as equivalent to 12.5*ratio
            mode:            { value: 2 }
        },
        vertexShader: spaceGridShaderString,
        fragmentShader: `
varying vec3  vColor;
varying float vOpacity;
void main() {
    if (vOpacity < 0.01) discard;
    gl_FragColor = vec4(vColor, vOpacity);
}`,
        vertexColors: false,
	transparent: false,
	depthWrite: false,
	depthTest:   true,
	blending: THREE.AdditiveBlending
    });
}

	// celestial sphere gridlines
export function initGridMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: {
		    gamma: { value: 1.0 },
 		    beta: { value: 0.0 },
		    velocityDir: { value: new THREE.Vector3(1, 0, 0) }
		},
		vertexShader: gridShaderString,
		fragmentShader: `
		    varying vec3 vColor;
		    varying float vOpacity;
		    
		    void main() {
		        gl_FragColor = vec4(vColor, vOpacity);
		    }
		`,
		vertexColors: true,
		transparent: false,
		depthWrite: false,
		depthTest:   true,
		blending: THREE.AdditiveBlending
	    });
	}

	// material for orbital ellipses, 
	// originally called "local" because it was going to serve for all "local" (non-far-field) objects rendered in 3d)
export function initLocalMaterial() {
	    return new THREE.ShaderMaterial({
		uniforms: {
		    gamma: { value: 1.0 },
 		    beta: { value: 0.0 },
		    velocityDir: { value: new THREE.Vector3(1, 0, 0) },
		    objectPosition: { value: new THREE.Vector3(0, 0, 0) },
		    fadeStart: { value: 1.0 },
		    fadeEnd: { value: 1200.0 }
		},
		vertexShader: localShaderString,
		fragmentShader: `
		    varying vec3 vColor;
		    varying float vOpacity;
		    
		    void main() {
		        if (vOpacity < 0.01) discard;
		        gl_FragColor = vec4(vColor, vOpacity);
		    }
		`,
		vertexColors: true,
		transparent: false,
		depthWrite: false,
		depthTest:   true,
		blending: THREE.AdditiveBlending
	    });
	}

export function initLineMaterial(){

	    return new THREE.ShaderMaterial({
	        uniforms: {
	            gamma: { value: 1.0 },
		    beta: { value: 0.0 },
	            velocityDir: { value: new THREE.Vector3(1, 0, 0) },
	            opacity: { value: 0.4 }
	        },
	        vertexShader: lineShaderString,
	        fragmentShader: `
	            uniform float opacity;        
	            void main() {
	                gl_FragColor = vec4(0.3,0.6,0.9, opacity);
	            }`,
	        vertexColors: true,
		transparent: false,
		depthWrite: false,
		depthTest:   true,
		blending: THREE.AdditiveBlending
	    });

}

// STAR FIELD

const starVertexShaderString = `
    attribute float mag;
    attribute float temperature;

    varying vec3  vColor;
    varying float vAlpha;
    varying float vPointSize;
    varying float vFlareStrength;
    varying float vStarSize;

    uniform float pixelRatio;
    uniform float gamma;
    uniform float beta;
    uniform float flareLimit;        // precomputed: (maglimit-1.5) + 0.5*log2(45/fov)
    uniform float gammaFlareFactor;  // precomputed: 1 - smoothstep(1.1, 8.0, gamma)
    uniform vec3  velocityDir;
    uniform float maglimit;
    uniform float fov;

    uniform sampler2D tempLUT;

    // LUT spans logT in [0, LOG_T_LUT_MAX], i.e. T in [1, 33] kK.
    // Below 1 kK: blackout branch.  Above 33 kK: extrapolation branch.
    const float LOG_T_LUT_MAX = 3.497;

    vec4 tempLookup(float tempKK) {
        float logT = log(max(tempKK, 1e-4));   // allow values below 1 kK; guard log(0)

        // Blackout: fade dark-red and fopt to zero as logT → -0.5 (T → 0.6 kK)
        if (logT < 0.0) {
            float s = smoothstep(-0.5, 0.0, logT);
            return vec4(0.251, 0.000, 0.000, 1e-8) * s;
        }

        // LUT interior: 1 kK ≤ T ≤ 33 kK
        if (logT <= LOG_T_LUT_MAX) {
            return texture2D(tempLUT, vec2(logT / LOG_T_LUT_MAX, 0.5));
        }

        // Extrapolation: linear continuation of the 33 kK → 100 kK slope
        float t     = (logT - 3.497) / (4.605 - 3.497);
        vec3  color = mix(vec3(0.337, 0.592, 1.000), vec3(0.298, 0.545, 0.973), t);
        float frac  = mix(0.35, 0.0017, t);
        return vec4(color, max(frac, 0.0));
    }

    const float LOG10    = 2.302585093;
    const float MIN_SIZE = 0.01;
    const float MAX_SIZE = 16.0;

    void main() {
        float effMag   = max(-10.0, mag);
        float size     = 0.25 * (15.0 - effMag);
        vec3  dir      = normalize(position);
        float radius   = 90.0;
        float cosAlpha = dot(dir, velocityDir);

        vec3  finalPos      = position;
        float finalSize     = 0.0;
        float cosAlphaPrime = cosAlpha;

        vFlareStrength = 0.0;
        vStarSize      = 0.0;
        vAlpha         = 0.0;
        vColor         = vec3(0.0);
        bool inBlob    = false;

        if (temperature >= 0.01) {

            // ---- Aberration ----
            float denom         = 1.0 + beta * cosAlpha;
            cosAlphaPrime       = (cosAlpha + beta) / denom;
            float sinRatio      = 1.0 / (gamma * denom); // exact: sinAlpha'/sinAlpha

            vec3 newDir;
            if (sinRatio > 1e4) {
                newDir = sign(cosAlphaPrime) * velocityDir;
            } else {
                vec3 perp = dir - cosAlpha * velocityDir;
                newDir = cosAlphaPrime * velocityDir + sinRatio * perp;
            }
            finalPos = newDir * radius;

            // ---- Doppler & brightness ----
            float D       = gamma * (1.0 + beta * cosAlpha);
            float D2      = D * D;
            float D4      = D2 * D2;
            float tempEff = temperature * D;

            vec4  eff            = tempLookup(tempEff);

	    float sizeShift = 0.0;
	    if (beta > 1e-4) {
		vec4  rest            = tempLookup(temperature);
		float brightnessRatio = (rest.a > 1e-8) ? (D4 * eff.a / rest.a) : 1.0;
		sizeShift       = 2.5 * log(max(brightnessRatio, 1e-10)) / LOG10;
	    }

            float newMag = max(15.0 - 4.0 * (size + sizeShift), -19.0);
            effMag = newMag;

            // ---- Heuristic point size ----
            float effectiveSize = 0.25 * (15.0 - newMag);
            float magscale = (maglimit + 3.5) / 20.0;
            finalSize = effectiveSize * magscale * magscale * 1500.0 / fov / (newMag + 20.0);
            finalSize = min(finalSize, MAX_SIZE);

            vAlpha = smoothstep(0.0, 1.0, finalSize);
            if (finalSize < MIN_SIZE) { finalSize = 0.0; vAlpha = 0.0; }

            // ---- Color with whiteout ----
            // For point sources, apparent magnitude drives perceptual saturation
            // (unlike resolved meshes where surface brightness = f(T) alone).
            // whiteoutTemp catches extreme Doppler blueshift beyond the extrapolation range.
            // whiteoutBright catches intrinsically/relativistically bright point sources.
            float whiteoutTemp   = smoothstep(100.0, 400.0, tempEff);
            float whiteoutBright = smoothstep(3.0, -3.0, newMag);
            vColor = mix(eff.rgb, vec3(1.0), max(whiteoutTemp, whiteoutBright));
        }

        // ---- Flare & blob suppression ----
        if (finalSize > 0.0 && vAlpha > 0.0) {
            float t = clamp((flareLimit - effMag) / 4.0, 0.0, 1.0);
            vFlareStrength = t * gammaFlareFactor;

            if (cosAlphaPrime > 0.985 && gamma > 5.1 - maglimit * 0.4) {
                float blobK         = 0.01 + 0.0015 * maglimit;
                float blobThreshold = max(0.985, 1.0 - blobK * gamma);
                if (blobThreshold < cosAlphaPrime) { inBlob = true; }
            }
        }

        float flareSize = vFlareStrength * 5.0 * finalSize;
        if (inBlob) { vFlareStrength = -1.0; }

        vStarSize  = finalSize;
        vPointSize = max(finalSize, flareSize);

        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
        gl_PointSize = vPointSize * pixelRatio * (300.0 / 90.0);
        gl_Position  = projectionMatrix * mvPosition;
    }
`;

const starFragmentShaderString = `
    varying vec3  vColor;
    varying float vAlpha;
    varying float vPointSize;
    varying float vFlareStrength;
    varying float vStarSize;

    void main() {
        vec2  center = gl_PointCoord - vec2(0.5);
        float dist   = length(center);
        if (dist > 0.5) discard;

        float r            = dist * 2.0;
        float starFraction = clamp(vStarSize / max(vPointSize, 0.001), 0.05, 1.0);
        float rStar        = r / starFraction;
        float core         = 1.0 - smoothstep(0.1, 0.6, rStar);

        float halo = 0.0;
        if      (vFlareStrength < 0.0)  { halo = 1.0; }  // inBlob sentinel
        else if (rStar >= 0.05) {
            halo = vFlareStrength * exp(-r * 4.0);
        }
        float alpha = vAlpha * clamp(core + halo, 0.0, 1.0);	
        gl_FragColor = vec4(vColor, alpha);
    }
`;


// 3D STAR MESH  (nearby stars rendered as spheres, Lorentz + light-travel)
const starMeshVertexShaderString = `
    varying vec3 vColor;
 
    uniform float gamma;
    uniform float beta;
    uniform vec3  velocityDir;
    uniform vec3  starPosition;
    uniform float restTemperature;
    uniform sampler2D tempLUT;
 
    // LUT spans logT in [0, LOG_T_LUT_MAX], i.e. T in [1, 33] kK.
    const float LOG_T_LUT_MAX = 3.497;
    const float kWhite = 200.0;
 
    vec4 tempLookup(float tempKK) {
        float logT = log(max(tempKK, 1e-4));
 
        // Blackout: smoothly zero out color and fopt below 1 kK, black by 0.6 kK
        if (logT < 0.0) {
            float s = smoothstep(-0.5, 0.0, logT);
            return vec4(0.251, 0.000, 0.000, 1e-8) * s;
        }
 
        // LUT interior
        if (logT <= LOG_T_LUT_MAX) {
            return texture2D(tempLUT, vec2(logT / LOG_T_LUT_MAX, 0.5));
        }
 
        // Whiteout extrapolation: linear continuation of 33 kK → 100 kK slope
        float t     = (logT - 3.497) / (4.605 - 3.497);
        vec3  color = mix(vec3(0.337, 0.592, 1.000), vec3(0.298, 0.545, 0.973), t);
        float frac  = mix(0.35, 0.0017, t);
        return vec4(color, max(frac, 0.0));
    }
 
    void main() {
        vec3 worldPos = position + starPosition;
        vec3 finalPos;
 
        if (beta < 1e-8) {
            finalPos = worldPos;
        } else {
            float par  = dot(worldPos, velocityDir);
            vec3  posL = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;
            vec3  v    = -beta * velocityDir;
            float a    = beta * beta - 1.0;
            float b    = -2.0 * dot(posL, v);
            float c    = dot(posL, posL);
            float dt   = (-b - sqrt(max(0.0, b*b - 4.0*a*c))) / (2.0 * a);
            finalPos   = posL - v * dt;
        }
 
        float tempEff;
        if (beta < 1e-8) {
            tempEff = restTemperature;
        } else {
            vec3  vertDir  = normalize(finalPos);
            float cosAlpha = dot(vertDir, velocityDir);
            float D        = gamma * (1.0 + beta * cosAlpha);
            tempEff = restTemperature * D;
        }
 
        vec4  eff        = tempLookup(tempEff);
        float t2         = tempEff * tempEff;
        float surfBright  = t2 * t2 * eff.a;                         // T^4 * fopt
        float whiteout    = smoothstep(kWhite, 4.0 * kWhite, surfBright);
        vColor = mix(eff.rgb, vec3(1.0), whiteout);
 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
    }
`;
 
const starMeshFragmentShaderString = `
    varying vec3 vColor;
 
    void main() {
        gl_FragColor = vec4(vColor, 1.0);
    }
`;

// PLANET POINT  (reflected + thermal, Lorentz + light-travel)
const planetPointVertexString = `
    attribute vec3 color;       // planet intrinsic surface RGB (static)
    attribute float aMagnitude;  // apparent magnitude (updated per frame)
    attribute float aIr;         // planet IR albedo (static)
    attribute vec3 orbitColor;  // orbit line colour; vec3(0) means no orbit (static)
 
    uniform float beta;
    uniform float gamma;
    uniform vec3  velocityDir;
    uniform float maglimit;
    uniform float pixelRatio;
    uniform float flareLimit;
    uniform float gammaFlareFactor;
    uniform float fov;
    uniform float T_star;        // star temperature in kK (Sun: 5.8)
    uniform sampler2D tempLUT;
    uniform bool showOrbits;    // whether orbit ellipses are being drawn
 
    varying vec3 vColor;
    varying float vAlpha;
    varying float vPointSize;
    varying float vFlareStrength;
    varying float vStarSize;     // sentinel: -1.0 means "draw orbit dot"
 
    const float LOG_T_MAX = 4.60517;
    vec4 tempLookup(float tempKK) {
        float logT = log(max(tempKK, 1.0));
        if (logT > LOG_T_MAX) {
            float t    = (logT - 3.497) / (4.605 - 3.497);
            float frac = mix(0.035, 0.0017, t);
            return vec4(0.298, 0.545, 0.973, max(frac, 0.0));
        }
        return texture2D(tempLUT, vec2(logT / LOG_T_MAX, 0.5));
    }
 
    float planck(float lambda, float T) {
        if (T <= 0.0) return 0.0;
        float x = 1438.8 / (lambda * T);
        if (x > 85.0) return 0.0;
        return 1.0 / (pow(lambda, 5.0) * (exp(x) - 1.0));
    }
 
    float reflectivity(float lambda, vec3 rgb, float ir_val) {
        if (lambda <= 300.0)  return 0.0;
        if (lambda <= 452.0)  return rgb.b * (lambda - 300.0) / 152.0;
        if (lambda <= 525.0)  return mix(rgb.b, rgb.g, (lambda - 452.0) / 73.0);
        if (lambda <= 614.0)  return mix(rgb.g, rgb.r, (lambda - 525.0) / 89.0);
        if (lambda <= 1000.0) return mix(rgb.r, ir_val, (lambda - 614.0) / 386.0);
        return ir_val;
    }
 
    const float LOG10    = 2.302585093;
    const float MIN_SIZE = 0.1;
    const float MAX_SIZE = 16.0;
    vec3 worldDir = vec3(0.0); 
 
    vec3 aberrate(vec3 worldPos) {
        float par  = dot(worldPos, velocityDir);
        vec3  posL = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;
        vec3  v    = -beta * velocityDir;
        float a    = beta * beta - 1.0;
        float b    = -2.0 * dot(posL, v);
        float c    = dot(posL, posL);
        float tau  = (-b - sqrt(max(0.0, b*b - 4.0*a*c))) / (2.0 * a);
        return posL - v * tau;
    }
 
    void main() {
        vec3  worldPos = position;
        vec3  finalPos;
        worldDir = normalize(worldPos);
        float cosAlpha = dot(worldDir, velocityDir);
 
        // ---- Aberration ----
        if (beta < 1e-8) {
            finalPos = worldPos;
        } else {
            finalPos = aberrate(worldPos);
        }
 
        // ---- Doppler factor (D > 1 = blueshift) ----
        float D = (beta < 1e-8) ? 1.0 : gamma * (1.0 + beta * cosAlpha);
 
        // ---- Size/brightness via tempLookup ----
        float effMag  = max(-10.0, aMagnitude);
        float size    = 0.25 * (15.0 - effMag);
        float tempEff = T_star * D;
        vec4  eff     = tempLookup(tempEff);
 
        float sizeShift = 0.0;
        if (beta > 1e-4) {
            vec4  rest            = tempLookup(T_star);
            float brightnessRatio = (rest.a > 1e-8) ? (D*D*D*D * eff.a / rest.a) : 1.0;
            sizeShift = 2.5 * log(max(brightnessRatio, 1e-10)) / LOG10;
        }
 
        float finalSize = 0.0;
        vFlareStrength  = 0.0;
        vStarSize       = 0.0;
        vAlpha          = 0.0;
        vColor          = vec3(0.0);
 
        float newMag        = max(15.0 - 4.0 * (size + sizeShift), -19.0);
        float effectiveSize = 0.25 * (15.0 - newMag);
        float magscale      = (maglimit + 3.5) / 20.0;
        finalSize = effectiveSize * magscale * magscale * 1500.0 / fov / (newMag + 20.0);
        finalSize = min(finalSize, MAX_SIZE);
 
        vAlpha = smoothstep(0.0, 1.0, finalSize);
 
        // ---- Orbit-dot fallback or normal cull ----
        // length(worldPos) is distance in AU from observer (observer is at scene origin).
        bool orbitDot = false;
        if (newMag > maglimit) {
            if (showOrbits && length(worldPos) < 500.0 && length(orbitColor) > 0.001) {
                orbitDot = true;
                vAlpha   = 1.0;
            } else {
                finalSize = 0.0;
                vAlpha    = 0.0;
            }
        }
 
        // ---- Colour ----
        if (orbitDot) {
            vColor = orbitColor;
        } else {
            const float LR = 614.0;
            const float LG = 525.0;
            const float LB = 452.0;
            float p0R = planck(LR, T_star);
            float p0G = planck(LG, T_star);
            float p0B = planck(LB, T_star);
 
            vec3 reflected = vec3(
                reflectivity(LR * D, color, aIr) * planck(LR, T_star * D) / p0R,
                reflectivity(LG * D, color, aIr) * planck(LG, T_star * D) / p0G,
                reflectivity(LB * D, color, aIr) * planck(LB, T_star * D) / p0B
            );
 
            float whiteoutTemp   = smoothstep(100.0, 400.0, tempEff);
            float whiteoutBright = smoothstep(3.0, -3.0, newMag);
            vColor = mix(reflected, vec3(1.0), max(whiteoutTemp, whiteoutBright));
        }
 
        // ---- Flare (normal points only) ----
        if (!orbitDot && finalSize > 0.0 && vAlpha > 0.0) {
            float t = clamp((flareLimit - newMag) / 4.0, 0.0, 1.0);
            vFlareStrength = t * gammaFlareFactor;
        }
 
        float flareSize = vFlareStrength * 5.0 * finalSize;
        vStarSize  = orbitDot ? -1.0 : finalSize;
        vPointSize = orbitDot ? 6.0  : max(finalSize, flareSize);
 
        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
        gl_PointSize = orbitDot
            ? 3.0 * pixelRatio
            : vPointSize * pixelRatio * (300.0 / 90.0);
        gl_Position  = projectionMatrix * mvPosition;
    }
`;
 
const planetPointFragmentString = `
    varying vec3  vColor;
    varying float vAlpha;
    varying float vPointSize;
    varying float vFlareStrength;
    varying float vStarSize;
 
    void main() {
        vec2  center = gl_PointCoord - vec2(0.5);
        float dist   = length(center);
        if (dist > 0.5) discard;
 
        // Orbit-dot sentinel: simple soft circle, no core/halo logic
        if (vStarSize < 0.0) {
            float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha);
            return;
        }
 
        // Normal star-style rendering (identical to starFragmentShaderString)
        float r            = dist * 2.0;
        float starFraction = clamp(vStarSize / max(vPointSize, 0.001), 0.05, 1.0);
        float rStar        = r / starFraction;
        float core         = 1.0 - smoothstep(0.1, 0.6, rStar);
 
        float halo = 0.0;
        if (rStar >= 0.05) {
            halo = vFlareStrength * exp(-r * 3.5);
        }
 
        gl_FragColor = vec4(vColor, vAlpha * clamp(core + halo, 0.0, 1.0));
    }
`;

export function initPlanetMaterial(ir, temp, dilute, texture, ill = true) {
    return new THREE.ShaderMaterial({
        wireframe: false,
        vertexColors: true,
        uniforms: {
            gamma:         { value: 1.0 },
            beta:          { value: 0.0 },
            velocityDir:   { value: new THREE.Vector3(1, 0, 0) },
            sunDir:        { value: new THREE.Vector3(1, 0, 0) },
            ir:            { value: ir },
            temperature:   { value: temp },
            dilution:      { value: dilute },
            whiteout:      { value: new THREE.Vector3(0, 0, 0) },
            planetTexture: { value: texture },
            hasTexture:    { value: texture ? true : false },
            illum:         { value: ill },
            tempLUT:       { value: tempLUT },
            // Parent-body glow uniforms (zero = no glow, safe default for non-moons)
            planetDir:     { value: new THREE.Vector3(0, 0, 0) },
            planetglow:    { value: new THREE.Vector3(0.5, 0, 0) },
            eclipseFactor: { value: -1.0 },  // sentinel: -1=not a moon (ignore), [0,1]=eclipse factor
        },
        vertexShader:   planetVertexString,
        fragmentShader: planetFragmentString,
        transparent: true,
        depthWrite: true,
        depthTest:   true
    });
}

const planetVertexString = `
    varying vec3  vColor;
    varying float vOpacity;
    varying float vDoppler;
    varying vec2  vUv;
 
    uniform float gamma;
    uniform float beta;
    uniform vec3  velocityDir;
    uniform vec3  sunDir;
    uniform bool  illum;
    uniform vec3  planetDir;     // unit vector toward parent body (world space)
    uniform vec3  planetglow;    // pre-scaled RGB glow, fraction of full sunlight per channel
    uniform float eclipseFactor; // 1=full sunlight, 0=full eclipse (moon in planet shadow)
 
    vec3 aberrate(vec3 worldPos) {
        float par  = dot(worldPos, velocityDir);
        vec3  posL = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;
        vec3  v    = -beta * velocityDir;
        float a    = beta * beta - 1.0;
        float b    = -2.0 * dot(posL, v);
        float c    = dot(posL, posL);
        float tau  = (-b - sqrt(max(0.0, b*b - 4.0*a*c))) / (2.0 * a);
        return posL - v * tau;
    }
 
    void main() {
        vUv = uv;
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 finalPos;
 
        if (beta < 1e-8) {
            finalPos = worldPos;
            vDoppler = 1.0;
        } else {
            finalPos       = aberrate(worldPos);
            float cosTheta = dot(normalize(worldPos), velocityDir);
            vDoppler       = 1.0 / (gamma * (1.0 - beta * cosTheta));
        }
 
        vOpacity = 1.0;
        if (illum) {
            vec3 n = normalize(position);   // surface normal in local space
 
            // Sunlight: white (generalise to starColor for exoplanets in future).
            // eclipseFactor in [0,1] for moons (set per-frame by JS).
            // Sentinel -1.0 means "not a moon" — treat as full sunlight.
            float cosSun   = max(0.0, dot(n, sunDir));
            float ef       = (eclipseFactor < 0.0) ? 1.0 : eclipseFactor;
            vec3  sunlight = cosSun * ef * vec3(1.0);
 
            // Parent-body glow: colored, directional, pre-scaled as fraction of sunlight
            float cosPlanet = max(0.0, dot(n, planetDir));
            vec3  glow      = cosPlanet * planetglow;

            // vColor = total illumination per channel.
            // For textured objects color == vec3(1) so vColor == illumination directly.
            // For colored meshes vColor == surfaceColor * illumination as before.
            vColor = color * (sunlight + glow);
        } else {
            vColor = color;
        }
 
        gl_Position = projectionMatrix * viewMatrix * vec4(finalPos, 1.0);
    }
`;

const planetFragmentString = `
    varying vec3  vColor;
    varying float vOpacity;
    varying float vDoppler;
    varying vec2  vUv;

    uniform float ir;
    uniform float temperature;   // planet surface temperature in Kelvin
    uniform float dilution;      // (R_star / d_orbit)^2 — scales reflected light only
    uniform vec3  whiteout;
    uniform sampler2D planetTexture;
    uniform bool  hasTexture;
    uniform sampler2D tempLUT;

    // LUT spans logT in [0, 3.497], i.e. T in [1, 33] kK.
    const float LOG_T_LUT_MAX = 3.497;
    vec4 tempLookup(float tempKK) {
        float logT = log(max(tempKK, 1e-4));
        if (logT < 0.0) {
            float s = smoothstep(-0.5, 0.0, logT);
            return vec4(0.251, 0.000, 0.000, 1e-8) * s;
        }
        if (logT <= LOG_T_LUT_MAX) {
            return texture2D(tempLUT, vec2(logT / LOG_T_LUT_MAX, 0.5));
        }
        float t     = (logT - 3.497) / (4.605 - 3.497);
        vec3  color = mix(vec3(0.337, 0.592, 1.000), vec3(0.298, 0.545, 0.973), t);
        float frac  = mix(0.35, 0.0017, t);
        return vec4(color, max(frac, 0.0));
    }

    float planck(float lambda, float T) {
        if (T <= 0.0) return 0.0;
        float x = 1.4388e7 / (lambda * T);
        if (x > 85.0) return 0.0;
        return 1.0 / (pow(lambda, 5.0) * (exp(x) - 1.0));
    }

    float reflectivity(float lambda, vec3 rgb, float ir_val) {
        if (lambda <= 300.0)  return 0.0;
        if (lambda <= 452.0)  return rgb.b * (lambda - 300.0) / 152.0;
        if (lambda <= 525.0)  return mix(rgb.b, rgb.g, (lambda - 452.0) / 73.0);
        if (lambda <= 614.0)  return mix(rgb.g, rgb.r, (lambda - 525.0) / 89.0);
        if (lambda <= 1000.0) return mix(rgb.r, ir_val, (lambda - 614.0) / 386.0);
        return ir_val;
    }

    void main() {
        const float LR        = 614.0;
        const float LG        = 525.0;
        const float LB        = 452.0;
        const float T_STAR    = 5800.0;   // K, for planck() calls
        const float T_STAR_KK = 5.8;     // kK, for tempLookup() reference

        vec3 surfaceColor = hasTexture
            ? texture2D(planetTexture, vUv).rgb * vColor : vColor;
        surfaceColor = min(vec3(1.0), surfaceColor + whiteout);
        float D = vDoppler;

        // ---- Reflected light (shifted Planck, per-channel) ----
        // planck(λ, T*D) already encodes the D³ specific-intensity transform;
        // no additional Doppler factor needed. dilution belongs only here.
        float p0R = planck(LR, T_STAR);
        float p0G = planck(LG, T_STAR);
        float p0B = planck(LB, T_STAR);

        float rR = reflectivity(LR*D, surfaceColor, ir) * planck(LR, T_STAR*D) / p0R;
        float rG = reflectivity(LG*D, surfaceColor, ir) * planck(LG, T_STAR*D) / p0G;
        float rB = reflectivity(LB*D, surfaceColor, ir) * planck(LB, T_STAR*D) / p0B;
        vec3 reflected = vec3(rR, rG, rB);

        // ---- Emitted thermal radiation (tempLUT, perceptually calibrated) ----
        // Color from tempLUT: LED-corrected, consistent with star rendering.
        // Brightness: T^4 * fopt ratio against solar surface brightness,
        // divided by dilution to normalise to solar flux at this orbital distance.
        float temp_kK  = temperature / 1000.0;
        float temp_eff = temp_kK * D;
        vec4  emitLUT  = tempLookup(temp_eff);
        float T_eff4   = temp_eff * temp_eff * temp_eff * temp_eff;

        vec4  starLUT  = tempLookup(T_STAR_KK);
        float T_star4  = T_STAR_KK * T_STAR_KK * T_STAR_KK * T_STAR_KK;

        float emitScale = (T_eff4 * emitLUT.a) / (T_star4 * starLUT.a * dilution);
        vec3  emitted   = emitLUT.rgb * emitScale;

        gl_FragColor = vec4(reflected + emitted, vOpacity);
    }
`;

export function initEarthMaterial(ir, temp, dilute, texture, ill = true) {
    return new THREE.ShaderMaterial({
        wireframe: false,
        vertexColors: true,
        uniforms: {
            gamma:         { value: 1.0 },
            beta:          { value: 0.0 },
            velocityDir:   { value: new THREE.Vector3(1, 0, 0) },
            sunDir:        { value: new THREE.Vector3(1, 0, 0) },
            ir:            { value: ir },
            temperature:   { value: temp },
            dilution:      { value: dilute },
            whiteout:      { value: new THREE.Vector3(0, 0, 0) },
            planetTexture: { value: texture },
            hasTexture:    { value: texture ? true : false },
            illum:         { value: ill },
            tempLUT:       { value: null }, // unused
            planetDir:     { value: null }, // unused
            planetglow:    { value: null }, // unused
            eclipseFactor: { value: null },  // unused
        },
        vertexShader:   earthVertexString,
        fragmentShader: earthFragmentString,
        transparent: true,
        depthWrite: true,
        depthTest:   true
    });
}
 
// Earth-specific fragment shader: identical to planetFragmentString but with a
// water-pixel check that drops near-IR albedo to ~0 for ocean surfaces.
// All uniforms are kept identical to planetFragmentString so JS update loops
// need no special-casing for Earth.
const earthVertexString = `
    varying vec3  vColor;
    varying float vOpacity;
    varying float vDoppler;
    varying vec2  vUv;

    uniform float gamma;
    uniform float beta;
    uniform vec3  velocityDir;
    uniform vec3  sunDir;
    uniform bool  illum;

    vec3 aberrate(vec3 worldPos) {
        float par  = dot(worldPos, velocityDir);
        vec3  posL = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;
        vec3  v    = -beta * velocityDir;
        float a    = beta * beta - 1.0;
        float b    = -2.0 * dot(posL, v);
        float c    = dot(posL, posL);
        float tau  = (-b - sqrt(max(0.0, b*b - 4.0*a*c))) / (2.0 * a);
        return posL - v * tau;
    }

    void main() {
        vUv = uv;
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 finalPos;

        if (beta < 1e-8) {
            finalPos = worldPos;
            vDoppler = 1.0;
        } else {
            finalPos       = aberrate(worldPos);
            float cosTheta = dot(normalize(worldPos), velocityDir);
            vDoppler       = 1.0 / (gamma * (1.0 - beta * cosTheta));
        }

        vOpacity = 1.0;
        if (illum) {
            float cosSun = max(0.0, dot(normalize(position), sunDir));
            vColor = color * cosSun;
        } else {
            vColor = color;
        }

        gl_Position = projectionMatrix * viewMatrix * vec4(finalPos, 1.0);
    }
`;

const earthFragmentString = `
    varying vec3  vColor;
    varying float vOpacity;
    varying float vDoppler;
    varying vec2  vUv;
 
    uniform float ir; // ignored
    uniform float temperature; // ignored
    uniform float dilution;
    uniform vec3 whiteout;
    uniform sampler2D planetTexture;
    uniform bool  hasTexture;
 
    float planck(float lambda, float T) {
        if (T <= 0.0) return 0.0;
        float x = 1.4388e7 / (lambda * T);
        if (x > 85.0) return 0.0;
        return 1.0 / (pow(lambda, 5.0) * (exp(x) - 1.0));
    }
 
    // uv: reflectivity at/below 300 nm (0.0 for water/land, 0.6 for ice/snow)
    float reflectivity(float lambda, vec3 rgb, float ir_val, float uv) {
        if (lambda <= 300.0)  return uv;
        if (lambda <= 452.0)  return mix(uv, rgb.b, (lambda - 300.0) / 152.0);
        if (lambda <= 525.0)  return mix(rgb.b, rgb.g, (lambda - 452.0) / 73.0);
        if (lambda <= 614.0)  return mix(rgb.g, rgb.r, (lambda - 525.0) / 89.0);
        if (lambda <= 1000.0) return mix(rgb.r, ir_val, (lambda - 614.0) / 386.0);
        return ir_val;
    }
 
    void main() {
        const float T_star = 5800.0;
        const float LR = 614.0;
        const float LG = 525.0;
        const float LB = 452.0;
 
        // Raw texture colour used for surface-type detection — unaffected by
        // illumination scaling (vColor) or whiteout, so the checks see the
        // actual surface albedo rather than a shaded/boosted version of it.
        vec3 rawColor     = hasTexture ? texture2D(planetTexture, vUv).rgb : vColor;
        vec3 surfaceColor = min(vec3(1.0), rawColor * vColor + whiteout);
        float D = vDoppler;
 
        // Surface-type detection on raw texture colour.
        // heuristic "water" and "ice" check, has to be tuned to texture colors
        float ir_eff   = 0.4; // near-ir albedo, overrides ir
        float temp_eff = 288.0; // surface temperature, overrides uniform
        float uv_eff   = 0.0;
 
 	// water test: also require "g>r" (or would pick purple), but texture doesn't seem to have any purple pixels
        if (rawColor.b > rawColor.g &&
            rawColor.b > 1.3 * rawColor.r) {
            // Water: near-IR albedo collapses to ocean value; uv stays small
            ir_eff = 0.02;
            uv_eff   = 0.07;
        } else if (rawColor.r > 0.6 &&
                   rawColor.g > 0.6 &&
                   rawColor.b > 0.6) {
            // Ice/snow: cooler blackbody temperature, boosted UV reflectivity
            // ir albedo depends on ice type, could be either side of the 0.4 baseline
            temp_eff = 250.0;
            uv_eff   = 0.6;
        }
 
        float p0R = planck(LR, T_star);
        float p0G = planck(LG, T_star);
        float p0B = planck(LB, T_star);
 
        float rR = reflectivity(LR*D, surfaceColor, ir_eff, uv_eff) * planck(LR, T_star*D) / p0R;
        float rG = reflectivity(LG*D, surfaceColor, ir_eff, uv_eff) * planck(LG, T_star*D) / p0G;
        float rB = reflectivity(LB*D, surfaceColor, ir_eff, uv_eff) * planck(LB, T_star*D) / p0B;
 
        float eR = planck(LR, temp_eff*D) / (dilution * p0R);
        float eG = planck(LG, temp_eff*D) / (dilution * p0G);
        float eB = planck(LB, temp_eff*D) / (dilution * p0B);
 
        gl_FragColor = vec4(rR + eR, rG + eG, rB + eB, vOpacity);
    }
`;

// MILKY WAY POINT CLOUD (color reconstructed from IR and optical brightness)
const milkyWayVertexShaderString = `
    attribute float size;
    attribute float brightnessIR;
    attribute float brightnessOpt;

    varying float vBrightnessIR;
    varying float vBrightnessOpt;
    varying float vDoppler;

    uniform float gamma;
    uniform float beta;
    uniform vec3  velocityDir;
    uniform float pixelRatio;
    uniform float fov;

    void main() {
        vec3  dir    = normalize(position);
        float radius = length(position); // 3d object
        vec3  finalPos;

        if (beta < 1e-8) {
            finalPos = position;
            vDoppler = 1.0;
        } else {
            float cosAlpha      = dot(dir, velocityDir);
            float denom         = 1.0 + beta * cosAlpha;
            float cosAlphaPrime = (cosAlpha + beta) / denom;
            float sinRatio      = 1.0 / (gamma * denom);

            vec3 newDir;
            if (sinRatio > 1e4) {
                newDir = sign(cosAlphaPrime) * velocityDir;
            } else {
                vec3 perp = dir - cosAlpha * velocityDir;
                newDir = cosAlphaPrime * velocityDir + sinRatio * perp;
            }
            finalPos = newDir * radius;
            vDoppler = gamma * (1.0 + beta * cosAlpha);
        }

        vBrightnessIR  = brightnessIR;
        vBrightnessOpt = brightnessOpt;

        vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
        gl_PointSize = size * (45.0 / fov) * pixelRatio * (300.0 / -mvPosition.z);
        gl_Position  = projectionMatrix * mvPosition;
    }
`;

const milkyWayFragmentShaderString = `
    varying float vBrightnessIR;
    varying float vBrightnessOpt;
    varying float vDoppler;

    uniform float tempOptical;
    uniform float tempIR;
    uniform float irBoost;

    uniform sampler2D tempLUT;
    const float LOG_T_MAX = 4.60517;
    vec4 tempLookup(float tempKK) {
        float logT = log(max(tempKK, 1.0)); // no upper clamp
        if (logT > LOG_T_MAX) {
            float t    = (logT - 3.497) / (4.605 - 3.497);
            float frac = mix(0.035, 0.0017, t);
            return vec4(0.298, 0.545, 0.973, max(frac, 0.0));
        }
        return texture2D(tempLUT, vec2(logT / LOG_T_MAX, 0.5));
    }

    void main() {
        vec2  center = gl_PointCoord - vec2(0.5);
        float dist   = length(center);
        if (dist > 0.5) discard;

        float D  = vDoppler;
        float D2 = D * D;
        float D4 = D2 * D2;

        // tempOptical is a uniform — tempLookup(tempOptical) is the same for all
        // fragments and will be cached by the GPU. Using it as denominator guarantees
        // exact cancellation at D=1, matching the star shader approach.
        float fRestOpt = tempLookup(tempOptical).a;

        vec4  lOpt = tempLookup(tempOptical * D);
        vec4  lIR  = tempLookup(tempIR  * D);

        float optContrib  = vBrightnessOpt * D4 * lOpt.a / fRestOpt;
        float irContrib   = vBrightnessIR  * D4 * lIR.a  * irBoost;
        float totalBright = optContrib + irContrib;

        vec3 col;
        if (totalBright > 1e-6) {
            col = (lOpt.rgb * optContrib + lIR.rgb * irContrib) / totalBright;
        } else {
            col = vec3(0.0);
        }
        col = mix(col, vec3(1.0), smoothstep(3.0, 8.0, totalBright));

        float softness = 1.0 - smoothstep(0.0, 1.0, dist);
        float alpha    = 0.02 * min(totalBright, 1.0) * softness;
        if (alpha < 0.001) discard;

        gl_FragColor = vec4(col, alpha);
    }
`;

// DEEP SKY OBJECTS  (galaxies/nebulae — ellipse UV profile + Doppler)
const deepSkyVertexString = `
    attribute float aObl;
    attribute float aRot;
    attribute float aDiff;
    attribute float aBaseOpacity;
    attribute float aTemp;
    attribute float aMag;
    attribute float aDiamDeg;

    varying vec2  vUV;
    varying vec3  vDir;
    varying float vObl;
    varying float vRot;
    varying float vDiff;
    varying float vBaseOpacity;
    varying float vTemp;
    varying float vMag;
    varying float vDiamDeg;

    uniform float gamma;
    uniform float beta;       // precomputed
    uniform vec3  velocityDir;

    // Full near-field aberration — used rather than far-field so that extended
    // objects distort consistently with their true angular size.
    vec3 aberrate(vec3 pos) {
        if (beta < 1e-8) return pos;
        float par  = dot(pos, velocityDir);
        vec3  posL = (pos - par * velocityDir) + (par / gamma) * velocityDir;
        vec3  v    = -beta * velocityDir;
        float a    = beta * beta - 1.0;
        float b    = -2.0 * dot(posL, v);
        float disc = b * b - 4.0 * a * dot(posL, posL);
        float dt   = (-b - sqrt(max(0.0, disc))) / (2.0 * a);
        return posL - v * dt;
    }

    void main() {
        vUV          = uv;
        vDir         = normalize(position);
        vObl         = aObl;
        vRot         = aRot;
        vDiff        = aDiff;
        vBaseOpacity = aBaseOpacity;
        vTemp        = aTemp;
        vMag         = aMag;
        vDiamDeg     = aDiamDeg;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(aberrate(position), 1.0);
    }
`;

const deepSkyFragmentString = `
    varying vec2  vUV;
    varying vec3  vDir;
    varying float vObl;
    varying float vRot;
    varying float vDiff;
    varying float vBaseOpacity;
    varying float vTemp;
    varying float vMag;
    varying float vDiamDeg;

    uniform float gamma;
    uniform float beta;       // precomputed
    uniform vec3  velocityDir;

    uniform sampler2D tempLUT;
    const float LOG_T_MAX = 4.60517;
    vec4 tempLookup(float tempKK) {
        float logT = log(max(tempKK, 1.0)); // no upper clamp
        if (logT > LOG_T_MAX) {
            float t    = (logT - 3.497) / (4.605 - 3.497);
            float frac = mix(0.035, 0.0017, t);
            return vec4(0.298, 0.545, 0.973, max(frac, 0.0));
        }
        return texture2D(tempLUT, vec2(logT / LOG_T_MAX, 0.5));
    }

    const float LOG10 = 2.302585093;

    float sbOpacity(float mag, float diamDeg, float obl, float diff) {
        float area = 4500.0 * diamDeg * diamDeg * obl * diff;
        float SB   = mag + 2.5 * log(max(area, 1e-6)) / LOG10;
        return clamp((16.0 - SB) / 18.0, 0.0, 1.0);
    }

    void main() {
        // Ellipse profile
        vec2  uv = vUV - 0.5;
        float c  = cos(vRot); float s = sin(vRot);
        vec2  r  = vec2(c*uv.x + s*uv.y, -s*uv.x + c*uv.y);
        float d  = length(vec2(r.x, r.y / vObl)) * 2.0;
        float profile = mix(exp(-d*d*5.0), 1.0 - smoothstep(0.82, 1.0, d), vDiff);

        vec3  col;
        float opacity;

        if (beta < 1e-8) {
            col     = tempLookup(vTemp).rgb;
            opacity = profile * vBaseOpacity;
        } else {
            float cosAlpha = dot(vDir, velocityDir);
            float D        = gamma * (1.0 + beta * cosAlpha);
            float D2       = D * D;
            float D4       = D2 * D2;
            float tempEff  = vTemp * D;

            vec4  rest           = tempLookup(vTemp);
            vec4  eff            = tempLookup(tempEff);
            float brightnessRatio = (rest.a > 1e-8) ? (D4 * eff.a / rest.a) : 1.0;
            float deltaMag       = -2.5 * log(max(brightnessRatio, 1e-10)) / LOG10;
            float effectiveMag   = vMag + deltaMag;

            float whiteoutT = smoothstep(100.0, 400.0, tempEff);
            float whiteoutB = smoothstep(-30.0, -50.0, effectiveMag);
            col = mix(eff.rgb, vec3(1.0), max(whiteoutT, whiteoutB));

            opacity = profile * sbOpacity(effectiveMag, vDiamDeg, vObl, vDiff);
        }

        gl_FragColor = vec4(col * profile + col * (1.0 - profile) * 0.3, opacity);
    }
`;

// CONSTELLATION LINES  (celestial sphere, aberration only)
const lineShaderString = `
    uniform float gamma;
    uniform float beta;       // precomputed
    uniform vec3  velocityDir;

    void main() {
        vec3  dir    = normalize(position);
        float radius = 90.9; // hardcoded to CELESTIAL_SPHERE_RADIUS * 1.01 = 90.9
        vec3  finalPos;

        if (beta < 1e-8) {
            finalPos = position;
        } else {
            float cosAlpha      = dot(dir, velocityDir);
            float denom         = 1.0 + beta * cosAlpha;
            float cosAlphaPrime = (cosAlpha + beta) / denom;
            float sinRatio      = 1.0 / (gamma * denom);

            vec3 newDir;
            if (sinRatio > 1e4) {
                newDir = sign(cosAlphaPrime) * velocityDir;
            } else {
                vec3 perp = dir - cosAlpha * velocityDir;
                newDir = cosAlphaPrime * velocityDir + sinRatio * perp;
            }
            finalPos = newDir * radius;
        }

        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
    }
`;


// COORDINATE GRID  (celestial sphere, per-vertex opacity)
const gridShaderString = `
    attribute float opacity;

    varying vec3  vColor;
    varying float vOpacity;

    uniform float gamma;
    uniform float beta;       // precomputed
    uniform vec3  velocityDir;

    void main() {
        vec3  dir    = normalize(position);
        float radius = 90.5; // hardcoded to CELESTIAL_SPHERE_RADIUS + 0.5 = 90.5
        vec3  finalPos;

        if (beta < 1e-8) {
            finalPos = position;
        } else {
            float cosAlpha      = dot(dir, velocityDir);
            float denom         = 1.0 + beta * cosAlpha;
            float cosAlphaPrime = (cosAlpha + beta) / denom;
            float sinRatio      = 1.0 / (gamma * denom);

            vec3 newDir;
            if (sinRatio > 1e4) {
                newDir = sign(cosAlphaPrime) * velocityDir;
            } else {
                vec3 perp = dir - cosAlpha * velocityDir;
                newDir = cosAlphaPrime * velocityDir + sinRatio * perp;
            }
            finalPos = newDir * radius;
        }

        vColor   = color;
        vOpacity = opacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
    }
`;

// LOCAL ORBITAL ELLIPSES  (near-field, Lorentz + light-travel, no Doppler)
const localShaderString = `
    varying vec3  vColor;
    varying float vOpacity;

    uniform float gamma;
    uniform float beta;          // precomputed
    uniform vec3  velocityDir;
    uniform vec3  objectPosition;
    uniform float fadeStart;
    uniform float fadeEnd;

    void main() {
        vec3 worldPos = position + objectPosition;
        vec3 finalPos;

        if (beta < 1e-8) {
            finalPos = worldPos;
        } else {
            float par  = dot(worldPos, velocityDir);
            vec3  posL = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;
            vec3  v    = -beta * velocityDir;
            float a    = beta * beta - 1.0;
            float b    = -2.0 * dot(posL, v);
            float c    = dot(posL, posL);
            float dt   = (-b - sqrt(max(0.0, b*b - 4.0*a*c))) / (2.0 * a);
            finalPos   = posL - v * dt;
        }

        float vertexDist = length(position);
        vOpacity = 0.6 * (1.0 - smoothstep(fadeStart, fadeEnd, vertexDist));
        vColor   = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
    }
`;

// SPACE GRID  (4 modes: none / Lorentz / Lorentz+travel / far-field)
const spaceGridShaderString = `
    varying vec3  vColor;
    varying float vOpacity;

    uniform vec3  gridOffset;
    uniform vec3  majorGridOffset;
    uniform vec3  velocityDir;
    uniform float gamma;
    uniform float beta;           // precomputed
    uniform float gridScaleAU;
    uniform float ratio;
    uniform int   mode;
    attribute float edgeAxis;

    const float GRID_SCALE_WORLD  = 10.0;
    const float MAJOR_SCALE_WORLD = 100.0;

    bool nearMajor(float pos, float majorOffset) {
        float d = pos - majorOffset;
        d = d - MAJOR_SCALE_WORLD * floor(d / MAJOR_SCALE_WORLD + 0.5);
        return abs(d) < 0.5;
    }

    void main() {
        bool isMajor;
        int  axis = int(edgeAxis);
        if      (axis == 0) isMajor = nearMajor(position.y + gridOffset.y, majorGridOffset.y)
                                   && nearMajor(position.z + gridOffset.z, majorGridOffset.z);
        else if (axis == 1) isMajor = nearMajor(position.x + gridOffset.x, majorGridOffset.x)
                                   && nearMajor(position.z + gridOffset.z, majorGridOffset.z);
        else                isMajor = nearMajor(position.x + gridOffset.x, majorGridOffset.x)
                                   && nearMajor(position.y + gridOffset.y, majorGridOffset.y);

        vColor = isMajor ? vec3(1.0, 1.0, 0.3) : vec3(1.0 - ratio * 0.07, 1.0, 0.3);

        vec3  worldPos = position + gridOffset;
        float radius   = length(worldPos);
        vec3  finalPos;

        if (mode == 0 || beta < 1e-8) {
            finalPos = worldPos;

        } else if (mode == 1) {
            // Lorentz contraction only
            float par = dot(worldPos, velocityDir);
            finalPos  = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;

        } else if (mode == 2) {
            // Lorentz + light travel
            float par  = dot(worldPos, velocityDir);
            vec3  posL = (worldPos - par * velocityDir) + (par / gamma) * velocityDir;
            vec3  v    = -beta * velocityDir;
            float a    = beta * beta - 1.0;
            float b    = -2.0 * dot(posL, v);
            float c    = dot(posL, posL);
            float dt   = (-b - sqrt(max(0.0, b*b - 4.0*a*c))) / (2.0 * a);
            finalPos   = posL - v * dt;

        } else {
            // mode 3: far-field angular aberration (celestial sphere)
            vec3  dir           = normalize(worldPos);
            float cosAlpha      = dot(dir, velocityDir);
            float denom         = 1.0 + beta * cosAlpha;
            float cosAlphaPrime = (cosAlpha + beta) / denom;
            float sinRatio      = 1.0 / (gamma * denom);

            vec3 newDir;
            if (sinRatio > 1e4) {
                newDir = sign(cosAlphaPrime) * velocityDir;
            } else {
                vec3 perp = dir - cosAlpha * velocityDir;
                newDir = cosAlphaPrime * velocityDir + sinRatio * perp;
            }
            finalPos = newDir * radius;
        }

        vOpacity = (isMajor ? 0.6 : (0.6 - ratio * 0.04))
                 * (1.0 - smoothstep(5.0, 25.0 + 12.5 * ratio, radius));

        // gridOffset is baked into worldPos for physics; remove it so modelViewMatrix
        // (which includes spaceGrid.position = gridOffset) restores it correctly.
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos - gridOffset, 1.0);
    }
`;



