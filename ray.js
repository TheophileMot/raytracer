const EPSILON = 1e-4;
const MAX_TRACE_DIST = 200;
const SUB_SAMPLE = 1;
const black = { r: 0, g: 0, b: 0, a: 0 };
const white = { r: 255, g: 255, b: 255, a: 1 };
const darkgrey = { r: 64, g: 64, b: 64, a: 1 };
const verydarkgrey = { r: 16, g: 16, b: 16, a: 1 };
const grey = { r: 128, g: 128, b: 128, a: 1 };
const silver = { r: 192, g: 192, b: 192, a: 1 };
const red = { r: 192, g: 0, b: 0, a: 1 };
const limegreen = { r: 112, g: 160, b: 0, a: 1 };
const yellow = { r: 224, g: 224, b: 32, a: 1 };
const mauve = { r: 64, g: 32, b: 112, a: 1 };
const deepblue = { r: 8, g: 8, b: 64, a: 1 };
const skyblue = { r: 128, g: 128, b: 224, a: 1 };
const warmgrey = { r: 144, g: 128, b: 128, a: 1 };
const orange = { r: 168, g: 192, b: 56 };
const deeppink = { r: 255, g: 32, b: 144 };

cl = x => console.log(x);

class Vector {
	constructor(x, y, z) {
		this[0] = x;
		this[1] = y;
		this[2] = z;
	}

	plus(w) { return new Vector(this[0] + w[0], this[1] + w[1], this[2] + w[2]); }
	minus(w) { return new Vector(this[0] - w[0], this[1] - w[1], this[2] - w[2]); }
	scalar(k) { return new Vector(k * this[0], k * this[1], k * this[2]); }
	dot(w) { return this[0] * w[0] + this[1] * w[1] + this[2] * w[2]; }
	cross(w) { return new Vector(this[1] * w[2] - this[2] * w[1], this[2] * w[0] - this[0] * w[2], this[0] * w[1] - this[1] * w[0]); }

	isZero() { return this.sqlength < EPSILON; }

	normalize() { return this.isZero() ? [0, 0, 1] : this.scalar(1 / this.length); }

	get sqlength() { return this.dot(this); }
	get length() { return Math.sqrt(this.sqlength); }
}

class Shape {
	constructor() {
		this.baseColour = darkgrey;
		this.shine = 0.5;
	}
	colour() { return this.baseColour; }
}

class Sphere extends Shape {
	constructor(centre, radius, baseColour, shine) {
		super();

		this.type = 'sphere';
		this.centre = centre;
		this.radius = radius;
		this.baseColour = baseColour || red;
		this.shine = shine || 0.5;
	}

	normal(p) { return p.minus(this.centre).scalar(1 / this.radius); }			// unit vector if p is actually on sphere!
}

class Plane extends Shape {
	constructor(origin, normalDir, baseColour, shine) {
		super();

		this.type = 'plane';
		this.origin = origin;
		this.normalDir = normalDir.normalize();
		this.baseColour = baseColour || deepblue;
		this.shine = shine || 0.1;
	}

	normal() { return this.normalDir; }
}

class Ray {
	constructor(origin, dir) {
		this.origin = origin;
		this.dir = dir.normalize();
	}

	intersectDist(shape) {
		if (shape.type == 'plane') {
			let a = shape.origin;
			let n = shape.normal();

			if (Math.abs(this.dir.dot(n)) < EPSILON) {
				return undefined;
			}

			let t = a.minus(this.origin).dot(n) / this.dir.dot(n);
			return t > 0 ? t : undefined;
		} else if (shape.type == 'sphere') {
			let a = this.dir.sqlength;
			let halfB = this.dir.dot(this.origin.minus(shape.centre));
			let c = this.origin.minus(shape.centre).sqlength - shape.radius * shape.radius;

			let t = qRoots(a, halfB, c);
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
		this.fieldOfView = fieldOfView || 60;
		this.fovRadians = Math.PI / 180 * (this.fieldOfView / 2);
		this.fovScaleWidth = Math.tan(this.fovRadians);
		this.fovScaleHeight = this.fovScaleWidth * this.height / this.width;		
		// find orthonormal basis corresponding to camera angle
		this.up = up;
		this.ONBw = gazeDir.scalar(-1).normalize();
		this.ONBu = this.up.normalize().cross(this.ONBw);
		this.ONBv = this.ONBw.cross(this.ONBu);
	}

	toUVW(xyz) {
		let transXyz = xyz.minus(this.origin);
		return new Vector(transXyz.dot(this.ONBu), transXyz.dot(this.ONBv), transXyz.dot(this.ONBw));
	}
	toXYZ(uvw) { return this.origin.plus(this.ONBu.scalar(uvw[0])).plus(this.ONBv.scalar(uvw[1])).plus(this.ONBw.scalar(uvw[2])) };
}

class Scene {
	constructor(ctx) {
		this.ctx = ctx;
		this.canvasWidth = ctx.width;
		this.canvasHeight = ctx.height;
	}

	loadDefault() {
		this.shapes = [
			new Plane(new Vector(0, 0, 0), new Vector(0, 0, 1), deepblue, 0.65),
			new Plane(new Vector(0, 80, 0), new Vector(0, -1, 0), verydarkgrey),
			new Plane(new Vector(0, -80, 0), new Vector(0, 1, 0), verydarkgrey),
			new Plane(new Vector(80, 0, 0), new Vector(-1, 0, 0), verydarkgrey),
			new Plane(new Vector(-80, 0, 0), new Vector(1, 0, 0), verydarkgrey),
			new Plane(new Vector(0, 0, 80), new Vector(0, 0, -1), verydarkgrey),
			new Sphere(new Vector(0, 0, 0.5), 0.5, red, 0.80),
			new Sphere(new Vector(1, 0.4, 0.25), 0.25, mauve, 0.75),
			new Sphere(new Vector(0.5, 2, 1.25), 1.25, silver, 0.6),
		];
		//this.shapes[0].colour = p => { return (Math.abs(p[0]) % 2 < 1) ? deepblue : lightgrey; };
		this.shapes[0].colour = function(p) {
			let x = Math.floor(p[0]);
			let y = Math.floor(p[1]);
			let index = (x & 1) + (y & 1);
			return [deeppink, verydarkgrey, mauve][index];
		}

		/*for (let j = -5; j <= 5; j++) {
			for (let i = -5; i <= 5; i++) {
				this.shapes.push(new Sphere(new Vector(i, j, 0), 0.125));
			}
		}*/

		this.camera = new Camera(new Vector(0, -4, 2), new Vector(0, 1, -0.3), new Vector(0, 0, 1), this.canvasWidth, this.canvasHeight);
	}

	projectToCanvas(xyz) {
		let uvw = this.camera.toUVW(xyz);
		console.log(`----- entering`)
		console.log(`xyz: ${xyz[0]} ${xyz[1]} ${xyz[2]}`)
		console.log(`uvw: ${uvw[0]} ${uvw[1]} ${uvw[2]}`)
		if (uvw[2] == 0) {
			return { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
		}
		// project onto plane w = -1
		let u = -uvw[0] / uvw[2];
		let v = -uvw[1] / uvw[2];
		u /= this.camera.fovScaleWidth;
		v /= this.camera.fovScaleHeight;

		console.log(`projected uv: ${u} ${v}`)
		console.log(`canvas: ${(u + 1) * this.canvasWidth / 2} ${(-v + 1) * this.canvasHeight / 2}`)
		console.log(`----- exiting`)
		return { x: (u + 1) * this.canvasWidth / 2, y: (-v + 1) * this.canvasHeight / 2 };
	}

	traceScene() {
		//for (let canvasY = 0; canvasY < this.canvasHeight; canvasY++) {
		//	for (let canvasX = 0; canvasX < this.canvasWidth; canvasX++) {
		for (let i = 0; i < 1000; i++) {
				let x = this.canvasWidth * Math.random();
				let	y = this.canvasHeight * Math.random();
				
				this.traceOnCanvas(x, y);
				//this.traceOnCanvas(canvasX, canvasY);
		//	}
		}
	}

	traceOnCanvas(canvasX, canvasY, maxDist) {
		maxDist = maxDist || MAX_TRACE_DIST;

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

				xyz = this.camera.toXYZ(new Vector(u, v, w));
				ray = new Ray(this.camera.origin, xyz.minus(this.camera.origin));
				rayCol = this.traceRay(ray, maxDist, 1);

				totalCol.r += rayCol.r;
				totalCol.g += rayCol.g;
				totalCol.b += rayCol.b;
				totalCol.a += rayCol.a;
			}
		}
		rayCol.r = Math.floor(totalCol.r / SUB_SAMPLE ** 2);
		rayCol.g = Math.floor(totalCol.g / SUB_SAMPLE ** 2);
		rayCol.b = Math.floor(totalCol.b / SUB_SAMPLE ** 2);
		rayCol.a = Math.floor(totalCol.a / SUB_SAMPLE ** 2);
		putPixel(this.ctx, rayCol, canvasX, canvasY);
		//splat(this.ctx, rayCol, x, y);

		/*let theta = 2 * Math.PI * Math.random();
		let randX = Math.round(x + 20 * Math.cos(theta));
		let randY = Math.round(y + 20 * Math.sin(theta));
		let randCol = getPixel(this.ctx, randX, randY);
		if (Math.random() < 0randCol.r == 0 && randCol.g == 0 && randCol.b == 0) {
			//this.traceOnCanvas(randX, randY, maxDist);
		}
		*/
	}

	traceRay(ray, maxDist, importance) {
		if (importance < 0.01) {
			return white;
		}

		let minIntersectionDist = Infinity;
		let minShape;
		for (let s = 0; s < this.shapes.length; s++) {
			let t = ray.intersectDist(this.shapes[s]);
			if (t > EPSILON && t < minIntersectionDist) {
				minIntersectionDist = t;
				minShape = s;
			}
		}
		if (minIntersectionDist < Infinity) {			
			let intersection = ray.origin.plus(ray.dir.scalar(minIntersectionDist));
			let shapeCol = this.shapes[minShape].colour(intersection);
			let normal = this.shapes[minShape].normal(intersection);

			let rayCol = { r: 0, g: 0, b: 0, a: 1 };

			let reflectedColour = shapeCol;
			if (minIntersectionDist < maxDist) {	// bounce!
				if (ray.dir.dot(normal) > 0) {
					reflectedColour = this.traceRay(ray, maxDist - minIntersectionDist, importance * this.shapes[minShape].shine);
				} else {
					if (true) { //(1 - ray.dir.dot(normal) ** 2 > (1 / 1.75) ** 2) {
						let reflectDir = ray.dir.minus(normal.scalar(2 * ray.dir.dot(normal)));
						reflectedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, importance * this.shapes[minShape].shine);
					} else {
						let refractDir = normal.cross(ray.dir.cross(normal).scalar(1 / 1.75).minus(normal.scalar(1 - (1 / 1.75) ** 2) * normal.cross(ray.dir).sqlength));
						reflectedColour = this.traceRay(new Ray(intersection, refractDir), maxDist - minIntersectionDist, importance * this.shapes[minShape].shine);
					}
				}


				//let reflectDir = ray.dir.minus(normal.scalar(2 * ray.dir.dot(normal)));
				//reflectedColour = this.traceRay(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, importance * this.shapes[minShape].shine);
			}

			for (let component of ["r", "g", "b"]) {
				//rayCol[component] = Math.round(-2 + 5 * Math.random() + (1 - this.shapes[minShape].shine) * shapeCol[component] + this.shapes[minShape].shine * reflectedColour[component]);
				rayCol[component] = Math.round((1 - this.shapes[minShape].shine) * shapeCol[component] + this.shapes[minShape].shine * reflectedColour[component]);
			}
			return rayCol;
		}
		return verydarkgrey;
		//let fade = Math.floor(128 * Math.exp(-(maxDist / 100)));
		//return { r: fade, g: fade, b: fade, a: 1 };
	}

	shootLaserOnCanvas(canvasX, canvasY, maxDist, width) {
		//doesn't quite work yet. ;(
		return;

		maxDist = maxDist || MAX_TRACE_DIST;
		width = width || 1;

		let subSampleX = Math.floor(SUB_SAMPLE * Math.random());
		let subSampleY = Math.floor(SUB_SAMPLE * Math.random());
		let u = ((canvasX + (subSampleX + Math.random()) / SUB_SAMPLE) * 2 / this.canvasWidth) - 1;
		let v = -(((canvasY + (subSampleY + Math.random()) / SUB_SAMPLE) * 2 / this.canvasHeight) - 1);
		let w = -1;

		u *= this.camera.fovScaleWidth;
		v *= this.camera.fovScaleHeight;

		let xyz = this.camera.toXYZ(new Vector(u, v, w));
		let laser = new Ray(this.camera.origin, xyz.minus(this.camera.origin));
		this.shootLaser(laser, maxDist, width);
	}

	shootLaser(ray, maxDist, width) {
		if (width < 0.01) {
			return;
		}

		let laserStart = this.projectToCanvas(ray.origin);

		this.ctx.beginPath();
		this.ctx.lineWidth = width;
		this.ctx.strokeStyle = "white";		
		this.ctx.moveTo(laserStart.x, laserStart.y);
		if (laserStart.x == 0 && laserStart.y == 0) {
			cl(ray.origin)
		}

		let minIntersectionDist = Infinity;
		let minShape;
		for (let s = 0; s < this.shapes.length; s++) {
			let t = ray.intersectDist(this.shapes[s]);
			if (t > EPSILON && t < minIntersectionDist) {
				minIntersectionDist = t;
				minShape = s;
			}
		}
		if (minIntersectionDist < Infinity) {			
			let intersection = ray.origin.plus(ray.dir.scalar(minIntersectionDist));
			let laserEnd = this.projectToCanvas(intersection);
			this.ctx.lineTo(laserEnd.x, laserEnd.y);
			this.ctx.stroke();

			//let shapeCol = this.shapes[minShape].colour(intersection);
			let normal = this.shapes[minShape].normal(intersection);

			//let rayCol = { r: 0, g: 0, b: 0, a: 1 };

			//let reflectedColour = shapeCol;
			if (minIntersectionDist < maxDist) {	// bounce!
				let reflectDir = ray.dir.minus(normal.scalar(2 * ray.dir.dot(normal)));
				//this.shootLaser(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, width * this.shapes[minShape].shine);
				this.shootLaser(new Ray(intersection, reflectDir), maxDist - minIntersectionDist, width);
			}
			return;
		}
		//draw off screen
		return;
	}
}

function qRoots(a, halfB, c) {
	if (a == 0) {
		if (halfB == 0)
			return undefined;	// if c == 0 also, then all x is a solution

		return -c / (2 * halfB);
	}

	let discriminant = halfB * halfB - a * c;
	if (discriminant < 0)
		return undefined;

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
	/*if (Math.random() < 0.3) {
		ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + 0.0625 * colour.a + ")";
		ctx.fillRect(x - 3, y - 3, 7, 7);
	}*/

	ctx.fillStyle = "rgba(" + colour.r + "," + colour.g + "," + colour.b + "," + colour.a + ")";
	ctx.fillRect(x, y, 1, 1);
}

function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}


// =================================================================================================

function main() {
	let canvas = document.getElementById('canvas');
	let ctx = canvas.getContext('2d');
	ctx.height = canvas.height;
	ctx.width = canvas.width;

	canvas.addEventListener('mousemove', function(evt) {
		var mousePos = getMousePos(canvas, evt);
		let radius = 25;
		for (let y = -radius; y <= radius; y++) {
			for (let x = -radius; x <= radius; x++) {
				if (x * x + y * y <= radius * radius) {
					scene.traceOnCanvas(mousePos.x - x, mousePos.y - y, 100 * MAX_TRACE_DIST);
				}
			}
		}
	}, false);

	canvas.addEventListener('click', function(evt) {
		clearInterval(trace);

		var mousePos = getMousePos(canvas, evt);
		scene.shootLaserOnCanvas(mousePos.x, mousePos.y, MAX_TRACE_DIST, 1);
	}, false);	

	let scene = new Scene(ctx);
	scene.loadDefault();

	/*for (let i = 0; i < 1000; i++) {
		setTimeout(function() { scene.traceScene() }, 100);
	}*/
	let trace = setInterval(function() { scene.traceScene() }, 10);
	//scene.traceScene();
}