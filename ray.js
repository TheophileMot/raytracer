let debug = false;

const EPSILON = 1e-10;
const MAX_TRACE_DIST = 100;
const MAX_DEPTH = 10;
const SUB_SAMPLE = 2;   // split each pixel into virtual SUB_SAMPLE × SUB_SAMPLE grid, then average results.

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
const COL_LIME_GREEN = { r: 112, g: 160, b: 0, a: 1 };
const COL_YELLOW = { r: 240, g: 224, b: 8, a: 1 };
const COL_MAUVE = { r: 64, g: 32, b: 112, a: 1 };
const COL_DEEP_BLUE = { r: 8, g: 8, b: 64, a: 1 };
const COL_SKY_BLUE = { r: 128, g: 128, b: 224, a: 1 };
const COL_WARM_GREY = { r: 144, g: 128, b: 128, a: 1 };
const COL_ORANGE = { r: 224, g: 124, b: 32 };
const COL_DEEP_PINK = { r: 255, g: 32, b: 144 };

// --------------------------------
//            materials
// --------------------------------
const MAT_AIR = 0;
const MAT_OPAQUE = 1;
const MAT_GLASS = 2;
// --------------------------------
// materials: indices of refraction
// --------------------------------
const refr_index = [];
refr_index[MAT_AIR] = 1.0;
refr_index[MAT_OPAQUE] = undefined;
refr_index[MAT_GLASS] = 1.5;

function vecPlus(v, w) { return [v[0] + w[0], v[1] + w[1], v[2] + w[2]]; }
function vecMinus(v, w) { return[v[0] - w[0], v[1] - w[1], v[2] - w[2]]; }
function vecScalar(k, v) { return [k * v[0], k * v[1], k * v[2]]; }
function vecDot(v, w) { return v[0] * w[0] + v[1] * w[1] + v[2] * w[2]; }
function vecCross(v, w) { return [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]]; }
function vecIsZero(v) { return vecSqLength(v) < EPSILON; }
function vecNormalize(v) { return vecIsZero(v) ? [0, 0, 1] : vecScalar(1 / vecLength(v), v); }
function vecSqLength(v) { return vecDot(v, v); }
function vecLength(v) { return Math.sqrt(vecSqLength(v)); }

function colour(col) { return { r: col.r, g: col.g, b: col.b, a: col.a } };

class Shape {
	constructor() {
		this.baseColour = COL_DARK_GREY;
		this.shine = 0.5;
		this.material = MAT_OPAQUE;
		this.transparency = 0;
	}
	colour() { return this.baseColour; }
}

class Cylinder extends Shape {
  constructor(centre, axis, height, radius, baseColour, shine) {
		super();
		
		this.type = 'cylinder';
		this.centre = centre;
		this.axis = vecNormalize(axis);
		this.height = height;
		this.radius = radius;
		this.baseColour = baseColour || COL_WHITE;
		this.shine = (shine == undefined) ? 0.8 : shine;
	}
    
  normal(p) {
		let v = vecMinus(p, this.centre);
		return vecScalar(1 / this.radius, vecMinus(v, vecScalar(vecDot(v, this.axis), this.axis)) );
	}
}

class Sphere extends Shape {
	constructor(centre, radius, baseColour, shine) {
		super();

		this.type = 'sphere';
		this.centre = centre;
		this.radius = radius;
		this.baseColour = baseColour || COL_RED;
		this.shine = (shine == undefined) ? 0.5 : shine;
	}

	normal(p) { return vecScalar(1 / this.radius, vecMinus(p, this.centre)); }			// unit vector if p is actually on sphere!
}

class Plane extends Shape {
	constructor(origin, normalDir, baseColour, shine) {
		super();

		this.type = 'plane';
		this.origin = origin;
		this.normalDir = vecNormalize(normalDir);
		this.baseColour = baseColour || COL_DEEP_BLUE;
		this.shine = (shine == undefined) ? 0.1 : shine;
	}

	normal() { return this.normalDir; }
}

class Ray {
	constructor(origin, dir) {
		this.origin = origin;
		this.dir = vecNormalize(dir);
	}

	intersectDist(shape) {
		if (shape.type == 'plane') {
			let a = shape.origin;
			let n = shape.normal();

			if (Math.abs(vecDot(this.dir, n)) < EPSILON) {
				return undefined;
			}

			let t = vecDot(vecMinus(a, this.origin), n) / vecDot(this.dir, n);
			return t > 0 ? t : undefined;
		} else if (shape.type == 'sphere') {
			let a = 1;
			let halfB = vecDot(this.dir, vecMinus(this.origin, shape.centre));
			let c = vecSqLength(vecMinus(this.origin, shape.centre)) - shape.radius * shape.radius;

			let t = qRoots(a, halfB, c);
			/*if (t == undefined || t[0] <= 0) {
				return undefined;
			}
			return t[0];*/
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
		} else if (shape.type == 'cylinder') {
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

			if (false) {
				console.log('ray: ', this.origin, this.dir);
				console.log('vd: ', vd);
				console.log('va: ', va);
				console.log('da: ', da);
				console.log('a: ', a);
				console.log('1/2 b: ', halfB);
				console.log('c: ', c);
				console.log(t);
			}

			if (t == undefined || t[0] <= 0) {
				return undefined;
			}
			return t[0];
    }
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
	}

	loadPreset(def) {
		switch (def) {
			case 0:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_WHITE, 0.2),
					new Plane([0, 80, 0], [0, -1, 0], COL_SKY_BLUE),
					new Plane([0, -80, 0], [0, 1, 0], COL_VERY_DARK_GREY),
					new Plane([80, 0, 0], [-1, 0, 0], COL_VERY_DARK_GREY),
					new Plane([-80, 0, 0], [1, 0, 0], COL_VERY_DARK_GREY),
					new Plane([0, 0, 80], [1, 0, -1], COL_VERY_DARK_GREY),
					//new Plane([0, 0, 80], [1, 0, -1], COL_WHITE),
					// */
					new Sphere([0.3, 0, 0.9], 0.4, COL_RED, 0.90),
					new Sphere([-1.1, 1.2, 0.25], 0.25, COL_MAUVE, 0.45),
					new Sphere([0.5, 2.5, 1.25], 1.25, COL_BLACK, 0.3),
					new Sphere([-1.5, -2.5, 0.8], 0.8, COL_ORANGE, 0.25),
					//new Cylinder([-2.5, 4, 0], [0, 0, 1], 1, 1.5, COL_LIME_GREEN, 0.3),
				];
				//this.shapes[0].colour = p => { return (Math.abs(p[0]) % 2 < 1) ? COL_DEEP_BLUE : lightCOL_GREY; };
				this.shapes[0].colour = function(p) {
					//let x = Math.floor(p[0]);
					//let y = Math.floor(p[1]);
					//let index = (x & 1) + (y & 1);
								//return [COL_DEEP_PINK, COL_VERY_DARK_GREY, COL_MAUVE][index];
					
					/*let f = p[0] * p[0] + p[1] * p[1];
					let index = 2;
					if ((f >= 2 && f <= 3) || (f >= 11 && f <= 12)) {
						index = 1;
					} else if (f >= 5 && f <= 10) {
						index = 0;
					}
					// */
					
					let f = Math.sin(p[0]) + p[1];
					let index;
					if (f > 0 && f < 1) {
						index = 0;
					} else {
						//index = 1 + (Math.floor(p[0]) & 1) + (Math.floor(p[1]) & 1);
						index = 1 + ((Math.floor(p[0] / 4) + Math.floor(p[1] / 4 )) & 1);
					}
					return [COL_DEEP_PINK, COL_GREY, COL_BLACK, COL_DEEP_BLUE][index];
				}
				this.shapes[6].material = MAT_GLASS;
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

				this.camera = new Camera([-0.3, -4, 1], [0, 1, -0.1], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 1:
				this.shapes = [
					new Plane([0, 0, 0], [0, 0, 1], COL_WHITE, 0.2),
					new Plane([0, 80, 0], [0, -1, 0], COL_SKY_BLUE),
					new Plane([0, -80, 0], [0, 1, 0], COL_VERY_DARK_GREY),
					new Plane([80, 0, 0], [-1, 0, 0], COL_VERY_DARK_GREY),
					new Plane([-80, 0, 0], [1, 0, 0], COL_VERY_DARK_GREY),
					new Plane([0, 0, 80], [1, 0, -1], COL_VERY_DARK_GREY),

					new Sphere([0.3, 0, 0.5], 0.45, COL_RED, 0.50),
					new Sphere([-1.1, 1.2, 0.25], 0.25, COL_MAUVE, 0.45),
					new Sphere([0.5, 7, 1.25], 1.25, COL_BLACK, 0.3),
					new Sphere([-1.5, -2.5, 0.8], 0.8, COL_ORANGE, 0.25),
	
					new Plane([0, 4.25, 0], [0, -1, 0], COL_WHITE, 0.95),
					new Plane([0, 4.35, 0], [0, 1, 0], COL_WHITE, 0.95),
				];
				this.shapes[0].colour = function(p) {
					let f = Math.sin(p[0]) + p[1];
					let index;
					if (f > 0 && f < 1) {
						index = 0;
					} else {
						index = 1 + (Math.floor(p[0] * 2) & 1) + (Math.floor(p[1] * 2) & 1)
					}
					return [COL_DEEP_PINK, COL_GREY, COL_BLACK, COL_DEEP_BLUE][index];
				}
				this.shapes[9].material = MAT_GLASS;
				this.shapes[10].material = MAT_GLASS;
				this.shapes[11].material = MAT_GLASS;
				/*this.shapes[8].colour = function(p) {		// 8-ball
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
				}*/

				this.camera = new Camera([-0.3, -6, 3], [0, 1, -0.2], [0, 0, 1], this.canvasWidth, this.canvasHeight);
				break;
			case 2:
				this.shapes = [
					new Plane([0, 0, -1], [0, 0, 1], COL_GREY, 0.1),
					new Sphere([0, 0, 0], 1, COL_RED, 0.5)
				];
				this.shapes[1].material = MAT_GLASS;

				this.camera = new Camera([-0.3, -6, 1.5], [0, 1, -0.2], [0, 0, 1], this.canvasWidth, this.canvasHeight);
			default:
				break;
		}

		//this.camera = new Camera([1, -4, 5], [0, 1, -0.9], [0, 0, 1], this.canvasWidth, this.canvasHeight);		
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
    
	traceTile(tile, tileSize) {
		let x, y;
		for (y = 0; y < tileSize; y++) {
			for (x = 0; x < tileSize; x++) {
				this.traceOnCanvas(tile[0] + x, tile[1] + y, MAX_TRACE_DIST, MAX_DEPTH);
			}
		}
	}

	traceOnCanvas(canvasX, canvasY, maxDist, maxDepth) {
		maxDist = maxDist || MAX_TRACE_DIST;
		if (maxDepth == undefined) {
			maxDepth = MAX_DEPTH;
		}

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
				/*let lensSample = discSample(0.0025);
				let origin = this.camera.toXYZ([lensSample.x, lensSample.y, 0));*/
				ray = new Ray(origin, vecMinus(xyz, origin));
				rayCol = colour(this.traceRay(ray, maxDist, maxDepth, 1, [MAT_AIR]));	// wrap it in colour function to prevent overwriting named colours

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
		putPixel(this.ctx, rayCol, canvasX, canvasY);
	}

	traceRay(ray, maxDist, depth, importance, material_stack) {
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
		let minShape;
		//for (let s = 0, len = this.shapes.length; s < len; s++) {
		for (let s = this.shapes.length; s--; ) {
			let t = ray.intersectDist(this.shapes[s]);
			if (debug) {
				console.log(`  calc intersection with shape ${s}: ${t}`);
			}

			if (t > EPSILON && t < minIntersectionDist) {
				minIntersectionDist = t;
				minShape = s;
			}
		}
		if (minIntersectionDist < Infinity) {
			let intersection = vecPlus(ray.origin, vecScalar(minIntersectionDist, ray.dir));
			let shapeCol = this.shapes[minShape].colour(intersection);
			let normal = this.shapes[minShape].normal(intersection);

			if (debug) {
				console.log(`hitting shape ${minShape}, a ${this.shapes[minShape].type} with shine ${this.shapes[minShape].shine}`);
				console.log(`  material stack: ${material_stack}`)
				let laserEnd = this.projectToCanvas(intersection);
				if (laserEnd != undefined && ray.origin != this.camera.origin) {
					this.ctx.lineTo(laserEnd.x, laserEnd.y);
					this.ctx.stroke();
				}
			}

			let rayCol = { r: 0, g: 0, b: 0, a: 1 };

			let reflectedColour = shapeCol;
			if (minIntersectionDist < maxDist || depth > 0) {	// hit something: reflect or refract
				let cosTheta1	= -vecDot(ray.dir, normal);
				if (this.shapes[minShape].material == MAT_OPAQUE) {					
					if (cosTheta1 < 0) {
						console.log(`Inside an opaque object #${minShape}, a ${this.shapes[minShape].type}? at ${intersection}; material stack is ${material_stack}`);
						console.log(`  coming from ${ray.origin}, direction ${ray.dir}`);
						console.log(`  hit object ${minShape}, a ${this.shapes[minShape].type}`);
						let proj = this.projectToCanvas(intersection);
						this.ctx.strokeStyle = "red";
						this.ctx.beginPath();
						this.ctx.arc(proj.x, proj.y, 10, 0, 2 * Math.PI);
						this.ctx.stroke();
						return undefined;
					} else {
						let reflectDir = vecPlus(ray.dir, vecScalar(2 * cosTheta1, normal));
						reflectedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, depth - 1, importance * this.shapes[minShape].shine, material_stack);
					}					
				} else {
					let eta1 = refr_index[material_stack[material_stack.length - 1]];		// current medium
					let eta2 = (vecDot(ray.dir, normal) < 0) ? refr_index[this.shapes[minShape].material] : refr_index[material_stack[material_stack.length - 2]];	// enter or exit medium
					let etaRatio = eta1 / eta2;					
					let cosTheta2Sq = 1 - etaRatio * etaRatio * (1 - cosTheta1 * cosTheta1);
					if (debug) {
						console.log(`eta ratio: ${etaRatio}`)
					}
					if (cosTheta2Sq < 0) {	// total internal reflection
						if (debug) {
							console.log(`total internal reflection`);
						}
						let reflectDir = vecPlus(ray.dir, vecScalar(2 * cosTheta1, normal));
						reflectedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, depth - 1, importance * this.shapes[minShape].shine, material_stack);
					} else {
						let plusMinus = (cosTheta1 < 0) ? -1 : 1;		// used in refractDir to make sure angle is right depending on whether we're entering or exiting (because normal points out of surface)
						let refractDir = vecPlus(vecScalar(etaRatio, ray.dir), vecScalar(etaRatio * cosTheta1 - plusMinus * Math.sqrt(cosTheta2Sq), normal));
						if (debug) {
							console.log(`refraction. MS is ${material_stack}`);
						}
						if (cosTheta1 < 0) {	// exiting medium
							material_stack.pop();
							if (debug) {
								console.log(`exiting medium; now MS is ${material_stack}`);
							}
						} else {		// entering medium
							material_stack = [...material_stack, this.shapes[minShape].material];
							if (debug) {
								console.log(`entering medium; now MS is ${material_stack}`);
							}
						}
						if (debug) {
							console.log(`refract at ${intersection}`);
							console.log(`    in dir ${refractDir}`);
						}
						reflectedColour = this.traceRay(new Ray(intersection, refractDir), maxDist - minIntersectionDist, depth - 1, importance * this.shapes[minShape].shine, material_stack);
					}
				}

				/*if (vecDot(ray.dir, normal) > 0) {
					//return COL_BLACK;
				} else {
          let reflectDir = vecMinus(ray.dir, vecScalar(2 * vecDot(ray.dir, normal), normal));
					reflectedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, depth - 1, importance * this.shapes[minShape].shine);
				}*/
			}

			for (let component of ["r", "g", "b"]) {
        let grainy = 0; //-2 * SUB_SAMPLE + Math.random() * (4 * SUB_SAMPLE + 1);
				rayCol[component] = Math.round(grainy + (1 - this.shapes[minShape].shine) * shapeCol[component] + this.shapes[minShape].shine * reflectedColour[component]);
				if (rayCol[component] < 0) {
					rayCol[component] = 0;
				} else if (rayCol[component] > 255) {
					rayCol[component] = 255;
				}
			}
			return rayCol;
		}
		if (debug) {
			console.log(`nothing there (ray at ${ray.origin} in direction ${ray.dir})`);
		}
		return COL_VERY_DARK_GREY;
		//let fade = Math.floor(128 * Math.exp(-(maxDist / 100)));
		//return { r: fade, g: fade, b: fade, a: 1 };
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

function putPixel(ctx, colour, x, y) {
	/*if (Math.random() < 0.25) {
		ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + 0.125 * colour.a + ")";
		ctx.fillRect(x - 10, y - 10, 21, 21);
	}*/

	ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + colour.a + ")";
	ctx.fillRect(x, y, 1, 1);
}

function discSample(radius) {
	let r = Math.sqrt(Math.random()) * radius;
	let theta = 2 * Math.PI * Math.random();
	return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

function getMousePos(canvas, evt) {
	let rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// =================================================================================================

function main() {
	let canvas = document.getElementById('canvas');
	let ctx = canvas.getContext('2d');
	ctx.height = canvas.height;
	ctx.width = canvas.width;

	canvas.addEventListener('mousemove', function(evt) {
		//return;
		let mousePos = getMousePos(canvas, evt);
        
		let radius = 100 / SUB_SAMPLE;
		for (let y = -radius; y <= radius; y++) {
			for (let x = -radius; x <= radius; x++) {
				if (x * x + y * y <= radius * radius) {
					scene.traceOnCanvas(mousePos.x - x, mousePos.y - y, MAX_TRACE_DIST, MAX_DEPTH);
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

		scene.traceOnCanvas(mousePos.x, mousePos.y, MAX_TRACE_DIST, MAX_DEPTH)
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
    
 	let scene = new Scene(ctx);
	scene.loadPreset(1);
	//return;

	/*for (let i = 0; i < 1000; i++) {
		setTimeout(function() { scene.traceScene() }, 100);
	}*/
	//let trace = setInterval(function() { scene.traceRandom() }, 10);
    
	let now = Date.now();
	
	let tiles = [];
	let tileSize = Math.floor(200 / (SUB_SAMPLE * SUB_SAMPLE));
	for (let y = 0; y < canvas.height / tileSize; y++) {
		for (let x = 0; x < canvas.width / tileSize; x++) {
			tiles.push([x * tileSize, y * tileSize]);
		}
	}
	tiles = shuffle(tiles);

	//return;

	let trace = setInterval(function() {
		if (tiles.length) {
			let tile = tiles.pop();
			scene.traceTile(tile, tileSize);
		} else {
			clearInterval(trace);
		}        
	}, 10);
}