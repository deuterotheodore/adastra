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
        fragmentShader: `varying vec3 vColor;varying float vOpacity;void main(){if(vOpacity<0.01)discard;gl_FragColor=vec4(vColor,vOpacity);}`,
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
		fragmentShader: `varying vec3 vColor;varying float vOpacity;void main(){gl_FragColor=vec4(vColor,vOpacity);}`,
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
		fragmentShader: `varying vec3 vColor;varying float vOpacity;void main(){if(vOpacity<0.01)discard;gl_FragColor=vec4(vColor,vOpacity);}`,
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
	        fragmentShader: `uniform float opacity;void main(){gl_FragColor=vec4(0.3,0.6,0.9,opacity);}`,
	        vertexColors: true,
		transparent: false,
		depthWrite: false,
		depthTest:   true,
		blending: THREE.AdditiveBlending
	    });

}

// STAR FIELD

const starVertexShaderString = `attribute float mag;attribute float temperature;varying vec3 vColor;varying float vAlpha;varying float vPointSize;varying float vFlareStrength;varying float vStarSize;uniform float pixelRatio;uniform float gamma;uniform float beta;uniform float flareLimit;uniform float gammaFlareFactor;uniform vec3 velocityDir;uniform float maglimit;uniform float fov;uniform sampler2D tempLUT;const float f=3.497;vec4 am(float al){float x=log(max(al,1e-4));if(x<0.0){float af=smoothstep(-0.5,0.0,x);return vec4(0.251,0.000,0.000,1e-8)*af;}if(x<=f){return texture2D(tempLUT,vec2(x/f,0.5));}float aj=(x-3.497)/(4.605-3.497);vec3 color=mix(vec3(0.337,0.592,1.000),vec3(0.298,0.545,0.973),aj);float v=mix(0.35,0.0017,aj);return vec4(color,max(v,0.0));}const float e=2.302585093;const float h=0.01;const float g=16.0;void main(){float q=max(-10.0,mag);float ah=0.25*(15.0-q);vec3 o=normalize(position);float ad=90.0;float l=dot(o,velocityDir);vec3 s=position;float t=0.0;float m=l;vFlareStrength=0.0;vStarSize=0.0;vAlpha=0.0;vColor=vec3(0.0);bool w=false;if(temperature>=0.01){float n=1.0+beta*l;m=(l+beta)/n;float ag=1.0/(gamma*n);vec3 aa;if(ag>1e4){aa=sign(m)*velocityDir;}else{vec3 ac=o-l*velocityDir;aa=m*velocityDir+ag*ac;}s=aa*ad;float b=gamma*(1.0+beta*l);float c=b*b;float d=c*c;float ak=temperature*b;vec4 p=am(ak);float ai=0.0;if(beta>1e-4){vec4 ae=am(temperature);float k=(ae.a>1e-8)?(d*p.a/ae.a):1.0;ai=2.5*log(max(k,1e-10))/e;}float ab=max(15.0-4.0*(ah+ai),-19.0);q=ab;float r=0.25*(15.0-ab);float y=(maglimit+3.5)/20.0;t=r*y*y*1500.0/fov/(ab+20.0);t=min(t,g);vAlpha=smoothstep(0.0,1.0,t);if(t<h){t=0.0;vAlpha=0.0;}float ao=smoothstep(100.0,400.0,ak);float an=smoothstep(3.0,-3.0,ab);vColor=mix(p.rgb,vec3(1.0),max(ao,an));}if(t>0.0&&vAlpha>0.0){float aj=clamp((flareLimit-q)/4.0,0.0,1.0);vFlareStrength=aj*gammaFlareFactor;if(m>0.985&&gamma>5.1-maglimit*0.4){float i=0.01+0.0015*maglimit;float j=max(0.985,1.0-i*gamma);if(j<m){w=true;}}}float u=vFlareStrength*5.0*t;if(w){vFlareStrength=-1.0;}vStarSize=t;vPointSize=max(t,u);vec4 z=modelViewMatrix*vec4(s,1.0);gl_PointSize=vPointSize*pixelRatio*(300.0/90.0);gl_Position=projectionMatrix*z;}`;

const starFragmentShaderString = `varying vec3 vColor;varying float vAlpha;varying float vPointSize;varying float vFlareStrength;varying float vStarSize;void main(){vec2 b=gl_PointCoord-vec2(0.5);float d=length(b);if(d>0.5)discard;float f=d*2.0;float h=clamp(vStarSize/max(vPointSize,0.001),0.05,1.0);float g=f/h;float c=1.0-smoothstep(0.1,0.6,g);float e=0.0;if(vFlareStrength<0.0){e=1.0;}else if(g>=0.05){e=vFlareStrength*exp(-f*4.0);}float a=vAlpha*clamp(c+e,0.0,1.0);gl_FragColor=vec4(vColor,a);}`;


// 3D STAR MESH  (nearby stars rendered as spheres, Lorentz + light-travel)
const starMeshVertexShaderString = `varying vec3 vColor;uniform float gamma;uniform float beta;uniform vec3 velocityDir;uniform vec3 starPosition;uniform float restTemperature;uniform sampler2D tempLUT;const float c=3.497;const float k=200.0;vec4 u(float t){float l=log(max(t,1e-4));if(l<0.0){float o=smoothstep(-0.5,0.0,l);return vec4(0.251,0.000,0.000,1e-8)*o;}if(l<=c){return texture2D(tempLUT,vec2(l/c,0.5));}float q=(l-3.497)/(4.605-3.497);vec3 color=mix(vec3(0.337,0.592,1.000),vec3(0.298,0.545,0.973),q);float j=mix(0.35,0.0017,q);return vec4(color,max(j,0.0));}void main(){vec3 y=position+starPosition;vec3 i;if(beta<1e-8){i=y;}else{float m=dot(y,velocityDir);vec3 n=(y-m*velocityDir)+(m/gamma)*velocityDir;vec3 v=-beta*velocityDir;float a=beta*beta-1.0;float d=-2.0*dot(n,v);float e=dot(n,n);float g=(-d-sqrt(max(0.0,d*d-4.0*a*e)))/(2.0*a);i=n-v*g;}float s;if(beta<1e-8){s=restTemperature;}else{vec3 w=normalize(i);float f=dot(w,velocityDir);float b=gamma*(1.0+beta*f);s=restTemperature*b;}vec4 h=u(s);float r=s*s;float p=r*r*h.a;float x=smoothstep(k,4.0*k,p);vColor=mix(h.rgb,vec3(1.0),x);gl_Position=projectionMatrix*modelViewMatrix*vec4(i,1.0);}`;
 
const starMeshFragmentShaderString = `varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}`;

// PLANET POINT  (reflected + thermal, Lorentz + light-travel)
const planetPointVertexString = `attribute vec3 color;attribute float aMagnitude;attribute float aIr;attribute vec3 orbitColor;uniform float beta;uniform float gamma;uniform vec3 velocityDir;uniform float maglimit;uniform float pixelRatio;uniform float flareLimit;uniform float gammaFlareFactor;uniform float fov;uniform float T_star;uniform sampler2D tempLUT;uniform bool showOrbits;varying vec3 vColor;varying float vAlpha;varying float vPointSize;varying float vFlareStrength;varying float vStarSize;const float h=4.60517;vec4 av(float au){float aa=log(max(au,1.0));if(aa>h){float ar=(aa-3.497)/(4.605-3.497);float x=mix(0.035,0.0017,ar);return vec4(0.298,0.545,0.973,max(x,0.0));}return texture2D(tempLUT,vec2(aa/h,0.5));}float aj(float z,float l){if(l<=0.0)return 0.0;float bb=1438.8/(z*l);if(bb>85.0)return 0.0;return 1.0/(pow(z,5.0)*(exp(bb)-1.0));}float am(float z,vec3 ao,float y){if(z<=300.0)return 0.0;if(z<=452.0)return ao.b*(z-300.0)/152.0;if(z<=525.0)return mix(ao.b,ao.g,(z-452.0)/73.0);if(z<=614.0)return mix(ao.g,ao.r,(z-525.0)/89.0);if(z<=1000.0)return mix(ao.r,y,(z-614.0)/386.0);return y;}const float f=2.302585093;const float k=0.1;const float j=16.0;vec3 az=vec3(0.0);vec3 m(vec3 ba){float ai=dot(ba,velocityDir);vec3 ak=(ba-ai*velocityDir)+(ai/gamma)*velocityDir;vec3 aw=-beta*velocityDir;float a=beta*beta-1.0;float b=-2.0*dot(ak,aw);float o=dot(ak,ak);float as=(-b-sqrt(max(0.0,b*b-4.0*a*o)))/(2.0*a);return ak-aw*as;}void main(){vec3 ba=position;vec3 u;az=normalize(ba);float p=dot(az,velocityDir);if(beta<1e-8){u=ba;}else{u=m(ba);}float c=(beta<1e-8)?1.0:gamma*(1.0+beta*p);float s=max(-10.0,aMagnitude);float ap=0.25*(15.0-s);float at=T_star*c;vec4 q=av(at);float aq=0.0;if(beta>1e-4){vec4 an=av(T_star);float n=(an.a>1e-8)?(c*c*c*c*q.a/an.a):1.0;aq=2.5*log(max(n,1e-10))/f;}float v=0.0;vFlareStrength=0.0;vStarSize=0.0;vAlpha=0.0;vColor=vec3(0.0);float ad=max(15.0-4.0*(ap+aq),-19.0);float t=0.25*(15.0-ad);float ab=(maglimit+3.5)/20.0;v=t*ab*ab*1500.0/fov/(ad+20.0);v=min(v,j);vAlpha=smoothstep(0.0,1.0,v);bool ae=false;if(ad>maglimit){if(showOrbits&&length(ba)<500.0&&length(orbitColor)>0.001){ae=true;vAlpha=1.0;}else{v=0.0;vAlpha=0.0;}}if(ae){vColor=orbitColor;}else{const float i=614.0;const float e=525.0;const float d=452.0;float ah=aj(i,T_star);float ag=aj(e,T_star);float af=aj(d,T_star);vec3 al=vec3(am(i*c,color,aIr)*aj(i,T_star*c)/ah,am(e*c,color,aIr)*aj(e,T_star*c)/ag,am(d*c,color,aIr)*aj(d,T_star*c)/af);float ay=smoothstep(100.0,400.0,at);float ax=smoothstep(3.0,-3.0,ad);vColor=mix(al,vec3(1.0),max(ay,ax));}if(!ae&&v>0.0&&vAlpha>0.0){float ar=clamp((flareLimit-ad)/4.0,0.0,1.0);vFlareStrength=ar*gammaFlareFactor;}float w=vFlareStrength*5.0*v;vStarSize=ae?-1.0:v;vPointSize=ae?6.0:max(v,w);vec4 ac=modelViewMatrix*vec4(u,1.0);gl_PointSize=ae?3.0*pixelRatio:vPointSize*pixelRatio*(300.0/90.0);gl_Position=projectionMatrix*ac;}`;
 
const planetPointFragmentString = `varying vec3 vColor;varying float vAlpha;varying float vPointSize;varying float vFlareStrength;varying float vStarSize;void main(){vec2 b=gl_PointCoord-vec2(0.5);float d=length(b);if(d>0.5)discard;if(vStarSize<0.0){float a=1.0-smoothstep(0.4,0.5,d);gl_FragColor=vec4(vColor,a);return;}float f=d*2.0;float h=clamp(vStarSize/max(vPointSize,0.001),0.05,1.0);float g=f/h;float c=1.0-smoothstep(0.1,0.6,g);float e=0.0;if(g>=0.05){e=vFlareStrength*exp(-f*3.5);}gl_FragColor=vec4(vColor,vAlpha*clamp(c+e,0.0,1.0));}`;

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

const planetVertexString = `varying vec3 vColor;varying float vOpacity;varying float vDoppler;varying vec2 vUv;uniform float gamma;uniform float beta;uniform vec3 velocityDir;uniform vec3 sunDir;uniform bool illum;uniform vec3 planetDir;uniform vec3 planetglow;uniform float eclipseFactor;vec3 b(vec3 q){float l=dot(q,velocityDir);vec3 m=(q-l*velocityDir)+(l/gamma)*velocityDir;vec3 p=-beta*velocityDir;float a=beta*beta-1.0;float c=-2.0*dot(m,p);float d=dot(m,m);float o=(-c-sqrt(max(0.0,c*c-4.0*a*d)))/(2.0*a);return m-p*o;}void main(){vUv=uv;vec3 q=(modelMatrix*vec4(position,1.0)).xyz;vec3 i;if(beta<1e-8){i=q;vDoppler=1.0;}else{i=b(q);float g=dot(normalize(q),velocityDir);vDoppler=1.0/(gamma*(1.0-beta*g));}vOpacity=1.0;if(illum){vec3 k=normalize(position);float f=max(0.0,dot(k,sunDir));float h=(eclipseFactor<0.0)?1.0:eclipseFactor;vec3 n=f*h*vec3(1.0);float e=max(0.0,dot(k,planetDir));vec3 j=e*planetglow;vColor=color*(n+j);}else{vColor=color;}gl_Position=projectionMatrix*viewMatrix*vec4(i,1.0);}`;

const planetFragmentString = `varying vec3 vColor;varying float vOpacity;varying float vDoppler;varying vec2 vUv;uniform float ir;uniform float temperature;uniform float dilution;uniform vec3 whiteout;uniform sampler2D planetTexture;uniform bool hasTexture;uniform sampler2D tempLUT;const float f=3.497;vec4 aj(float ai){float u=log(max(ai,1e-4));if(u<0.0){float ae=smoothstep(-0.5,0.0,u);return vec4(0.251,0.000,0.000,1e-8)*ae;}if(u<=f){return texture2D(tempLUT,vec2(u/f,0.5));}float ah=(u-3.497)/(4.605-3.497);vec3 color=mix(vec3(0.337,0.592,1.000),vec3(0.298,0.545,0.973),ah);float q=mix(0.35,0.0017,ah);return vec4(color,max(q,0.0));}float y(float t,float i){if(i<=0.0)return 0.0;float am=1.4388e7/(t*i);if(am>85.0)return 0.0;return 1.0/(pow(t,5.0)*(exp(am)-1.0));}float ad(float t,vec3 rgb,float s){if(t<=300.0)return 0.0;if(t<=452.0)return rgb.b*(t-300.0)/152.0;if(t<=525.0)return mix(rgb.b,rgb.g,(t-452.0)/73.0);if(t<=614.0)return mix(rgb.g,rgb.r,(t-525.0)/89.0);if(t<=1000.0)return mix(rgb.r,s,(t-614.0)/386.0);return s;}void main(){const float h=614.0;const float e=525.0;const float d=452.0;const float j=5800.0;const float k=5.8;vec3 ag=hasTexture?texture2D(planetTexture,vUv).rgb*vColor:vColor;ag=min(vec3(1.0),ag+whiteout);float c=vDoppler;float x=y(h,j);float w=y(e,j);float v=y(d,j);float ab=ad(h*c,ag,ir)*y(h,j*c)/x;float aa=ad(e*c,ag,ir)*y(e,j*c)/w;float z=ad(d*c,ag,ir)*y(d,j*c)/v;vec3 ac=vec3(ab,aa,z);float al=temperature/1000.0;float ak=al*c;vec4 n=aj(ak);float l=ak*ak*ak*ak;vec4 af=aj(k);float m=k*k*k*k;float o=(l*n.a)/(m*af.a*dilution);vec3 p=n.rgb*o;gl_FragColor=vec4(ac+p,vOpacity);}`;

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
const earthVertexString = `varying vec3 vColor;varying float vOpacity;varying float vDoppler;varying vec2 vUv;uniform float gamma;uniform float beta;uniform vec3 velocityDir;uniform vec3 sunDir;uniform bool illum;vec3 b(vec3 l){float h=dot(l,velocityDir);vec3 i=(l-h*velocityDir)+(h/gamma)*velocityDir;vec3 k=-beta*velocityDir;float a=beta*beta-1.0;float c=-2.0*dot(i,k);float d=dot(i,i);float j=(-c-sqrt(max(0.0,c*c-4.0*a*d)))/(2.0*a);return i-k*j;}void main(){vUv=uv;vec3 l=(modelMatrix*vec4(position,1.0)).xyz;vec3 g;if(beta<1e-8){g=l;vDoppler=1.0;}else{g=b(l);float f=dot(normalize(l),velocityDir);vDoppler=1.0/(gamma*(1.0-beta*f));}vOpacity=1.0;if(illum){float e=max(0.0,dot(normalize(position),sunDir));vColor=color*e;}else{vColor=color;}gl_Position=projectionMatrix*viewMatrix*vec4(g,1.0);}`;

const earthFragmentString = `varying vec3 vColor;varying float vOpacity;varying float vDoppler;varying vec2 vUv;uniform float ir;uniform float temperature;uniform float dilution;uniform vec3 whiteout;uniform sampler2D planetTexture;uniform bool hasTexture;float s(float n,float f){if(f<=0.0)return 0.0;float aa=1.4388e7/(n*f);if(aa>85.0)return 0.0;return 1.0/(pow(n,5.0)*(exp(aa)-1.0));}float x(float n,vec3 rgb,float m,float uv){if(n<=300.0)return uv;if(n<=452.0)return mix(uv,rgb.b,(n-300.0)/152.0);if(n<=525.0)return mix(rgb.b,rgb.g,(n-452.0)/73.0);if(n<=614.0)return mix(rgb.g,rgb.r,(n-525.0)/89.0);if(n<=1000.0)return mix(rgb.r,m,(n-614.0)/386.0);return m;}void main(){const float h=5800.0;const float e=614.0;const float d=525.0;const float c=452.0;vec3 w=hasTexture?texture2D(planetTexture,vUv).rgb:vColor;vec3 y=min(vec3(1.0),w*vColor+whiteout);float a=vDoppler;float l=0.4;float z=288.0;float uv_eff=0.0;if(w.b>w.g&&w.b>1.3*w.r){l=0.02;uv_eff=0.07;}else if(w.r>0.6&&w.g>0.6&&w.b>0.6){z=250.0;uv_eff=0.6;}float q=s(e,h);float p=s(d,h);float o=s(c,h);float v=x(e*a,y,l,uv_eff)*s(e,h*a)/q;float u=x(d*a,y,l,uv_eff)*s(d,h*a)/p;float t=x(c*a,y,l,uv_eff)*s(c,h*a)/o;float k=s(e,z*a)/(dilution*q);float j=s(d,z*a)/(dilution*p);float i=s(c,z*a)/(dilution*o);gl_FragColor=vec4(v+k,u+j,t+i,vOpacity);}`;

// MILKY WAY POINT CLOUD (color reconstructed from IR and optical brightness)
const milkyWayVertexShaderString = `attribute float size;attribute float brightnessIR;attribute float brightnessOpt;varying float vBrightnessIR;varying float vBrightnessOpt;varying float vDoppler;uniform float gamma;uniform float beta;uniform vec3 velocityDir;uniform float pixelRatio;uniform float fov;void main(){vec3 d=normalize(position);float i=length(position);vec3 e;if(beta<1e-8){e=position;vDoppler=1.0;}else{float a=dot(d,velocityDir);float c=1.0+beta*a;float b=(a+beta)/c;float j=1.0/(gamma*c);vec3 g;if(j>1e4){g=sign(b)*velocityDir;}else{vec3 h=d-a*velocityDir;g=b*velocityDir+j*h;}e=g*i;vDoppler=gamma*(1.0+beta*a);}vBrightnessIR=brightnessIR;vBrightnessOpt=brightnessOpt;vec4 f=modelViewMatrix*vec4(e,1.0);gl_PointSize=size*(45.0/fov)*pixelRatio*(300.0/-f.z);gl_Position=projectionMatrix*f;}`;

const milkyWayFragmentShaderString = `varying float vBrightnessIR;varying float vBrightnessOpt;varying float vDoppler;uniform float tempOptical;uniform float tempIR;uniform float irBoost;uniform sampler2D tempLUT;const float e=4.60517;vec4 t(float s){float o=log(max(s,1.0));if(o>e){float r=(o-3.497)/(4.605-3.497);float k=mix(0.035,0.0017,r);return vec4(0.298,0.545,0.973,max(k,0.0));}return texture2D(tempLUT,vec2(o/e,0.5));}void main(){vec2 g=gl_PointCoord-vec2(0.5);float i=length(g);if(i>0.5)discard;float b=vDoppler;float c=b*b;float d=c*c;float j=t(tempOptical).a;vec4 n=t(tempOptical*b);vec4 m=t(tempIR*b);float p=vBrightnessOpt*d*n.a/j;float l=vBrightnessIR*d*m.a*irBoost;float u=p+l;vec3 h;if(u>1e-6){h=(n.rgb*p+m.rgb*l)/u;}else{h=vec3(0.0);}h=mix(h,vec3(1.0),smoothstep(3.0,8.0,u));float q=1.0-smoothstep(0.0,1.0,i);float f=0.02*min(u,1.0)*q;if(f<0.001)discard;gl_FragColor=vec4(h,f);}`;

// DEEP SKY OBJECTS  (galaxies/nebulae — ellipse UV profile + Doppler)
const deepSkyVertexString = `attribute float aObl;attribute float aRot;attribute float aDiff;attribute float aBaseOpacity;attribute float aTemp;attribute float aMag;attribute float aDiamDeg;varying vec2 vUV;varying vec3 vDir;varying float vObl;varying float vRot;varying float vDiff;varying float vBaseOpacity;varying float vTemp;varying float vMag;varying float vDiamDeg;uniform float gamma;uniform float beta;uniform vec3 velocityDir;vec3 b(vec3 g){if(beta<1e-8)return g;float f=dot(g,velocityDir);vec3 h=(g-f*velocityDir)+(f/gamma)*velocityDir;vec3 i=-beta*velocityDir;float a=beta*beta-1.0;float c=-2.0*dot(h,i);float d=c*c-4.0*a*dot(h,h);float e=(-c-sqrt(max(0.0,d)))/(2.0*a);return h-i*e;}void main(){vUV=uv;vDir=normalize(position);vObl=aObl;vRot=aRot;vDiff=aDiff;vBaseOpacity=aBaseOpacity;vTemp=aTemp;vMag=aMag;vDiamDeg=aDiamDeg;gl_Position=projectionMatrix*modelViewMatrix*vec4(b(position),1.0);}`;

const deepSkyFragmentString = `varying vec2 vUV;varying vec3 vDir;varying float vObl;varying float vRot;varying float vDiff;varying float vBaseOpacity;varying float vTemp;varying float vMag;varying float vDiamDeg;uniform float gamma;uniform float beta;uniform vec3 velocityDir;uniform sampler2D tempLUT;const float f=4.60517;vec4 ah(float ag){float t=log(max(ag,1.0));if(t>f){float ae=(t-3.497)/(4.605-3.497);float s=mix(0.035,0.0017,ae);return vec4(0.298,0.545,0.973,max(s,0.0));}return texture2D(tempLUT,vec2(t/f,0.5));}const float e=2.302585093;float ad(float u,float o,float v,float p){float h=4500.0*o*o*v*p;float g=u+2.5*log(max(h,1e-6))/e;return clamp((16.0-g)/18.0,0.0,1.0);}void main(){vec2 uv=vUV-0.5;float j=cos(vRot);float ac=sin(vRot);vec2 aa=vec2(j*uv.x+ac*uv.y,-ac*uv.x+j*uv.y);float m=length(vec2(aa.x,aa.y/vObl))*2.0;float z=mix(exp(-m*m*5.0),1.0-smoothstep(0.82,1.0,m),vDiff);vec3 k;float w;if(beta<1e-8){k=ah(vTemp).rgb;w=z*vBaseOpacity;}else{float l=dot(vDir,velocityDir);float b=gamma*(1.0+beta*l);float c=b*b;float d=c*c;float af=vTemp*b;vec4 ab=ah(vTemp);vec4 q=ah(af);float i=(ab.a>1e-8)?(d*q.a/ab.a):1.0;float n=-2.5*log(max(i,1e-10))/e;float r=vMag+n;float aj=smoothstep(100.0,400.0,af);float ai=smoothstep(-30.0,-50.0,r);k=mix(q.rgb,vec3(1.0),max(aj,ai));w=z*ad(r,vDiamDeg,vObl,vDiff);}gl_FragColor=vec4(k*z+k*(1.0-z)*0.3,w);}`;

// CONSTELLATION LINES  (celestial sphere, aberration only)
const lineShaderString = `uniform float gamma;uniform float beta;uniform vec3 velocityDir;void main(){vec3 d=normalize(position);float h=90.9;vec3 e;if(beta<1e-8){e=position;}else{float a=dot(d,velocityDir);float c=1.0+beta*a;float b=(a+beta)/c;float i=1.0/(gamma*c);vec3 f;if(i>1e4){f=sign(b)*velocityDir;}else{vec3 g=d-a*velocityDir;f=b*velocityDir+i*g;}e=f*h;}gl_Position=projectionMatrix*modelViewMatrix*vec4(e,1.0);}`;


// COORDINATE GRID  (celestial sphere, per-vertex opacity)
const gridShaderString = `attribute float opacity;varying vec3 vColor;varying float vOpacity;uniform float gamma;uniform float beta;uniform vec3 velocityDir;void main(){vec3 d=normalize(position);float h=90.5;vec3 e;if(beta<1e-8){e=position;}else{float a=dot(d,velocityDir);float c=1.0+beta*a;float b=(a+beta)/c;float i=1.0/(gamma*c);vec3 f;if(i>1e4){f=sign(b)*velocityDir;}else{vec3 g=d-a*velocityDir;f=b*velocityDir+i*g;}e=f*h;}vColor=color;vOpacity=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(e,1.0);}`;

// LOCAL ORBITAL ELLIPSES  (near-field, Lorentz + light-travel, no Doppler)
const localShaderString = `varying vec3 vColor;varying float vOpacity;uniform float gamma;uniform float beta;uniform vec3 velocityDir;uniform vec3 objectPosition;uniform float fadeStart;uniform float fadeEnd;void main(){vec3 j=position+objectPosition;vec3 e;if(beta<1e-8){e=j;}else{float f=dot(j,velocityDir);vec3 g=(j-f*velocityDir)+(f/gamma)*velocityDir;vec3 h=-beta*velocityDir;float a=beta*beta-1.0;float b=-2.0*dot(g,h);float c=dot(g,g);float d=(-b-sqrt(max(0.0,b*b-4.0*a*c)))/(2.0*a);e=g-h*d;}float i=length(position);vOpacity=0.6*(1.0-smoothstep(fadeStart,fadeEnd,i));vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(e,1.0);}`;

// SPACE GRID  (4 modes: none / Lorentz / Lorentz+travel / far-field)
const spaceGridShaderString = `varying vec3 vColor;varying float vOpacity;uniform vec3 gridOffset;uniform vec3 majorGridOffset;uniform vec3 velocityDir;uniform float gamma;uniform float beta;uniform float gridScaleAU;uniform float ratio;uniform int mode;attribute float edgeAxis;const float a=10.0;const float b=100.0;bool p(float t,float o){float i=t-o;i=i-b*floor(i/b+0.5);return abs(i)<0.5;}void main(){bool n;int d=int(edgeAxis);if(d==0)n=p(position.y+gridOffset.y,majorGridOffset.y)&&p(position.z+gridOffset.z,majorGridOffset.z);else if(d==1)n=p(position.x+gridOffset.x,majorGridOffset.x)&&p(position.z+gridOffset.z,majorGridOffset.z);else n=p(position.x+gridOffset.x,majorGridOffset.x)&&p(position.y+gridOffset.y,majorGridOffset.y);vColor=n?vec3(1.0,1.0,0.3):vec3(1.0-ratio*0.07,1.0,0.3);vec3 ab=position+gridOffset;float v=length(ab);vec3 m;if(mode==0||beta<1e-8){m=ab;}else if(mode==1){float r=dot(ab,velocityDir);m=(ab-r*velocityDir)+(r/gamma)*velocityDir;}else if(mode==2){float r=dot(ab,velocityDir);vec3 u=(ab-r*velocityDir)+(r/gamma)*velocityDir;vec3 aa=-beta*velocityDir;float c=beta*beta-1.0;float e=-2.0*dot(u,aa);float f=dot(u,u);float l=(-e-sqrt(max(0.0,e*e-4.0*c*f)))/(2.0*c);m=u-aa*l;}else{vec3 k=normalize(ab);float g=dot(k,velocityDir);float j=1.0+beta*g;float h=(g+beta)/j;float w=1.0/(gamma*j);vec3 q;if(w>1e4){q=sign(h)*velocityDir;}else{vec3 s=k-g*velocityDir;q=h*velocityDir+w*s;}m=q*v;}vOpacity=(n?0.6:(0.6-ratio*0.04))*(1.0-smoothstep(5.0,25.0+12.5*ratio,v));gl_Position=projectionMatrix*modelViewMatrix*vec4(m-gridOffset,1.0);}`;



