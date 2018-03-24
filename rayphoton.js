let debug = false;

const EPSILON = 1e-6;
const LITTLE_SPACE = 1e-3;	// let's leave room between things, e.g., don't put them right on the floor. Used automatically in object constructors, not primitives: e.g., use Ball instead of Sphere
const MAX_TRACE_DIST = 5;
const MAX_DEPTH = 20;
const SUB_SAMPLE = 1;   // split each pixel into virtual SUB_SAMPLE × SUB_SAMPLE grid, then average results.
const SUPER_SAMPLE_BASE = 4; // to get approximate picture at first, but total rendering time is around SSB / (SSB - 1) times longer than if we just started at 1:1 size
const NUM_PHOTONS_DIFFUSE = 10000;
const NUM_PHOTONS_CAUSTIC = 10000;
const LIGHT_PATHS_PER_SOURCE_PER_RAY = 1;	// normally keep this at 1 since it is redundant with subsampling. Shoot this many paths towards light sources for direct lighting; in practice it doesn't offer real benefits, just slows down
const CAUSTIC_RADIUS = 0.25;
const DIFFUSE_RADIUS = 0.25;
const CAUSTIC_AREA = Math.PI * CAUSTIC_RADIUS ** 2;
const DIFFUSE_AREA = Math.PI * DIFFUSE_RADIUS ** 2;

// --------------------------------
//            colours
// --------------------------------
const COL_BLACK = { r: 0, g: 0, b: 0, a: 0 };
const COL_WHITE = { r: 255, g: 255, b: 255, a: 1 };
const COL_DARK_GREY = { r: 64, g: 64, b: 64, a: 1 };
const COL_VERY_DARK_GREY = { r: 16, g: 16, b: 16, a: 1 };
const COL_GREY = { r: 128, g: 128, b: 128, a: 1 };
const COL_SILVER = { r: 192, g: 192, b: 192, a: 1 };
const COL_RED = { r: 192, g: 0, b: 0, a: 1 };
const COL_MAUVE = { r: 64, g: 32, b: 112, a: 1 };
const COL_DEEP_BLUE = { r: 8, g: 8, b: 64, a: 1 };
const COL_SKY_BLUE = { r: 128, g: 128, b: 224, a: 1 };
const COL_WARM_GREY = { r: 144, g: 128, b: 128, a: 1 };
const COL_ORANGE_ORANGE = { r: 224, g: 124, b: 32 };
const COL_GRAPEFRUIT_YELLOW = { r: 248, g: 210, b: 112 };
const COL_LIME_GREEN = { r: 112, g: 160, b: 0, a: 1 };
const COL_ROBINS_EGG_BLUE = { r: 0, g: 180, b: 180, a: 1 };
const COL_DEEP_PINK = { r: 255, g: 32, b: 144, a: 1 };
const COL_COPPER = { r: 174, g: 105, b: 56, a: 1 };
const COL_ENGLISH_WALNUT = { r: 68, g: 48, b: 40, a: 1 };

// --------------------------------
//            materials
// --------------------------------
const MAT_AIR = 0;
const MAT_GLASS = 1;
const MAT_WATER = 2;
const MAT_MIRROR = 3;
const MAT_COPPER = 4;
const MAT_LINOLEUM = 5;
const MAT_PLASTER = 6;
const MAT_SPECTRALON = 7;
// --------------------------------
// materials: transparency (i.e., use refraction or not)
// --------------------------------
const matTransparent = [];
matTransparent[MAT_AIR] = true;
matTransparent[MAT_GLASS] = true;
matTransparent[MAT_WATER] = true;
matTransparent[MAT_MIRROR] = false;
matTransparent[MAT_COPPER] = false;
matTransparent[MAT_LINOLEUM] = false;
matTransparent[MAT_PLASTER] = false;
matTransparent[MAT_SPECTRALON] = false;
// --------------------------------
// materials: indices of refraction
// --------------------------------
const matRefrIndex = [];
matRefrIndex[MAT_AIR] = 1.0;
matRefrIndex[MAT_GLASS] = 1.5;
matRefrIndex[MAT_WATER] = 1.33;
// --------------------------------
// materials: reflectance for opaque materials
// --------------------------------
const matReflectance = [];
matReflectance[MAT_MIRROR] = 1;
matReflectance[MAT_COPPER] = 0.7;
matReflectance[MAT_LINOLEUM] = 0.6;
matReflectance[MAT_PLASTER] = 0.3;
matReflectance[MAT_SPECTRALON] = 1;
// --------------------------------
// materials: specular (as fraction of reflectance; remainder is Lambertian, i.e., diffuse)
// --------------------------------
// Lambertian diffusion: choose random vector in hemisphere around normal
// to do: add glossy diffusion, i.e., perturb reflected angle by some amount (depending on material)
const matSpecular = [];
matSpecular[MAT_MIRROR] = 1;
matSpecular[MAT_COPPER] = 0.5;
matSpecular[MAT_LINOLEUM] = 0.2;
matSpecular[MAT_PLASTER] = 0;
matSpecular[MAT_SPECTRALON] = 0;

function vecPlus(v, w) { return [v[0] + w[0], v[1] + w[1], v[2] + w[2]]; }
function vecMinus(v, w) { return[v[0] - w[0], v[1] - w[1], v[2] - w[2]]; }
function vecScalar(k, v) { return [k * v[0], k * v[1], k * v[2]]; }
function vecDot(v, w) { return v[0] * w[0] + v[1] * w[1] + v[2] * w[2]; }
function vecCross(v, w) { return [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]]; }
function vecIsZero(v) { return vecSqLength(v) < EPSILON; }
function vecNormalize(v) { return vecIsZero(v) ? [0, 0, 1] : vecScalar(1 / vecLength(v), v); }
function vecSqLength(v) { return vecDot(v, v); }
function vecLength(v) { return Math.sqrt(vecSqLength(v)); }
function vecOrthonormal(v) {  // given v, return [m, n] where [m, n, v] are mutually orthogonal and ||m|| = ||n|| = 1
  let v2 = vecNormalize(v);
	let m = [1, 0, 0];	// pick any m not parallel to v, use it to make n, then redefine m
	if (vecIsZero(vecCross(v2, m))) {
		m = [0, 1, 0];
	}
	let n = vecCross(v2, m);
  m = vecCross(n, v2);
  return [m, n];
}
function vecPerturb(v, maxDeviation) {	// create random vector chosen around v with angle less than deviation	
	let lowerBound = 0;
	if (maxDeviation != undefined) {
		lowerBound = Math.cos(maxDeviation) ** 2;
	}

  let [m, n] = vecOrthonormal(v);	
	let x = (1 - lowerBound) * Math.random() + lowerBound;
	
	let cosTheta = Math.sqrt(x);
	let sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
	let phi = 2 * Math.PI * Math.random();

	return vecPlus(vecPlus(vecScalar(cosTheta, v), vecScalar(sinTheta * Math.cos(phi), m)), vecScalar(sinTheta * Math.sin(phi), n));
}

function clamp(x, min, max) { return (x < min) ? min : ((x > max) ? max : x); }
function colour(col) { return { r: clamp(col.r, 0, 255), g: clamp(col.g, 0, 255), b: clamp(col.b, 0, 255), a: clamp(col.a, 0, 1) } };

class Box {		// actually a parallelepiped
	constructor(shapes, vtxA, edgeAB, edgeAC, edgeAD, baseColour, material) {
		let adjVtxA = vecPlus(vecPlus(vecPlus(vtxA, vecScalar(LITTLE_SPACE, vecNormalize(edgeAB))),
																								vecScalar(LITTLE_SPACE, vecNormalize(edgeAC))),
																								vecScalar(LITTLE_SPACE, vecNormalize(edgeAD)));
		let adjEdgeAB = vecMinus(edgeAB, vecScalar(2 * LITTLE_SPACE, vecNormalize(edgeAB)));
		let adjEdgeAC = vecMinus(edgeAC, vecScalar(2 * LITTLE_SPACE, vecNormalize(edgeAC)));
		let adjEdgeAD = vecMinus(edgeAD, vecScalar(2 * LITTLE_SPACE, vecNormalize(edgeAD)));
		let oppVtx = vecPlus(vecPlus(vecPlus(adjVtxA, adjEdgeAB), adjEdgeAC), adjEdgeAD);
		let adjEdgeBA = vecScalar(-1, adjEdgeAB);
		let adjEdgeCA = vecScalar(-1, adjEdgeAC);
		let adjEdgeDA = vecScalar(-1, adjEdgeAD);

		shapes.push(new Square(adjVtxA, adjEdgeAC, adjEdgeAB, baseColour, material));
		shapes.push(new Square(adjVtxA, adjEdgeAD, adjEdgeAC, baseColour, material));
		shapes.push(new Square(adjVtxA, adjEdgeAB, adjEdgeAD, baseColour, material));
		shapes.push(new Square(oppVtx, adjEdgeBA, adjEdgeCA, baseColour, material));
		shapes.push(new Square(oppVtx, adjEdgeCA, adjEdgeDA, baseColour, material));
		shapes.push(new Square(oppVtx, adjEdgeDA, adjEdgeBA, baseColour, material));
	}
}

class Prism {		// triangular prism: ABC is triangle; square base in ABD plane
	constructor(shapes, vtxA, edgeAB, edgeAC, edgeAD, baseColour, material) {
		let adjVtxA = vecPlus(vecPlus(vecPlus(vtxA, vecScalar(LITTLE_SPACE, vecNormalize(edgeAB))),
																								vecScalar(LITTLE_SPACE, vecNormalize(edgeAC))),
																								vecScalar(LITTLE_SPACE, vecNormalize(edgeAD)));
		let adjEdgeAB = vecMinus(edgeAB, vecScalar(2 * LITTLE_SPACE, vecNormalize(edgeAB)));
		let adjEdgeAC = vecMinus(edgeAC, vecScalar(2 * LITTLE_SPACE, vecNormalize(edgeAC)));
		let adjEdgeAD = vecMinus(edgeAD, vecScalar(2 * LITTLE_SPACE, vecNormalize(edgeAD)));
		let oppVtx = vecPlus(vecPlus(adjVtxA, adjEdgeAC), adjEdgeAD);
		let adjEdgeCA = vecScalar(-1, adjEdgeAC);
		let adjEdgeCB = vecPlus(adjEdgeCA, adjEdgeAB);
		let adjEdgeDA = vecScalar(-1, adjEdgeAD);

		shapes.push(new Triangle(adjVtxA, adjEdgeAC, adjEdgeAB, baseColour, material));
		shapes.push(new Square(adjVtxA, adjEdgeAD, adjEdgeAC, baseColour, material));
		shapes.push(new Square(adjVtxA, adjEdgeAB, adjEdgeAD, baseColour, material));
		shapes.push(new Triangle(oppVtx, adjEdgeCA, adjEdgeCB, baseColour, material));
		shapes.push(new Square(oppVtx, adjEdgeCB, adjEdgeDA, baseColour, material));
	}
}

class Cuboctahedron {		// start with cube, cut off corners (which is why A is called chopped vertex; B, C, D are also chopped)
	constructor(shapes, choppedVtxA, edgeAB, edgeAC, edgeAD, baseColourSquare, baseColourTriangle, material) {
		let adjVtxA = vecPlus(vecPlus(vecPlus(choppedVtxA, vecScalar(LITTLE_SPACE, vecNormalize(edgeAB))),
																											 vecScalar(LITTLE_SPACE, vecNormalize(edgeAC))),
																											 vecScalar(LITTLE_SPACE, vecNormalize(edgeAD)));
		// create 12 vertices: combinations of up/down, nesw; A is down south west.
		let ds = vecPlus(adjVtxA, vecScalar(0.5 - LITTLE_SPACE / vecLength(edgeAB), edgeAB));
		let dw = vecPlus(adjVtxA, vecScalar(0.5 - LITTLE_SPACE / vecLength(edgeAC), edgeAC));
		let dn = vecPlus(ds, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAC), edgeAC));
		let de = vecPlus(dw, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAB), edgeAB));

		let sw = vecPlus(adjVtxA, vecScalar(0.5 - LITTLE_SPACE / vecLength(edgeAD), edgeAD));
		let nw = vecPlus(sw, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAC), edgeAC));
		let ne = vecPlus(nw, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAB), edgeAB));
		let se = vecPlus(sw, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAB), edgeAB));
		
		let un = vecPlus(dn, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAD), edgeAD));
		let ue = vecPlus(de, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAD), edgeAD));
		let us = vecPlus(ds, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAD), edgeAD));
		let uw = vecPlus(dw, vecScalar(1 - 2 * LITTLE_SPACE / vecLength(edgeAD), edgeAD));

		shapes.push(new Square(ds, vecMinus(dw, ds), vecMinus(de, ds), baseColourSquare, material));
		shapes.push(new Square(ne, vecMinus(dn, ne), vecMinus(un, ne), baseColourSquare, material));
		shapes.push(new Square(se, vecMinus(de, se), vecMinus(ue, se), baseColourSquare, material));
		shapes.push(new Square(sw, vecMinus(ds, sw), vecMinus(us, sw), baseColourSquare, material));
		shapes.push(new Square(nw, vecMinus(dw, nw), vecMinus(uw, nw), baseColourSquare, material));
		shapes.push(new Square(us, vecMinus(ue, us), vecMinus(uw, us), baseColourSquare, material));
	
		shapes.push(new Triangle(dn, vecMinus(ne, dn), vecMinus(de, dn), baseColourTriangle, material));
		shapes.push(new Triangle(de, vecMinus(se, de), vecMinus(ds, de), baseColourTriangle, material));
		shapes.push(new Triangle(ds, vecMinus(sw, ds), vecMinus(dw, ds), baseColourTriangle, material));
		shapes.push(new Triangle(dw, vecMinus(nw, dw), vecMinus(dn, dw), baseColourTriangle, material));
		shapes.push(new Triangle(un, vecMinus(ue, un), vecMinus(ne, un), baseColourTriangle, material));
		shapes.push(new Triangle(ue, vecMinus(us, ue), vecMinus(se, ue), baseColourTriangle, material));
		shapes.push(new Triangle(us, vecMinus(uw, us), vecMinus(sw, us), baseColourTriangle, material));
		shapes.push(new Triangle(uw, vecMinus(un, uw), vecMinus(nw, uw), baseColourTriangle, material));
	}
}

class Ball {	// normally use this instead of Sphere (to leave a LITTLE_SPACE)
	constructor(shapes, centre, radius, baseColour, material) {
		shapes.push(new Sphere(centre, radius - LITTLE_SPACE, baseColour, material));
	}
}

class Halfball {	// normalDir points away from hemisphere direction (so disc is on top)
	constructor(shapes, centre, radius, normalDir, truncateMin, truncateMax, baseColour, material) {
		let adjTrMin = (truncateMin == undefined) ? LITTLE_SPACE : truncateMin + LITTLE_SPACE;
		let adjTrMax = (truncateMax == undefined) ? undefined : truncateMax - LITTLE_SPACE;
		shapes.push(new Hemisphere(centre, radius - LITTLE_SPACE, vecScalar(-1, normalDir), adjTrMin, adjTrMax, true, baseColour, material));
		shapes.push(new Disc(vecPlus(centre, vecScalar(-1 * adjTrMin, vecNormalize(normalDir))), Math.sqrt((radius - LITTLE_SPACE) ** 2 - adjTrMin ** 2), normalDir, baseColour, material));
		if (truncateMax < radius) {  // possibly add cap on other end
			shapes.push(new Disc(vecPlus(centre, vecScalar(-1 * adjTrMax, vecNormalize(normalDir))), Math.sqrt((radius - LITTLE_SPACE) ** 2 - adjTrMax ** 2), vecScalar(-1, normalDir), baseColour, material));
		}
	}
}

class Bowl {	// normalDir points in direction of rim
	// to do: add truncate; see Halfball
	constructor(shapes, centre, outerRadius, innerRadius, normalDir, baseColour, material) {
		shapes.push(new Hemisphere(centre, outerRadius - LITTLE_SPACE, vecScalar(-1, normalDir), 0, undefined, true, baseColour, material));
		shapes.push(new Hemisphere(centre, innerRadius + LITTLE_SPACE, vecScalar(-1, normalDir), 0, undefined, false, baseColour, material));
		shapes.push(new Annulus(centre, outerRadius - LITTLE_SPACE, innerRadius + LITTLE_SPACE, normalDir, baseColour, material));
	}
}

class Spotlight {
	// to do: * add other kinds of lamps
	//				* account for colour
	constructor(shapes, lights, centre, radius, dir, wattage, colour) {
		//new Bowl(shapes, centre, 1.3 * radius, 1.125 * radius, dir, COL_COPPER, MAT_PLASTER);		// 1.125 is slightly bigger than sqrt(5)/2, to make sure that light (Which is set back by 0.5 * radius) fits inside
		new Bowl(shapes, centre, 1.3 * radius, 1.125 * radius, dir, COL_COPPER, MAT_COPPER);		// 1.125 is slightly bigger than sqrt(5)/2, to make sure that light (Which is set back by 0.5 * radius) fits inside
		let s = shapes.push(new Disc(vecPlus(centre, vecScalar(-0.5 * radius, vecNormalize(dir))), radius, dir));
		lights.push(s - 1);	// store index of light shape so that we can easily find all lights later
		shapes[s - 1].isLight = true;
    shapes[s - 1].wattage = wattage;
		shapes[s - 1].lightColour = colour || COL_WHITE;
		shapes[s - 1].area = Math.PI * radius ** 2;
	}
}

// --------------------------------
//           primitives
// objects in Shape class are exact
// (i.e., they don't use LITTLE_SPACE)
// --------------------------------
class Shape {
	constructor() {
		this.baseColour = COL_DARK_GREY;
	}
	set material(mat) {
		this._material = mat;
		this.transparent = matTransparent[mat];
		this.refrIndex = matRefrIndex[mat];
		this.reflectance = matReflectance[mat];
		this.specular = matSpecular[mat];
		this.isLight = false;
	}
	get material() {
		console.log(`don't try to access an object's materials; instead access its properties (reflectance, etc.)`)
	}
	colour() { return this.baseColour; }
}

class Cylinder extends Shape {
	// to do: make Band primitive that is Cylinder with limited height; make Tube, Cup, and Can forms (cylinder with 0, 1, 2 caps resp.)
  constructor(centre, axis, height, radius, baseColour, material) {
		super();
		
		this.type = 'cylinder';
		this.centre = centre;
		this.axis = vecNormalize(axis);
		this.height = height;
		this.radius = radius;
		this.baseColour = baseColour || COL_WHITE;
		this.material = material;
	}
    
  normal(p) {
		let v = vecMinus(p, this.centre);
		return vecScalar(1 / this.radius, vecMinus(v, vecScalar(vecDot(v, this.axis), this.axis)) );
	}
}

class Sphere extends Shape {
	constructor(centre, radius, baseColour, material) {
		super();

		this.type = 'sphere';
		this.centre = centre;
		this.radius = radius;
		this.baseColour = baseColour || COL_RED;
		this.material = material;
	}

	normal(p) { return vecScalar(1 / this.radius, vecMinus(p, this.centre)); }
}

class Hemisphere extends Shape {	// normalDir points towards half that exists; truncate is minimum distance along normal
	constructor(centre, radius, normalDir, truncateMin, truncateMax, convex, baseColour, material) {
		super();

		this.type = 'hemisphere';
		this.centre = centre;
		this.radius = radius;
		this.normalDir = vecNormalize(normalDir);
		this.truncateMin = truncateMin;
		this.truncateMax = truncateMax;
		this.convex = convex;	// if true, surface points away from centre
		this.baseColour = baseColour || COL_RED;
		this.material = material;
	}

	normal(p) { return vecScalar((this.convex ? 1 : -1) / this.radius, vecMinus(p, this.centre)); }
}

class Plane extends Shape {
	constructor(origin, normalDir, baseColour, material) {
		super();

		this.type = 'plane';
		this.origin = origin;
		this.normalDir = vecNormalize(normalDir);
		this.baseColour = baseColour || COL_DEEP_BLUE;
		this.material = material;
	}

	normal() { return this.normalDir; }
}

class Triangle extends Shape {
	constructor(vtxA, edgeAB, edgeAC, baseColour, material) {
		super();

		this.type = 'triangle';
		this.vtxA = vtxA;
		this.edgeAB = edgeAB;
		this.edgeAC = edgeAC;
		this.normalDir = vecNormalize(vecCross(this.edgeAB, this.edgeAC));
		this.baseColour = baseColour || COL_LIME_GREEN;
		this.material = material;
	}

	normal() { return this.normalDir; }
}

class Square extends Shape {	// actually a parallelogram
	constructor(vtxA, edgeAB, edgeAC, baseColour, material) {
		super();

		this.type = 'square';
		this.vtxA = vtxA;
		this.edgeAB = edgeAB;
		this.edgeAC = edgeAC;
		this.normalDir = vecNormalize(vecCross(this.edgeAB, this.edgeAC));
		this.baseColour = baseColour || COL_DEEP_PINK;
		this.material = material;
	}

	normal() { return this.normalDir; }
}

class Disc extends Shape {
	constructor(centre, radius, normalDir, baseColour, material) {
		super();

		this.type = 'disc';
		this.centre = centre;
		this.radius = radius;
		this.normalDir = vecNormalize(normalDir);
		this.baseColour = baseColour || COL_DEEP_PINK;
		this.material = material;
	}

	normal() { return this.normalDir; }
}

class Annulus extends Shape {
	constructor(centre, outerRadius, innerRadius, normalDir, baseColour, material) {
		super();

		this.type = 'annulus';
		this.centre = centre;
		this.outerRadius = outerRadius;
		this.innerRadius = innerRadius;
		this.normalDir = vecNormalize(normalDir);
		this.baseColour = baseColour || COL_DEEP_PINK;
		this.material = material;
	}

	normal() { return this.normalDir; }
}

class Ray {
	constructor(origin, dir) {
		this.origin = origin;
		this.dir = vecNormalize(dir);
	}

	intersectDist(shape) {
		switch (shape.type) {
			case 'plane': {
				let a = shape.origin;
				let n = shape.normalDir;

				if (Math.abs(vecDot(this.dir, n)) < EPSILON) {
					return undefined;
				}

				let t = vecDot(vecMinus(a, this.origin), n) / vecDot(this.dir, n);
				return t > EPSILON ? t : undefined;
			}	case 'sphere': {
				let a = 1;
				let halfB = vecDot(this.dir, vecMinus(this.origin, shape.centre));
				let c = vecSqLength(vecMinus(this.origin, shape.centre)) - shape.radius * shape.radius;

				let t = qRoots(a, halfB, c);
				if (t == undefined) {
					return undefined;
				} else {
					if (t[0] > EPSILON) {
						return t[0];
					} else {
						if (t[1] > EPSILON) {
							return t[1];
						}
					}
				}
				return undefined;
			} case 'hemisphere': {
				let a = 1;
				let halfB = vecDot(this.dir, vecMinus(this.origin, shape.centre));
				let c = vecSqLength(vecMinus(this.origin, shape.centre)) - shape.radius * shape.radius;

				let t = qRoots(a, halfB, c);
				if (t == undefined) {
					return undefined;
				} else {
					for (let i in [0, 1]) {	// check intersections to see whether they're in positive direction along ray and in the proper halfspace (at distance within min / max truncation)
						if (t[i] > EPSILON) {
							let pos = vecPlus(this.origin, vecScalar(t[i], this.dir));
							let proj = vecDot(vecMinus(pos, shape.centre), shape.normalDir);
							if (proj > shape.truncateMin && (shape.truncateMax == undefined || proj < shape.truncateMax)) {
								return t[i];
							}
						}
					}
					return undefined;
				}
			} case 'cylinder': {
				let centre = shape.centre;
				let axis = shape.axis;
				let v = vecMinus(this.origin, centre);
				
				let vd = vecDot(v, this.dir);
				let va = vecDot(v, axis);
				let da = vecDot(this.dir, axis);

				let a = 1 - da * da;
				let halfB = vd - va * da;
				let c = vecSqLength(v) - va * va - shape.radius * shape.radius;

				let t = qRoots(a, halfB, c);

				if (t == undefined || t[0] <= 0) {
					return undefined;
				}
				return t[0];
			} case 'triangle': {
				// Möller-Trumbore algorithm
				let h = vecCross(this.dir, shape.edgeAC);
				let a = vecDot(shape.edgeAB, h);
				if (a > -EPSILON && a < EPSILON) {
					return undefined;
				}
				let f = 1 / a;
				let s = vecMinus(this.origin, shape.vtxA);
				let u = f * vecDot(s, h);
				if (u < 0 || u > 1) {
					return undefined;
				}
				let q = vecCross(s, shape.edgeAB);
				let v = f * vecDot(this.dir, q);
				if (v < 0 || u + v > 1) {
					return undefined;
				}

				let t = f * vecDot(shape.edgeAC, q);
				return (t > EPSILON) ? t : undefined;
			} case 'square': {
				// Möller-Trumbore algorithm
				let h = vecCross(this.dir, shape.edgeAC);
				let a = vecDot(shape.edgeAB, h);
				if (a > -EPSILON && a < EPSILON) {
					return undefined;
				}
				let f = 1 / a;
				let s = vecMinus(this.origin, shape.vtxA);
				let u = f * vecDot(s, h);
				if (u < 0 || u > 1) {
					return undefined;
				}
				let q = vecCross(s, shape.edgeAB);
				let v = f * vecDot(this.dir, q);
				if (v < 0 || v > 1) {
					return undefined;
				}

				let t = f * vecDot(shape.edgeAC, q);
				return (t > EPSILON) ? t : undefined;
			} case 'disc': {
				let c = shape.centre;
				let n = shape.normalDir;

				if (Math.abs(vecDot(this.dir, n)) < EPSILON) {
					return undefined;
				}

				let t = vecDot(vecMinus(c, this.origin), n) / vecDot(this.dir, n);
				if (t > EPSILON) {	// hits plane of disc; now check radius
					let pos = vecPlus(this.origin, vecScalar(t, this.dir));
					return (vecSqLength(vecMinus(c, pos)) + EPSILON < shape.radius * shape.radius) ? t : undefined;
				}
				return undefined;
			} case 'annulus': {
				let c = shape.centre;
				let n = shape.normalDir;

				if (Math.abs(vecDot(this.dir, n)) < EPSILON) {
					return undefined;
				}

				let t = vecDot(vecMinus(c, this.origin), n) / vecDot(this.dir, n);
				if (t > EPSILON) {	// hits plane of disc; now check radii
					let pos = vecPlus(this.origin, vecScalar(t, this.dir));
					let rSq = vecSqLength(vecMinus(c, pos));
					return (rSq + EPSILON < shape.outerRadius * shape.outerRadius && rSq - EPSILON > shape.innerRadius * shape.innerRadius) ? t : undefined;
				}
				return undefined;
			} default: {
				throw new Error(`I didn't recognize the shape! (${shape.type})`);
				return undefined;
			}
		}
	}
}

class Photon extends Ray {
  constructor(origin, dir, power, colour, isCaustic) {
    super(origin, dir);
    this.power = power;
    this.colour = colour || COL_WHITE;
    this.isCaustic = isCaustic;  // photons are caustic if the are of the form LS+D (lightsource-specular-...-specular-diffuse)
  }
}

class Camera {
	constructor(origin, gazeDir, up, width, height, fieldOfView) {
		this.origin = origin;
		this.width = width;
		this.height = height;
		this.fieldOfView = fieldOfView || 45;
		this.fovRadians = Math.PI / 180 * (this.fieldOfView / 2);
		this.fovScaleWidth = Math.tan(this.fovRadians);
		this.fovScaleHeight = this.fovScaleWidth * this.height / this.width;
		// find orthonormal basis corresponding to camera angle
		this.up = up;
		this.ONBw = vecNormalize(vecScalar(-1, gazeDir));
		this.ONBu = vecNormalize(vecCross(this.up, this.ONBw));
		this.ONBv = vecCross(this.ONBw, this.ONBu);
	}

	toUVW(xyz) {
		let transXyz = vecMinus(xyz, this.origin);
		return [vecDot(transXyz, this.ONBu), vecDot(transXyz, this.ONBv), vecDot(transXyz, this.ONBw)];
	}
	toXYZ(uvw) { return vecPlus(vecPlus(vecPlus(this.origin, vecScalar(uvw[0], this.ONBu)), vecScalar(uvw[1], this.ONBv)), vecScalar(uvw[2], this.ONBw)) };
}

class Scene {
	constructor(ctx) {
		this.ctx = ctx;
		this.canvasWidth = ctx.width;
		this.canvasHeight = ctx.height;
		this.shapes = [];
    this.lights = [];
    this.photonListDiffuse = [];
		this.photonListCaustic = [];
		this.photonListBad = [];	// for debugging
    this.photonKdTDiffuse = [];
    this.photonKdTCaustic = [];
	}

	loadPreset(def) {
		switch (def) {
			case 0:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_WHITE, MAT_LINOLEUM),
					new Plane([0, 80, 0], [0, -1, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([0, -80, 0], [0, 1, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([80, 0, 0], [-1, 0, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([-80, 0, 0], [1, 0, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([0, 0, 80], [1, 0, -1], COL_VERY_DARK_GREY, MAT_PLASTER),
				];
					
				new Ball(this.shapes, [0.3, 0, 0.4], 0.4, COL_RED, MAT_GLASS);
				new Ball(this.shapes, [-1.1, 1.2, 0.25], 0.25, COL_MAUVE, MAT_PLASTER);
				new Ball(this.shapes, [0.5, 2.5, 1.25], 1.25, COL_BLACK, MAT_COPPER);
				new Ball(this.shapes, [-1.5, -2.5, 0.8], 0.8, COL_ORANGE_ORANGE, MAT_PLASTER);

				this.shapes[0].colour = function(p) {
					let f = Math.sin(p[0]) + p[1];
					let index;
					if (f > 0 && f < 1) {
						index = 0;
					} else {
						index = 1 + ((Math.floor(p[0] / 4) + Math.floor(p[1] / 4 )) & 1);
					}
					return [COL_DEEP_PINK, COL_GREY, COL_BLACK, COL_DEEP_BLUE][index];
				}
				this.shapes[8].colour = function(p) {		// 8-ball
					let cosTheta1, cosTheta2;
					cosTheta1 = vecDot(vecMinus(p, this.centre), vecNormalize([-1, -1, 0])) / this.radius;
					if (cosTheta1 < 0.905) {
						return COL_BLACK;
					}
					cosTheta1 = vecDot(vecMinus(p, this.centre), vecNormalize([-1, -1, 0.15])) / this.radius;
					cosTheta2 = vecDot(vecMinus(p, this.centre), vecNormalize([-1, -1, -0.12])) / this.radius;
					if ((cosTheta1 > 0.9920 && cosTheta1 < 0.999) || (cosTheta2 > 0.9900 && cosTheta2 < 0.9980)) {
						return COL_BLACK;
					}
					return COL_WHITE;
				}

				new Spotlight(this.shapes, this.lights, [0, 0, 10], 0.5, [0, 0, -1], 80);
				new Spotlight(this.shapes, this.lights, [-4, -4, 10], 0.5, [1, 1, -1], 80);

				this.camera = new Camera([-0.3, -4, 1], [0, 1, -0.1], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 1:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_GREY, MAT_LINOLEUM),
					new Plane([0, 18, 0], [0, -1, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([0, -24, 0], [0, 1, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([12, 0, 0], [-1, 0, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([-12, 0, 0], [1, 0, 0], COL_VERY_DARK_GREY, MAT_PLASTER),
					new Plane([0, 0, 12], [0, 0, -1], COL_GREY, MAT_PLASTER),
				];
				this.shapes[0].colour = function(p) {
					let x = Math.abs((p[0] + 100.7) % 2.3 - 1.15);
					let y = Math.abs((p[1] + 102.7) % 2.3 - 1.15);
					let index = 0;
					if (x < 0.03 || y < 0.03 || x + y < 0.6) {
						index = 1;
					}
					return [COL_WHITE, COL_BLACK][index];
				}

				new Box(this.shapes, [-5, 8, 0], [1.5, -0.3, 0], [0.3, 1.5, 0], [0, 0, 0.5], COL_COPPER, MAT_COPPER);
				new Box(this.shapes, [-2, 8, 0], [1.5, -0.3, 0], [0.3, 1.5, 0], [0, 0, 0.5], COL_WHITE, MAT_GLASS);
				new Box(this.shapes, [1, 8, 0], [1.5, -0.3, 0], [0.3, 1.5, 0], [0, 0, 0.5], COL_MAUVE, MAT_PLASTER);

				new Ball(this.shapes, [-5, 10, 1], 1, COL_WHITE, MAT_GLASS);
				new Ball(this.shapes, [-2, 10, 1], 1, COL_MAUVE, MAT_PLASTER);
				new Ball(this.shapes, [1, 10, 1], 1, COL_COPPER, MAT_COPPER);
				
				new Ball(this.shapes, [-1, 14, 2], 2, COL_WHITE, MAT_MIRROR);

				new Spotlight(this.shapes, this.lights, [0, 0, 10], 0.5, [0, 0, -1], 40);
				new Spotlight(this.shapes, this.lights, [-6, 10, 4.5], 0.5, [1, 0, -1], 10), COL_RED;
				new Spotlight(this.shapes, this.lights, [-3, 10, 5.5], 0.5, [0, 0, -1], 10, COL_LIME_GREEN);
				new Spotlight(this.shapes, this.lights, [0, 10, 4.5], 0.5, [-1, 0, -1], 10, COL_DEEP_BLUE);
				this.camera = new Camera([-2.3, -6, 5], [0, 1, -0.2], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 2:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_GREY, MAT_LINOLEUM),
					new Plane([0, 12, 0], [0, -1, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([0, -12, 0], [0, 1, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([12, 0, 0], [-1, 0, 0], COL_SKY_BLUE, MAT_PLASTER),
          new Plane([-12, 0, 0], [1, 0, 0], COL_SKY_BLUE, MAT_PLASTER),
          new Plane([0, 0, 12], [0, 0, -1], COL_GREY, MAT_PLASTER),
				];
				this.shapes[0].colour = function(p) {
					let x = Math.abs((p[0] + 100.7) % 2.3 - 1.15);
					let y = Math.abs((p[1] + 102.7) % 2.3 - 1.15);
					let index = 0;
					if (x < 0.03 || y < 0.03 || x + y < 0.6) {
						index = 1;
					}
					//let index = (Math.floor((p[0] + 0.7) / 0.32) + Math.floor((p[1] + 14.2) / 0.32)) & 1;
					return [COL_WHITE, COL_BLACK][index];
				}
        
        new Box(this.shapes, [-1, -1, 0.9], [2, 0, 0], [0, 2, 0], [0, 0, 0.1], COL_ENGLISH_WALNUT, MAT_PLASTER);
        new Box(this.shapes, [0.9, -1, 0], [0.1, 0, 0], [0, 0.1, 0], [0, 0, 1], COL_ENGLISH_WALNUT, MAT_PLASTER);
        new Box(this.shapes, [0.9, 0.9, 0], [0.1, 0, 0], [0, 0.1, 0], [0, 0, 1], COL_ENGLISH_WALNUT, MAT_PLASTER);
        new Box(this.shapes, [-1, 0.9, 0], [0.1, 0, 0], [0, 0.1, 0], [0, 0, 1], COL_ENGLISH_WALNUT, MAT_PLASTER);
        new Box(this.shapes, [-1, -1, 0], [0.1, 0, 0], [0, 0.1, 0], [0, 0, 1], COL_ENGLISH_WALNUT, MAT_PLASTER);
				
				new Bowl(this.shapes, [0.3, -0.1, 1.5], 0.5, 0.45, [0, 0, 1], COL_WHITE, MAT_GLASS);
				new Halfball(this.shapes, [0.3, -0.1, 1.5], 0.45, [0, 0, 1], 0.2, undefined, COL_WHITE, MAT_WATER);
				
        new Ball(this.shapes, [-0.7, 0.1, 1.15], 0.15, COL_ORANGE_ORANGE, MAT_PLASTER);
        new Ball(this.shapes, [-0.5, -0.5, 1.25], 0.25, COL_GRAPEFRUIT_YELLOW, MAT_PLASTER);
        new Ball(this.shapes, [0.38, -0.12, 1.30], 0.05, COL_ROBINS_EGG_BLUE, MAT_PLASTER);
        
				new Box(this.shapes, [-2.25, 3.75, 0], [0.9, 0.2, 0], [-0.2, 0.9, 0], [0, 0, 0.5], COL_LIME_GREEN, MAT_PLASTER);

        new Spotlight(this.shapes, this.lights, [0, -2, 8.5], 1, [0, 0.1, -1], 20);
				new Spotlight(this.shapes, this.lights, [-6, -2, 8.5], 0.25, [3, 1, -1], 40);
				//new Spotlight(this.shapes, this.lights, [0, 10, 4.5], 1, [0, 0, -1], 40);
				//new Spotlight(this.shapes, this.lights, [-3, 10, 4.5], 0.5, [0, 0, -1], 40);

				this.camera = new Camera([-2.3, -4.6, 2.0], [0.3, 1, -0.12], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 3:
				// needs to be updated to current code
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_GREY, 0.6),
					new Plane([0, 16, 0], [0, -1, 0], COL_VERY_DARK_GREY, 0.02),
					new Plane([0, -16, 0], [0, 1, 0], COL_VERY_DARK_GREY, 0.02),
					new Plane([16, 0, 0], [-1, 0, 0], COL_DARK_GREY, 0.02),
					new Plane([-16, 0, 0], [1, 0, 0], COL_DARK_GREY, 0.02),

/*				new Sphere([4, 2, 3], 3, COL_COPPER, 0.2),

					new Sphere([-2.5, -1.2, 0.6], 0.6, COL_SILVER, 0.98, MAT_GLASS),
					new Sphere([-2.5, -1.2, 0.6], 0.05, COL_SILVER, 0.98, MAT_AIR),

					new Sphere([-1, -1.2, 0.6], 0.6, COL_SILVER, 0.98, MAT_GLASS),
					new Sphere([-1, -1.2, 0.6], 0.3, COL_SILVER, 0.98, MAT_AIR),

					new Sphere([0.5, -1.2, 0.6], 0.6, COL_SILVER, 0.98, MAT_GLASS),
					new Sphere([0.5, -1.2, 0.6], 0.55, COL_SILVER, 0.98, MAT_AIR),*/
				];
				/*new Bowl(this.shapes, [0, -1, 1], 1, 0.9, [0, 0, 1], COL_WHITE, 0.97, MAT_GLASS);*/
				new Halfball(this.shapes, [0, -1, 1], 0.9, [0, 0, 1], 0.3, undefined, COL_WHITE, 0.97, MAT_WATER);/*
				new Box(this.shapes, [-0.1, -1, 0.15], [0.1, 0, 0], [0, 0.1, 0], [0.5, 0, 1.8], COL_COPPER, 0.1);
				new Cuboctahedron(this.shapes, [-0.7, 1, 0], [1.2, 0, 0], [0, 1.2, 0], [0, 0, 1.2], COL_DEEP_BLUE, COL_DEEP_PINK, 0.3)*/
				new Bowl(this.shapes, [-2.3, 1, 1], 1, 0.8, [0, 0, 1], COL_DEEP_BLUE, 0.3);
				new Ball(this.shapes, [-2.3, 1, 0.7], 0.5, COL_GRAPEFRUIT_YELLOW, 0.3);
				new Ball(this.shapes, [0.35, -0.8, 2.8], 0.3, COL_ORANGE_ORANGE, 0.3);
				new Ball(this.shapes, [-0.4, 3.5, 2], 2, COL_COPPER, 0.6);
				new Cuboctahedron(this.shapes, [-0.7, -2, 0], [2.5, 0, 0], [0, 2.5, 0], [0, 0, 2.5], COL_DEEP_PINK, COL_DARK_GREY, 0.3);

				//new Box(this.shapes, [-2, 0.5, 0], [1, 0, 0], [0, 4.5, 0], [0, 0, 1.3], COL_MAUVE, 0.1, MAT_OPAQUE);
				//new Prism(this.shapes, [0, 2, 0], [1, 0, 0], [0, 4, 0], [0, 0, 0.5], COL_LIME_GREEN, 0.8, MAT_GLASS);

				this.shapes[0].colour = function(p) {
					let index = ((Math.floor((0.6 * p[0] + 0.8 * p[1] + 0.7) / 3.2) + Math.floor((0.8 * p[0] - 0.6 * p[1] + 0.2) / 3.2)) & 1);
					return [COL_WHITE, COL_BLACK][index];
				}

				this.camera = new Camera([-3.3, -8, 4.5], [0.4, 1, -0.4], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 4:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_GREY, MAT_LINOLEUM),
					new Plane([0, 12, 0], [0, -1, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([0, -24, 0], [0, 1, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([12, 0, 0], [-1, 0, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([-12, 0, 0], [1, 0, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([0, 0, 12], [0, 0, -1], COL_GREY, MAT_PLASTER),
				]
				this.shapes[0].colour = function(p) {
					let index = ((Math.floor((0.6 * p[0] + 0.8 * p[1] + 0.7) / 3.2) + Math.floor((0.8 * p[0] - 0.6 * p[1] + 0.2) / 3.2)) & 1);
					return [COL_WHITE, COL_BLACK][index];
				}

				//new Ball(this.shapes, [0, 0, 3], 2, COL_WHITE, MAT_GLASS);
				//new Ball(this.shapes, [0, 0, 2], 2, COL_COPPER, MAT_COPPER);
				new Ball(this.shapes, [0, 0, 2], 2, COL_COPPER, MAT_GLASS);
				new Ball(this.shapes, [3.2, 0.4, 1], 1, COL_LIME_GREEN, MAT_GLASS);//  MAT_PLASTER);
				
				new Prism(this.shapes, [-3, -2.5, 0], [9, -0.6, 0], [9, 0.2, 0], [0, 0, 2.2], COL_WHITE, MAT_GLASS);
				
				new Spotlight(this.shapes, this.lights, [-1, -3, 8.5], 1, [0, 0, -1], 40);
				new Spotlight(this.shapes, this.lights, [-6, 0, 6.5], 1, [1, 0, -1], 40);

				new Box(this.shapes, [2, 3, 0], [2, -1, 0], [0.1, 0.2, 0], [0, 0, 5], COL_WHITE, MAT_GLASS);// MAT_MIRROR);
				new Box(this.shapes, [4.5, 1.5, 0], [1, -2, 0], [0.2, 0.1, 0], [0, 0, 5], COL_WHITE, MAT_GLASS);//  MAT_MIRROR);
				
				this.camera = new Camera([-4.2, -17.9, 8.8], [0.4, 1, -0.4], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 5:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_SILVER, MAT_LINOLEUM),
					new Plane([0, 4, 0], [0, -1, 0], COL_GRAPEFRUIT_YELLOW, MAT_PLASTER),
					new Plane([0, -14, 0], [0, 1, 0], COL_GREY, MAT_PLASTER),
					new Plane([4, 0, 0], [-1, 0, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([-4, 0, 0], [1, 0, 0], COL_RED, MAT_PLASTER),
					new Plane([0, 0, 8], [0, 0, -1], COL_DARK_GREY, MAT_PLASTER),
				]
				/*this.shapes[0].colour = function(p) {
					let index = ((Math.floor((0.6 * p[0] + 0.8 * p[1] + 0.7) / 3.2) + Math.floor((0.8 * p[0] - 0.6 * p[1] + 0.2) / 3.2)) & 1);
					return [COL_WHITE, COL_BLACK][index];
				}*/

				//new Ball(this.shapes, [0, 0, 3], 2, COL_WHITE, MAT_GLASS);
				/*new Ball(this.shapes, [-1.7, 1, 1], 1, COL_WHITE, MAT_GLASS);
				new Ball(this.shapes, [1.2, -0.3, 1], 1, COL_WHITE, MAT_MIRROR);*/
				let tallestX = 0;
				let tallestY = 0;
				let tallestZ = 0;
				let shortestX = 0;
				let shortestY = 0;
				let shortestZ = Infinity;
				for (let b = 0; b < 5; b++) {
					let centreX = 6 * Math.random() - 3;
					let centreY = 6 * Math.random() - 3;					
					let theta = Math.PI / 2 * Math.random();
					let cosTh = Math.cos(theta);
					let sinTh = Math.sin(theta);
					let base = 0; // (Math.random() < 0.9) ? 0 : 4 * Math.random();
					let height = 0.1 + 3 * Math.random();
					
					if (base + height > tallestZ) {
						tallestX = centreX;
						tallestY = centreY;
						tallestZ = base + height;
					}
					if (base + height < shortestZ) {
						shortestX = centreX;
						shortestY = centreY;
						shortestZ = base + height;
					}

					let colour = {};
					let colHue = 360 * Math.random();
					let c = Math.floor(256 * (1 - Math.abs((colHue / 60) % 2 - 1)));					
					switch (Math.floor(colHue / 60)) {
						case 0:
							colour = { r: 255, g: c, b: 0, a: 1 };
							break;
						case 1:
							colour = { r: c, g: 255, b: 0, a: 1 };
							break;
						case 2:
							colour = { r: 0, g: 255, b: c, a: 1 };
							break;
						case 3:
							colour = { r: 0, g: c, b: 255, a: 1 };
							break;
						case 4:
						  colour = { r: c, g: 0, b: 255, a: 1 };
							break;
						case 5:
							colour = { r: 255, g: 0, b: c, a: 1 };
							break;
						default:
							throw new Error(`impossible HSV?`);
							break;
					}
					//let colR = // Math.floor(256 * Math.random());
					//let colG = // Math.floor(256 * Math.random());
					//let colB = // Math.floor(256 * Math.random());
					//let colour = { r: colR, g: colG, b: colB, a: 1 };
					let material = MAT_PLASTER;// (Math.random() < 0.95) ? ((Math.random < 0.90) ? MAT_PLASTER : MAT_COPPER) : MAT_MIRROR;					
					new Box(this.shapes, [centreX - (cosTh + sinTh) / 2, centreY - (cosTh - sinTh) / 2, base], [cosTh, -sinTh, 0], [sinTh, cosTh, 0], [0, 0, height], colour, material);
				}
				new Ball(this.shapes, [tallestX, tallestY, tallestZ + 0.5], 0.5, COL_WHITE, MAT_MIRROR);
				new Ball(this.shapes, [shortestX, shortestY, shortestZ + 0.5], 0.5, COL_WHITE, MAT_GLASS);
				
				new Spotlight(this.shapes, this.lights, [-1.5, -1, 6.75], 1, [0.5, 0, -1], 40);
				new Spotlight(this.shapes, this.lights, [1.5, 1, 6.75], 1, [-0.5, 0, -1], 40);

				this.camera = new Camera([0, -13.6, 3], [0, 1, -0.1], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 6:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_SILVER, MAT_LINOLEUM),
					new Plane([0, 4, 0], [0, -1, 0], COL_GRAPEFRUIT_YELLOW, MAT_PLASTER),
					new Plane([0, -14, 0], [0, 1, 0], COL_GREY, MAT_PLASTER),
					new Plane([4, 0, 0], [-1, 0, 0], COL_SKY_BLUE, MAT_PLASTER),
					new Plane([-4, 0, 0], [1, 0, 0], COL_RED, MAT_PLASTER),
					new Plane([0, 0, 8], [0, 0, -1], COL_DARK_GREY, MAT_PLASTER),
				]
				for (let b = 0; b < 0; b++) {
					let centreX = 7 * Math.random() - 3.5;
					let centreY = 7 * Math.random() - 3.5;
					let centreZ = 5 * Math.random() + 1.0;
					let radius = 0.5 + 0.5 * Math.random();

					let colour = {};
					let colHue = 360 * Math.random();
					let c = Math.floor(256 * (1 - Math.abs((colHue / 60) % 2 - 1)));					
					switch (Math.floor(colHue / 60)) {
						case 0:
							colour = { r: 255, g: c, b: 0, a: 1 };
							break;
						case 1:
							colour = { r: c, g: 255, b: 0, a: 1 };
							break;
						case 2:
							colour = { r: 0, g: 255, b: c, a: 1 };
							break;
						case 3:
							colour = { r: 0, g: c, b: 255, a: 1 };
							break;
						case 4:
							colour = { r: c, g: 0, b: 255, a: 1 };
							break;
						case 5:
							colour = { r: 255, g: 0, b: c, a: 1 };
							break;
						default:
							throw new Error(`impossible HSV?`);
							break;
					}
					let material = (Math.random() < 0.33) ? ((Math.random < 0.33) ? MAT_PLASTER : MAT_GLASS) : MAT_MIRROR;
					new Ball(this.shapes, [centreX, centreY, centreZ], radius, colour, material);
				}
				
				new Ball(this.shapes, [-2.5, 2.5, 1], 1, COL_WHITE, MAT_GLASS);
				new Ball(this.shapes, [0, 2.5, 1], 1, COL_ROBINS_EGG_BLUE, MAT_PLASTER);
				new Ball(this.shapes, [2.5, 2.5, 1], 1, COL_COPPER, MAT_COPPER);
				new Spotlight(this.shapes, this.lights, [-1.5, 0.5, 6.5], 0.25, [0.1, 0.3, -1], 40);

				new Box(this.shapes, [-3.75, -3.5, 0], [7.5, 4, 0], [-0.2, 0.375, 0], [0, 0, 4], COL_WHITE, MAT_GLASS);

				this.camera = new Camera([0, -13.6, 4.5], [0, 1, -0.1], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			default:
				break;
		}
    this.initLights();
    this.emitManyPhotons();
	}

	initLights() {
		let totalIntensity = 0;
		for (let l of this.lights) {
			let s = this.shapes[l];
			s.intensity = s.wattage * s.area;
			totalIntensity += s.intensity;			
		}
		for (let l of this.lights) {
			let s = this.shapes[l];			
			s.prob = s.intensity / totalIntensity;	// probability of being chosen as random light source
		}
  }

  createPhoton(source) {
		let r = Math.random();
		if (source == undefined) {
			let l = 0;
			while (r > this.shapes[this.lights[l]].prob) {   // choose random light source weighted according to intensity
				r -= this.shapes[this.lights[l]].prob;
				l += 1;
			}
			source = l;
		}
    let light = this.shapes[this.lights[source]];

    let origin = discSample(light.centre, light.radius, light.normalDir);
    let dir = vecPerturb(light.normalDir);
    let power = light.wattage;
		let col = light.lightColour;

    return new Photon(origin, dir, power, col, undefined);
  }

  storePhoton(photon) {
    if (photon.isCaustic) {
      if (this.photonListCaustic.length < NUM_PHOTONS_CAUSTIC) { this.photonListCaustic.push(photon); }
    } else {
      if (this.photonListDiffuse.length < NUM_PHOTONS_DIFFUSE) { this.photonListDiffuse.push(photon); }
    }
  }

  emitManyPhotons() {
		if (this.lights.length == 0) {
			console.log(`No lights! Can't emit photons.`);
			return;
		}
		// send out photons; store according to whether they're diffuse or caustic
		let attempt = 0;
    while (this.photonListDiffuse.length < NUM_PHOTONS_DIFFUSE) {
      let photon = this.createPhoton();
			this.emitPhoton(photon, 0, false, [MAT_AIR]);
			attempt++;
			if (attempt > 100 * NUM_PHOTONS_DIFFUSE) {
				console.log(`I tried many times (${attempt}) but only created ${this.photonListDiffuse.length} diffuse photons.`);
				return;
			}      
		}
    this.photonKdTDiffuse = new KdTree(this.photonListDiffuse);
		// now to get higher accuracy for caustics, send out more photons and only accept if caustic
		attempt = 0;
    while (this.photonListCaustic.length < NUM_PHOTONS_CAUSTIC) {
      let photon = this.createPhoton();
			this.emitPhoton(photon, 0, true, [MAT_AIR]);
			attempt++;
			if (attempt > 100 * NUM_PHOTONS_CAUSTIC) {
				console.log(`I tried many times (${attempt}) but only created ${this.photonListCaustic.length} caustic photons.`);
				return;
			}      
    }
    this.photonKdTCaustic = new KdTree(this.photonListCaustic);
  }

  drawPhotons() {
    /*for (let photon of this.photonListDiffuse) {
      let projStart = this.projectToCanvas(photon.origin);
      let projEnd = this.projectToCanvas(vecPlus(photon.origin, vecScalar(0.05, photon.dir)));
      if (projStart != undefined && projEnd != undefined) {
        this.ctx.strokeStyle = "rgb(0,255,0)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(projStart.x, projStart.y);
        this.ctx.lineTo(projEnd.x, projEnd.y);
        this.ctx.stroke();
      }
    }
    for (let photon of this.photonListCaustic) {
      let projStart = this.projectToCanvas(photon.origin);
      let projEnd = this.projectToCanvas(vecPlus(photon.origin, vecScalar(0.05, photon.dir)));
      if (projStart != undefined && projEnd != undefined) {
        this.ctx.strokeStyle = "white";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(projStart.x, projStart.y);
        this.ctx.lineTo(projEnd.x, projEnd.y);
        this.ctx.stroke();
      }
		}
		return;
		*/
		//////

		let imgData = this.ctx.createImageData(this.canvasWidth, this.canvasHeight);

		for (let photon of this.photonListDiffuse) {
      let projStart = this.projectToCanvas(photon.origin);
			//let projEnd = this.projectToCanvas(vecPlus(photon.origin, vecScalar(0.05, photon.dir)));
			if (projStart != undefined) {
				let x = projStart.x;
				let y = projStart.y;
				if (x >= 0 && x < this.canvasWidth && y >= 0 && y < this.canvasHeight) {
					let i = (Math.floor(y) * this.canvasWidth + Math.floor(x)) * 4;
					imgData.data[i+0] = photon.colour.r;
					imgData.data[i+1] = photon.colour.g;
					imgData.data[i+2] = photon.colour.b;
					imgData.data[i+3] = 255;
				}
			}
    }    
    for (let photon of this.photonListCaustic) {
      let projStart = this.projectToCanvas(photon.origin);
			//let projEnd = this.projectToCanvas(vecPlus(photon.origin, vecScalar(0.05, photon.dir)));
			if (projStart != undefined) {
				let x = projStart.x;
				let y = projStart.y;
				if (x >= 0 && x < this.canvasWidth && y >= 0 && y < this.canvasHeight) {
					let i = (Math.floor(y) * this.canvasWidth + Math.floor(x)) * 4;
					imgData.data[i+0] = 255;
					imgData.data[i+1] = 255;
					imgData.data[i+2] = 255;
					imgData.data[i+3] = 255;
				}
      }
		}
		this.ctx.putImageData(imgData, 0, 0);
		for (let photon of this.photonListBad) {
      let projStart = this.projectToCanvas(photon.origin);
      let projEnd = this.projectToCanvas(vecPlus(photon.origin, vecScalar(1, photon.dir)));
      if (projStart != undefined && projEnd != undefined && photon.origin[2] < 4) {
        this.ctx.strokeStyle = "red";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(projStart.x, projStart.y);
        this.ctx.lineTo(projEnd.x, projEnd.y);
        this.ctx.stroke();
      }
		}
  }

  emitPhoton(photon, depth, trackOnlyCaustic, materialStack) {
		// to do: add attenuation, e.g., for tinted glass
		//        -> i.e., track distance travelled inside given medium (don't forget internal reflection), attenuating light
		//					 accordingly for outgoing photon
		if (trackOnlyCaustic == undefined) { trackOnlyCaustic = false; }
		
		let minIntersectionDist = Infinity;
		let minS;
		for (let s = 0; s < this.shapes.length; s++) {
			let t = photon.intersectDist(this.shapes[s]);
			if (t > EPSILON && t < minIntersectionDist && !this.shapes[s].isLight) {
				minIntersectionDist = t;
				minS = s;
			}
		}
		if (minIntersectionDist < Infinity) {
			let minShape = this.shapes[minS];

			let intersection = vecPlus(photon.origin, vecScalar(minIntersectionDist, photon.dir));
			let localColour = minShape.colour(intersection);
			let normal = minShape.normal(intersection);
			let cosTheta1	= -vecDot(photon.dir, normal);
			
			if (minShape.transparent) {
				let eta1 = matRefrIndex[materialStack[materialStack.length - 1]];		// current medium
				let eta2 = (vecDot(photon.dir, normal) < 0) ? minShape.refrIndex : matRefrIndex[materialStack[materialStack.length - 2]];	// enter or exit medium
				if (eta2 == undefined) {
					throw new Error("photon exited all materials? check consistency of objects?")
				}
				let etaRatio = eta1 / eta2;
				let cosTheta2Sq = 1 - etaRatio * etaRatio * (1 - cosTheta1 * cosTheta1);
				if (cosTheta2Sq < 0) {	// total internal reflection						
					let reflectDir = vecPlus(photon.dir, vecScalar(2 * cosTheta1, normal));
					let isCaustic = (photon.isCaustic == undefined) ? true : photon.isCaustic;					
					this.emitPhoton(new Photon(intersection, reflectDir, photon.power, photon.colour, isCaustic), depth + 1, trackOnlyCaustic, materialStack);
				} else {	// refract
					let plusMinus = (cosTheta1 < 0) ? -1 : 1;		// used in refractDir to make sure angle is right depending on whether we're entering or exiting (because normal points out of surface)
					let refractDir = vecPlus(vecScalar(etaRatio, photon.dir), vecScalar(etaRatio * cosTheta1 - plusMinus * Math.sqrt(cosTheta2Sq), normal));
					if (cosTheta1 < 0) {	// exiting medium
						materialStack.pop();
					} else {		// entering medium
						materialStack = [...materialStack, minShape._material];
					}
					let isCaustic = (photon.isCaustic == undefined) ? true : photon.isCaustic;
					this.emitPhoton(new Photon(intersection, refractDir, photon.power, photon.colour, isCaustic), depth + 1, trackOnlyCaustic, materialStack);
				}
			} else {	// opaque: reflect or absorb
				if (Math.random() < minShape.reflectance) {	// reflect
					if (depth < MAX_DEPTH) {
						if (Math.random() < minShape.specular) {	// specular; preserve caustic state
							let reflectDir = vecPlus(photon.dir, vecScalar(2 * cosTheta1, normal));
							if (cosTheta1 < 0) {									
								//console.log(`Photon (depth ${depth} inside an opaque object #${minS}, a ${minShape.type} at ${intersection}`);									
								//console.log(`  coming from ${photon.origin}, direction ${photon.dir}. Cos(theta) = ${cosTheta1}`);
								this.photonListBad.push(new Photon(intersection, reflectDir, photon.power, photon.colour, photon.isCaustic));
							}
							let isCaustic = (photon.isCaustic == undefined) ? true : photon.isCaustic;
							this.emitPhoton(new Photon(intersection, reflectDir, photon.power, photon.colour, isCaustic), depth + 1, trackOnlyCaustic, materialStack);
							// to do: remember to change power or colour? depending on shape colour
						} else {	// diffuse; next photon will not be caustic
							if (!trackOnlyCaustic) {
								let diffuseDir = vecPerturb(normal);
								let transmittedColour = { r: photon.colour.r / 255 * localColour.r,
																					g: photon.colour.g / 255 * localColour.g,
																					b: photon.colour.b / 255 * localColour.b,
																					a: 1
																				};
								let adjustedPower = photon.power * (255 + 255 + 255 + 1) / (localColour.r + localColour.g + localColour.b + 1);
								//this.emitPhoton(new Photon(intersection, diffuseDir, photon.power, transmittedColour, false), depth + 1, trackOnlyCaustic, materialStack);
								this.emitPhoton(new Photon(intersection, diffuseDir, adjustedPower, transmittedColour, false), depth + 1, trackOnlyCaustic, materialStack);
							}
						}
					}
				} else {	// absorb; store
					if (depth > 0) {	// don't store direct lighting
						photon.power /= photon.isCaustic ? NUM_PHOTONS_CAUSTIC : NUM_PHOTONS_DIFFUSE;
						this.storePhoton(new Photon(intersection, vecScalar(-1, photon.dir), photon.power, photon.colour, photon.isCaustic));
					}
				}
			}
		}    
  }

	projectToCanvas(xyz) {
		let uvw = this.camera.toUVW(xyz);
		if (uvw[2] >= 0) {
			return undefined;
		}
		// project onto plane w = -1
		let u = -uvw[0] / uvw[2];
		let v = -uvw[1] / uvw[2];
		u /= this.camera.fovScaleWidth;
		v /= this.camera.fovScaleHeight;

		return { x: (u + 1) * this.canvasWidth / 2 - 1, y: (-v + 1) * this.canvasHeight / 2 - 1 };
	}
    
	traceTile(tile, tileSize, superSampleScale) {
		for (let y = 0; y < tileSize; y += SUPER_SAMPLE_BASE ** superSampleScale) {
			for (let x = 0; x < tileSize; x += SUPER_SAMPLE_BASE ** superSampleScale) {
				this.traceOnCanvas(tile[0] + x, tile[1] + y, superSampleScale);
			}
		}
	}

	traceOnCanvas(canvasX, canvasY, superSampleScale) {
		if (debug) {
			console.log('FIRE THE LASERS');
		}

		let u, v, w, xyz;
		let ray, rayCol;
		let totalCol = { r: 0, g: 0, b: 0, a: 0 }
		for (let subSampleY = 0; subSampleY < SUB_SAMPLE; subSampleY++) {
			for (let subSampleX = 0; subSampleX < SUB_SAMPLE; subSampleX++) {
				u = ((canvasX + (subSampleX + Math.random()) / SUB_SAMPLE) * 2 / this.canvasWidth) - 1;
				v = -(((canvasY + (subSampleY + Math.random()) / SUB_SAMPLE) * 2 / this.canvasHeight) - 1);
				w = -1;

				u *= this.camera.fovScaleWidth;
				v *= this.camera.fovScaleHeight;

				xyz = this.camera.toXYZ([u, v, w]);
				let origin = this.camera.origin;
        // simulate lens: very slow, since subsampling needs to be high enough to avoid graininess
				/*let lensSample = discSample([0, 0, 0], 0.0025, [0, 0, 1]);
				let origin = this.camera.toXYZ([lensSample.x, lensSample.y, 0));*/
				ray = new Ray(origin, vecMinus(xyz, origin));
				rayCol = colour(this.traceRay(ray, MAX_TRACE_DIST, 0, 1, [MAT_AIR]));	// wrap it in colour function to prevent overwriting named colours

				totalCol.r += rayCol.r;
				totalCol.g += rayCol.g;
				totalCol.b += rayCol.b;
				totalCol.a += rayCol.a;
			}
		}
		rayCol.r = Math.floor(totalCol.r / (SUB_SAMPLE * SUB_SAMPLE));
		rayCol.g = Math.floor(totalCol.g / (SUB_SAMPLE * SUB_SAMPLE));
		rayCol.b = Math.floor(totalCol.b / (SUB_SAMPLE * SUB_SAMPLE));
		rayCol.a = Math.floor(totalCol.a / (SUB_SAMPLE * SUB_SAMPLE));

		putPixel(this.ctx, rayCol, canvasX, canvasY, superSampleScale);
	}

	traceRay(ray, maxDist, depth, importance, materialStack) {
		if (importance < 0.01) {
			return COL_WHITE;
		}

		if (debug) {
			let laserStart = this.projectToCanvas(ray.origin);

			this.ctx.beginPath();
			this.ctx.lineWidth = 1;
			this.ctx.strokeStyle = "white";
			if (laserStart != undefined) {
				this.ctx.moveTo(laserStart.x, laserStart.y);
			}
		}

		let minIntersectionDist = Infinity;
		let minS;
		for (let s = 0; s < this.shapes.length; s++) {
			let t = ray.intersectDist(this.shapes[s]);
			if (t > EPSILON && t < minIntersectionDist) {
				minIntersectionDist = t;
				minS = s;
			}
		}
		if (minIntersectionDist < Infinity) {
			let minShape = this.shapes[minS];

			if (minShape.isLight) {
				return minShape.lightColour;
			}

			let intersection = vecPlus(ray.origin, vecScalar(minIntersectionDist, ray.dir));
			let localColour = minShape.colour(intersection);
			let normal = minShape.normal(intersection);

			if (debug) {
				console.log(`hitting shape ${minS}, a a [material ${minShape._material}] ${minShape.type} with reflectance ${minShape.reflectance}`);
				console.log(`  material stack: ${materialStack}`)
				let laserEnd = this.projectToCanvas(intersection);
				if (laserEnd != undefined && ray.origin != this.camera.origin) {
					this.ctx.lineTo(laserEnd.x, laserEnd.y);
					this.ctx.stroke();
				}
			}

			let rayCol = { r: 0, g: 0, b: 0, a: 1 };

			let transmittedColour = { r: 0, g: 0, b: 0, a: 1 };
			let directColour = { r: 0, g: 0, b: 0, a: 1 };

			if (minIntersectionDist < maxDist || depth < MAX_DEPTH) {
				let cosTheta1	= -vecDot(ray.dir, normal);
				if (minShape.transparent) {
					let eta1 = matRefrIndex[materialStack[materialStack.length - 1]];		// current medium
					let eta2 = (vecDot(ray.dir, normal) < 0) ? minShape.refrIndex : matRefrIndex[materialStack[materialStack.length - 2]];	// enter or exit medium
					if (eta2 == undefined) {
						throw new Error("exited all materials: check consistency of objects")
					}
					let etaRatio = eta1 / eta2;
					let cosTheta2Sq = 1 - etaRatio * etaRatio * (1 - cosTheta1 * cosTheta1);
					if (cosTheta2Sq < 0) {	// total internal reflection
						let reflectDir = vecPlus(ray.dir, vecScalar(2 * cosTheta1, normal));
						transmittedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, depth + 1, importance, materialStack);
					} else {
						let plusMinus = (cosTheta1 < 0) ? -1 : 1;		// used in refractDir to make sure angle is right depending on whether we're entering or exiting (because normal points out of surface)
						let refractDir = vecPlus(vecScalar(etaRatio, ray.dir), vecScalar(etaRatio * cosTheta1 - plusMinus * Math.sqrt(cosTheta2Sq), normal));
						if (cosTheta1 < 0) {	// exiting medium
              if (debug) { console.log(`(exit ${materialStack[materialStack.length - 1]})`); }
							materialStack.pop();
						} else {		// entering medium
              if (debug) { console.log(`(enter ${minShape._material})`); }
							materialStack = [...materialStack, minShape._material];
						}
						let refractedColour = this.traceRay(new Ray(intersection, refractDir), maxDist - minIntersectionDist, depth + 1, importance, materialStack);
						transmittedColour = refractedColour;
					}
          if (debug) { console.log(`transmitting ${JSON.stringify(transmittedColour)}`); }
					return transmittedColour;
				} else {	// not transparent: reflect or absorb
					if (cosTheta1 < 0) {
						console.log(`Inside an opaque object #${minS}, a [material ${minShape._material}] ${minShape.type}? at ${intersection}; material stack is ${materialStack}`);
						console.log(`  coming from ${ray.origin}, direction ${ray.dir}`);
						let proj = this.projectToCanvas(intersection);
						this.ctx.strokeStyle = "red";
						this.ctx.beginPath();
						this.ctx.arc(proj.x, proj.y, 10, 0, 2 * Math.PI);
						this.ctx.stroke();
						return { r: 0, g: 0, b: 0, a: 1 };
						//return undefined;
					} else {
						if (minShape.reflectance < 1) {
							directColour = this.directLight(vecPlus(intersection, vecScalar(EPSILON, normal)), normal, localColour);
						}
						if (Math.random() < minShape.reflectance && Math.random() < minShape.specular) { 	// specular reflection; diffuse is handled by photons
							let reflectDir = vecPlus(ray.dir, vecScalar(2 * cosTheta1, normal));
							transmittedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, depth + 1, importance * minShape.reflectance, materialStack);
							//let perturbDir = reflectDir;
							//if (Math.random() > minShape.specular) {		// for Lambertian reflectance, perturb the vector
							//	perturbDir = vecPerturb(normal);
							//}
							//transmittedColour = this.traceRay(new Ray(intersection, perturbDir), maxDist - minIntersectionDist, depth + 1, importance * minShape.reflectance, materialStack);
						}
						
						//let dRad = 0.25 //+ 2 * this.photonKdTDiffuse.nearestNeighbourAndDistance(intersection)[1]; // diffuse search radius: find nearest photon then search in a larger radius around it
						let photonDiffuseColour = { r: 0, g: 0, b: 0, a: 1 };
						let nearPhotonsDiffuse = this.photonKdTDiffuse.nearestNeighbours(intersection, DIFFUSE_RADIUS);
						/*let dRad = 0.5	// diffuse search radius
						let nearPhotonsDiffuse = [];
						for (let attempt = 0; attempt < 10; attempt++) {							
							nearPhotonsDiffuse = this.photonKdTDiffuse.nearestNeighbours(intersection, dRad);
							if (nearPhotonsDiffuse.length < 10) {
								dRad *= 3;
							} else {
								break;
							}
						}
						if (nearPhotonsDiffuse.length < 3) {
							nearPhotonsDiffuse = [];
						}*/
            for (let p of nearPhotonsDiffuse) {
							for (let component of ["r", "g", "b"]) {
								photonDiffuseColour[component] += p.colour[component] * p.power * Math.max(0, vecDot(p.dir, normal));
								//photonDiffuseColour[component] += p.colour[component] * p.power;
              }
						}

						//let cRad = 0.25 //+ 2 * this.photonKdTCaustic.nearestNeighbourAndDistance(intersection)[1]; // diffuse search radius: find nearest photon then search in a larger radius around it
						let photonCausticColour = { r: 0, g: 0, b: 0, a: 1 };
						let nearPhotonsCaustic = this.photonKdTCaustic.nearestNeighbours(intersection, CAUSTIC_RADIUS);
						/*let cRad = 0.05	// caustic search radius
						let nearPhotonsCaustic = [];
						for (let attempt = 0; attempt < 10; attempt++) {
							nearPhotonsCaustic = this.photonKdTCaustic.nearestNeighbours(intersection, cRad);
							if (nearPhotonsCaustic.length < 10) {
								cRad *= 3;
							} else {
								break;
							}
						}
						if (nearPhotonsCaustic.length < 3) {
							nearPhotonsCaustic = [];
						}*/
            for (let p of nearPhotonsCaustic) {
              for (let component of ["r", "g", "b"]) {
                photonCausticColour[component] += p.colour[component] * p.power * Math.max(0, vecDot(p.dir, normal));
                //photonCausticColour[component] += p.colour[component] * p.power;
              }
            }
            for (let component of ["r", "g", "b"]) {
              //photonDiffuseColour[component] /= (Math.PI * Math.PI * dRad * dRad);	// should there be an extra factor of pi because Lambertian diffusion is (maximum) 1/pi in all directions?
							photonDiffuseColour[component] *= localColour[component] / 255;
							photonDiffuseColour[component] /= DIFFUSE_AREA; // (Math.PI * dRad * dRad);
							
							photonCausticColour[component] *= localColour[component] / 255;
              photonCausticColour[component] /= CAUSTIC_AREA; // (Math.PI * cRad * cRad);
            }

						for (let component of ["r", "g", "b"]) {
							rayCol[component] = (1 - minShape.reflectance) * directColour[component];
							rayCol[component] += transmittedColour[component];
              rayCol[component] += photonDiffuseColour[component];
							rayCol[component] += photonCausticColour[component];
						}
						return rayCol;
					}
				}
			}

			for (let component of ["r", "g", "b"]) {
				rayCol[component] = directColour[component];
				rayCol[component] += transmittedColour[component];
				rayCol[component] = clamp(rayCol[component], 0, 255);
			}
			return rayCol;
		}
		if (debug) {
			console.log(`nothing there (ray at ${ray.origin} in direction ${ray.dir})`);
		}
		return COL_VERY_DARK_GREY;
	}

	directLight(point, normal, localColour) {
		let col = { r: 0, g: 0, b: 0, a: 1 };		

		for (let l = 0; l < this.lights.length; l++) {
			let s = this.shapes[this.lights[l]];
			for (let p = 0; p < LIGHT_PATHS_PER_SOURCE_PER_RAY; p++) {
				let photon = this.createPhoton();	// random spot on a light source
				
				photon.power *= s.area;	// each photon acts as a representative for the area of its source; power * area gives intensity
				let ray = new Ray(point, vecMinus(photon.origin, point));
				let sourceDist = vecLength(vecMinus(point, photon.origin));
				// see if another shape is in the way
				let occulted = false;
				for (let s2 = 0; s2 < this.shapes.length && !occulted; s2++) {
					let t = ray.intersectDist(this.shapes[s2]);
					if (t > EPSILON && t < sourceDist - EPSILON && !this.shapes[s2].isLight) { occulted = true;	}
				}
				/*if (debug) {
					let projStart = this.projectToCanvas(point);
					let projEnd = this.projectToCanvas(photon.origin);
					this.ctx.strokeStyle = occulted ? "rgb(255,0,0)" : "rgb(0,255,0)";
					this.ctx.lineWidth = 1;
					this.ctx.beginPath();
					this.ctx.moveTo(projStart.x, projStart.y);
					this.ctx.lineTo(projEnd.x, projEnd.y);
					this.ctx.stroke();	
				}*/
				if (!occulted) {
					for (let component of ["r", "g", "b"]) {
						//col[component] += photon.colour[component] / 255 * localColour[component];
						//col[component] += (photon.colour[component] / 255) * localColour[component] * vecDot(ray.dir, normal) * photon.power / 100;
						col[component] += (photon.colour[component] / 255) * localColour[component] * vecDot(ray.dir, normal);// * photon.power / 100;
					}
				}
			}
		}
		for (let component of ["r", "g", "b"]) {
			col[component] = Math.floor(col[component] / LIGHT_PATHS_PER_SOURCE_PER_RAY);
		}		
		return col;
	}
}

function qRoots(a, halfB, c) {
	if (a == 0) {
		if (halfB == 0) {
			return undefined;	// if c == 0 also, then all x is a solution
		}
		return -c / (2 * halfB);
	}

	let discriminant = halfB * halfB - a * c;
	if (discriminant < 0) {
		return undefined;
	}

	discriminant = Math.sqrt(discriminant);
	return [(-halfB - discriminant) / a, (-halfB + discriminant) / a];
}

function getPixel(ctx, x, y) {
	let pixelData = ctx.getImageData(x, y, 1, 1).data
	return {
		r: pixelData[0],
		g: pixelData[1],
		b: pixelData[2],
		a: pixelData[3]
	}
}

function splat(ctx, colour, x, y, size) {
	if (size == undefined) {
		let gotSize = false;
		for (size = 0; size < 100 && !gotSize; size++) {
			for (let i = 0; i < 10; i++) {
				let theta = Math.PI / 180 * Math.random();
				let neighbourX = x + Math.round((size + 1) * Math.cos(theta));
				let neighbourY = y + Math.round((size + 1) * Math.sin(theta));
				let neighbourCol = getPixel(ctx, neighbourX, neighbourY);
				if (neighbourCol.r || neighbourCol.g || neighbourCol.b || neighbourX > ctx.width || neighbourY > ctx.height) {
					gotSize = true;
				}
			}
		}
	}

	if (size == 1) {
		return putPixel(ctx, colour, x, y);
	}

	ctx.beginPath();
	ctx.arc(x, y, size, 0, 2 * Math.PI);
	ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + colour.a + ")";
	ctx.fill();
}

function putPixel(ctx, colour, x, y, superSampleScale) {
	let s = (superSampleScale == undefined) ? 1 : SUPER_SAMPLE_BASE ** superSampleScale;
	/*if (Math.random() < 0.25) {
		ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + 0.125 * colour.a + ")";
		ctx.fillRect(x - 10, y - 10, 21, 21);
	}*/

	ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + colour.a + ")";
	ctx.fillRect(x, y, s, s);
}

function discSample(centre, radius, normalDir) {
	let r = Math.sqrt(Math.random()) * radius;
  let theta = 2 * Math.PI * Math.random();
  let [m, n] = vecOrthonormal(normalDir);
  return vecPlus(vecPlus(centre, vecScalar(r * Math.cos(theta), m)), vecScalar(r * Math.sin(theta), n));
}

function getMousePos(canvas, evt) {
	let rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}

function shuffle(ary) {
	ary.sort( (a, b) => Math.random() - 0.5 );
}

// =================================================================================================

function main() {
	let canvas = document.getElementById('canvas');
	let ctx = canvas.getContext('2d');
	ctx.height = canvas.height;
	ctx.width = canvas.width;
  
 	let scene = new Scene(ctx);
  scene.loadPreset(6);
  scene.drawPhotons();
  
  let drawing = false;
  let trace;

  window.addEventListener('keydown', function(evt) {
    let key = evt.keyCode;
    //console.log(`hit key ${key}`);
    if (key == 87) {  // w
      scene.camera.origin[1] += 0.3;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
			scene.drawPhotons();
			drawing = false;			
    }
    if (key == 65) {  // a
      scene.camera.origin[0] -= 0.3;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
			scene.drawPhotons();
			drawing = false;
    }
    if (key == 83) {  // s
      scene.camera.origin[1] -= 0.3;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
			scene.drawPhotons();
			drawing = false;
    }
    if (key == 68) {  // d
      scene.camera.origin[0] += 0.3;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
			scene.drawPhotons();
			drawing = false;
		}
		if (key == 81) {  // q
      scene.camera.origin[2] -= 0.3;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
			scene.drawPhotons();
			drawing = false;
    }
    if (key == 69) {  // e
      scene.camera.origin[2] += 0.3;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
			scene.drawPhotons();
			drawing = false;
		}
		if (key == 84) {	// t
			// do some unrelated test

			let testSize = 10000;
			let now = Date.now();
			for (let i = 0; i < testSize; i++) {
				let point = [10 * Math.random(), 10 * Math.random(), 10 * Math.random()];
				let nnad = scene.photonKdTDiffuse.nearestNeighbourAndDistance(point);
			}
			console.log(`nnad: ${Date.now() - now}`);

			now = Date.now();
			for (let i = 0; i < testSize; i++) {
				let point = [10 * Math.random(), 10 * Math.random(), 10 * Math.random()];
				let nn = scene.photonKdTDiffuse.nearestNeighbours(point, 0.5);
			}
			console.log(`nn 0.5: ${Date.now() - now}`);
		}

		if (key == 32) {	// space
      //console.log(scene.camera);
      if (drawing) {
        drawing = false;
        clearInterval(trace);        
      } else {
				drawing = true;
				superSampleTiles(3);	// draw very approximate picture, then more and more accurate
      }
		}
	}, false);
	
	canvas.addEventListener('mousemove', function(evt) {
		//return;
		let mousePos = getMousePos(canvas, evt);
        
		let radius = 10 / SUB_SAMPLE;
		for (let y = -radius; y <= radius; y++) {
			for (let x = -radius; x <= radius; x++) {
				if (x * x + y * y <= radius * radius) {
					scene.traceOnCanvas(mousePos.x - x, mousePos.y - y);
				}
			}
		}
	}, false);

	canvas.addEventListener('click', function(evt) {
		debug = true;
		let mousePos = getMousePos(canvas, evt);

		/*for (let z = 0; z < 3; z ++) {
			let ray = new Ray([0, 0, z], [0, 1, 0]);
			console.log(z, ray.intersectDist(scene.shapes[1]));
		}*/

    scene.traceOnCanvas(mousePos.x, mousePos.y);
		debug = false;
		
		/*let x, y, z, proj;
		//for (let s = 0, len = this.shapes.length; s < len; s++) {
		for (let s = this.shapes.length; s--; ) {
			if (scene.shapes[s].type == 'sphere') {
				for (let theta = 0; theta < 360; theta += 1) {
					x = scene.shapes[s].centre[0] + scene.shapes[s].radius * Math.cos(Math.PI / 180 * theta);
					y = scene.shapes[s].centre[1] + scene.shapes[s].radius * Math.sin(Math.PI / 180 * theta);
					z = scene.shapes[s].centre[2];
					proj = scene.projectToCanvas([x, y, z));
					putPixel(ctx, COL_WHITE, proj.x, proj.y);

					x = scene.shapes[s].centre[0];
					y = scene.shapes[s].centre[1] + scene.shapes[s].radius * Math.cos(Math.PI / 180 * theta);
					z = scene.shapes[s].centre[2] + scene.shapes[s].radius * Math.sin(Math.PI / 180 * theta);;
					proj = scene.projectToCanvas([x, y, z));
					putPixel(ctx, COL_LIME_GREEN, proj.x, proj.y);

					x = scene.shapes[s].centre[0] + scene.shapes[s].radius * Math.cos(Math.PI / 180 * theta);
					y = scene.shapes[s].centre[1];
					z = scene.shapes[s].centre[2] + scene.shapes[s].radius * Math.sin(Math.PI / 180 * theta);;
					proj = scene.projectToCanvas([x, y, z));
					putPixel(ctx, COL_RED, proj.x, proj.y);
				}
			}
		}*/
	}, false);

	function superSampleTiles(scale) {        
		let tiles = [];
		let tileSize = Math.floor(SUPER_SAMPLE_BASE ** scale * 20 / SUB_SAMPLE);
						
		// count photons (projected onto canvas) per tile to guess which tiles are more interesting; we'll draw high photon tiles first
		// photons also contribute to neighbouring cells, so a cell near a high-photon cell is also interesting (this will help give context, e.g., shadows beside bright objects)
		let tilePhotons = [];
		let tilesX = Math.floor(canvas.width / tileSize) + 1;   //add 1 in case tileSize doesn't divide canvas dimensions
		let tilesY = Math.floor(canvas.height / tileSize) + 1;  // "
		for (let photon of scene.photonListDiffuse) {
			let proj = scene.projectToCanvas(photon.origin);
			if (proj != undefined) {
				let regionX = Math.floor(proj.x / tileSize);
				let regionY = Math.floor(proj.y / tileSize);
				for (let j = -2; j <= 2; j++) {
					for (let i = -2; i <= 2; i++) {
						if (i * i + j * j < 8) {
							let x = regionX + i;
							let y = regionY + j;
							if (regionX >= 0 && regionX < tilesX && regionY >= 0 && regionY < tilesY) {              
								if (tilePhotons[y * tilesX + x] == undefined) { tilePhotons[y * tilesX + x] = 0; }
								tilePhotons[y * tilesX + x]++;
							}
						}
					}
				}
			}
		}
		for (let photon of scene.photonListCaustic) {
			let proj = scene.projectToCanvas(photon.origin);
			if (proj != undefined) {
				let x = Math.floor(proj.x / tileSize);
				let y = Math.floor(proj.y / tileSize);
				if (x >= 0 && x < tilesX && y >= 0 && y < tilesY) {
					if (tilePhotons[y * tilesX + x] == undefined) { tilePhotons[y * tilesX + x] = 0; }
					tilePhotons[y * tilesX + x]++;
				}
			}        
		}
		
		// create tiles and sort them        
		for (let y = 0; y < tilesY; y++) {
			for (let x = 0; x < tilesX; x++) {
				tiles.push({ region: [x * tileSize, y * tileSize], photons: tilePhotons[y * tilesX + x] || 0 });
			}
		}
		shuffle(tiles);	// shuffle first so that when it gets to all the (e.g.) 1-photon tiles, it doesn't just go row by row
		tiles.sort( (a, b) => a.photons - b.photons );

		trace = setInterval(function() {
			if (tiles.length && drawing) {
				let tile = tiles.pop();
				scene.traceTile(tile.region, tileSize, scale);
			} else {
				clearInterval(trace);
				if (scale > 0) {
					superSampleTiles(scale - 1);
				} else {
					drawing = false;
				}
			}
		}, 1);
	}

	//return;

	/*for (let i = 0; i < 1000; i++) {
		setTimeout(function() { scene.traceScene() }, 100);
	}*/
	//let trace = setInterval(function() { scene.traceRandom() }, 10);
    
  //return;
}