class Test {
  constructor(ary, val) {
    ary.push("Timothy was here");
    this.value = val;
  }
}

function main2() {
  let a = [1, 2, 3];
  console.log(`a is ${a}`);
  let t = new Test(a, 17);
  console.log(`a is ${a}`);
  console.log(`t is ${t}`);
}