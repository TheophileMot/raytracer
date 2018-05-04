class KdTree {
  constructor(data) {
    console.log(`building a k-d tree with ${data.length} elements`);
    
    this.nodes = [];        
    if (data.length == 0) { throw new Error(`tried to build a k-d tree with no data!`); }
    this.makeTree(data, 1);
  }

  nearestNeighbourAndDistance(x, pos) {   // find single nearest neighbour of x, return it with distance; restrict search to distance r (by default infinity)
    // FOR NOW, ONLY APPROXIMATE (by never searching far hyperplane; see 'if false' below)
    if (pos == undefined) { pos = 1; }
    if (pos >= this.nodes.length) { return [undefined, undefined]; }
    
    //console.log(`pos ${pos}`);
    let point = this.nodes[pos].photon.origin;
    let dim = this.nodes[pos].dim;
    let dist = vecLength(vecMinus(x, point));
    
    if (pos * 2 >= this.nodes.length) {
      //console.log(`leaf at ${pos}. returning ${point}, ${dist}`)
      return [point, dist];
    }

    let bestPhoton;
    let bestDist;    
    if (x[dim] < point[dim]) {  // search point is below splitting plane
      [bestPhoton, bestDist] = this.nearestNeighbourAndDistance(x, 2 * pos);
      //console.log(`  best from near side (${2 * pos}): ${bestPhoton}, ${bestDist}`);
      if (dist < bestDist) {
        bestPhoton = point;
        bestDist = dist;
      }
      if (false) { // x[dim] + bestDist > point[dim]) { // search sphere intersects hyperplane: best point could still lie on far side of splitting plane
        let [farPhoton, farDist] = this.nearestNeighbourAndDistance(x, 2 * pos + 1);
        //console.log(`  best from far side? (${2 * pos + 1}): ${farPhoton}, ${farDist}`);
        if (farDist < bestDist) {
          //console.log(`  -> use it`);
          bestPhoton = farPhoton;
          bestDist = farDist;
        }
      }
    } else {    // search point is above splitting plane
      [bestPhoton, bestDist] = this.nearestNeighbourAndDistance(x, 2 * pos + 1);
      //console.log(`  best from near side (${2 * pos + 1}): ${bestPhoton}, ${bestDist}`);
      if (dist < bestDist) {
        bestPhoton = point;
        bestDist = dist;
      }
      if (false) { // x[dim] - bestDist < point[dim]) { // search sphere intersects hyperplane: best point could still lie on far side of splitting plane
        let [farPhoton, farDist] = this.nearestNeighbourAndDistance(x, 2 * pos);
        //console.log(`  best from far side? (${2 * pos}): ${farPhoton}, ${farDist}`);
        if (farDist < bestDist) {
          //console.log(`  -> use it`);
          bestPhoton = farPhoton;
          bestDist = farDist;
        }
      }
    }
    //console.log(`pos ${pos}: ${bestPhoton}, ${bestDist}`)
    return [bestPhoton, bestDist];
  }

  nearestNeighbours(x, r, pos) {    // find all neighbours within distance r of x. Recursively search from position pos in tree
    if (pos == undefined) { pos = 1; }
    if (pos >= this.nodes.length) { return []; }
    
    let point = this.nodes[pos].photon.origin;
    let dim = this.nodes[pos].dim;
    if (x[dim] + r < point[dim]) {  // search region is entirely below splitting plane
      return this.nearestNeighbours(x, r, 2 * pos);
    } else if (x[dim] - r > point[dim]) {  // search region is entirely above splitting plane
      return this.nearestNeighbours(x, r, 2 * pos + 1);
    } else {    // search region intersects splitting plane; need to search both sides
      if (vecSqLength(vecMinus(x, point)) < r * r) {
          return [this.nodes[pos].photon, ...this.nearestNeighbours(x, r, 2 * pos), ...this.nearestNeighbours(x, r, 2 * pos + 1)];
      }
      return [...this.nearestNeighbours(x, r, 2 * pos), ...this.nearestNeighbours(x, r, 2 * pos + 1)];
    }
  }

  makeTree(data, pos) {
    let len = data.length;
    
    let max = [-Infinity, -Infinity, -Infinity];
    let min = [Infinity, Infinity, Infinity];            
    for (let dim = 0; dim < 3; dim++) {
      for (let i = 0; i < len; i++) {
        if (data[i].origin[dim] > max[dim]) { max[dim] = data[i].origin[dim]; }
        if (data[i].origin[dim] < min[dim]) { min[dim] = data[i].origin[dim]; }
      }
    }
    let widestDim = 0;
    let maxWidth = max[0] - min[0];     // find widest splitting dimension
    for (let dim = 1; dim < 3; dim++) {
      if (max[dim] - min[dim] > maxWidth) {
        widestDim = dim;
        maxWidth = max[dim] - min[dim];
      }
    }

    data.sort( (x, y) => x.origin[widestDim] - y.origin[widestDim] );
    let m = this.findMedian(len);
    this.nodes[pos] = { dim: widestDim, photon: data[m] };
    if (len > 1)     { this.makeTree(data.slice(0, m), 2 * pos); }
    if (m < len - 1) { this.makeTree(data.slice(m + 1, len), 2 * pos + 1); }
  }

  findMedian(n) {
    if (n == 0) { throw new Error(":O"); }
    if (n == 1) { return 0; }
    let powerTwo = 1;   // this will be 2^(k-1) where n = 2^k + ...
    let twoBits = n;    // we'll bit-shift n until we get the first two bits
    while(true) {
      if (twoBits == 2) {    // first two bits are 10
        return n - powerTwo;
      }
      if (twoBits == 3) {    // first two bits are 11
        return 2 * powerTwo - 1;
      }
      powerTwo <<= 1;
      twoBits >>= 1;
    }
  }
}
