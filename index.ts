import { readFileSync, writeFileSync } from "fs";

class Reader {
  private _buf: Array<string>;

  private constructor(buf: string) {
    this._buf = buf.split(/\s+/);
  }

  tok() {
    return this._buf.shift() || "";
  }

  num() {
    return parseFloat(this.tok());
  }

  static fromFile(file: string) {
    const buf = readFileSync(file, "utf-8");
    return new Reader(buf);
  }

  static fromString(buf: string) {
    return new Reader(buf);
  }
}

type Level = (r: Reader) => string;

function assert(level: Level, input: string | Reader, _expected: string) {
  const r = input instanceof Reader ? input : Reader.fromString(input);
  const actual = level(r).trim();
  const expected = _expected.trim();
  if (actual !== expected) {
    console.error(`
"${level.name}" assertion failed
Expected: ${expected}
Actual: ${actual}
`);
  }
}

function readCase(level: number, ex: number) {
  return Reader.fromFile(`./level-${level}/lvl${level}-${ex}.inp`);
}

function processFiles(fun: Level, level: number, examples: number) {
  for (let ex = 0; ex < examples; ex++) {
    const input = readCase(level, ex);
    const output = fun(input);
    writeFileSync(`./level-${level}/lev${level}-${ex}.out`, output);
  }
}

type Point = [number, number];

class Image {
  private constructor(private dim: Point, private buf: Array<number>) {}

  static fromReader(r: Reader) {
    const dim: Point = [r.num(), r.num()];
    const buf = [];
    const len = dim[0] * dim[1];
    for (let i = 0; i < len; i++) {
      buf.push(r.num());
    }
    return new Image(dim, buf);
  }

  ptToIdx(pt: Point) {
    const [row, col] = pt;
    const [, cols] = this.dim;
    return row * cols + col;
  }
  idxToPt(idx: number): Point {
    const [, cols] = this.dim;
    return [Math.floor(idx / cols), idx % cols];
  }

  pxAt(pt: Point) {
    return this.buf[this.ptToIdx(pt)] || 0;
  }

  hasAsteroid() {
    return this.buf.some(val => val > 0);
  }

  findShape() {
    let minrow = Infinity;
    let maxrow = -Infinity;

    let mincol = Infinity;
    let maxcol = -Infinity;

    let hasShape = false;

    for (let i = 0; i < this.buf.length; i++) {
      const val = this.buf[i];
      if (val) {
        hasShape = true;
        const [row, col] = this.idxToPt(i);
        minrow = Math.min(row, minrow);
        maxrow = Math.max(row, maxrow);

        mincol = Math.min(col, mincol);
        maxcol = Math.max(col, maxcol);
      }
    }

    return hasShape ? this.subImage([minrow, mincol], [maxrow, maxcol]) : null;
  }

  subImage(min: Point, max: Point): Image {
    const [minrow, mincol] = min;
    const [maxrow, maxcol] = max;
    const buf = [];
    for (let r = minrow; r <= maxrow; r++) {
      for (let c = mincol; c <= maxcol; c++) {
        buf.push(this.pxAt([r, c]));
      }
    }
    const dim: Point = [1 + maxrow - minrow, 1 + maxcol - mincol];
    const image = new Image(dim, buf);

    return image;
  }

  matches(other: Image, filter: Filter, checkDimensions = true) {
    const [trows, tcols] = this.dim;
    const [orows, ocols] = other.dim;
    if (checkDimensions && (trows !== orows || tcols !== ocols)) {
      return false;
    }
    const rows = Math.max(trows, orows);
    const cols = Math.max(tcols, ocols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pt: Point = [r, c];
        const tpx = this.pxAt(pt);
        const opx = other.pxAt(pt);
        if (filter(tpx) !== filter(opx)) {
          return false;
        }
      }
    }
    return true;
  }
}

type Sample = {
  timestamp: number;
  image: Image;
};
type Images = Array<Sample>;

function parseInput1(r: Reader) {
  const start = r.num();
  const end = r.num();
  const len = r.num();

  const images: Images = [];

  for (let i = 0; i < len; i++) {
    images.push({
      timestamp: r.num(),
      image: Image.fromReader(r),
    });
  }
  return {
    start,
    end,
    images,
  };
}

function level1(r: Reader) {
  const { images } = parseInput1(r);
  let output = "";
  for (const { timestamp, image } of images) {
    if (image.hasAsteroid()) {
      output += `${timestamp}\n`;
    }
  }
  return output;
}

assert(
  level1,
  readCase(1, 0),
  `3505
4352`,
);

// processFiles(level1, 1, 5);

type Filter = (px: number) => number;

class Shape {
  samples: Array<Sample>;
  rotations: Array<Image>;

  constructor(sample: Sample) {
    this.samples = [sample];
    this.rotations = this.createRotations(sample.image);
  }

  saveMatching(sample: Sample, filter: Filter) {
    const isMatching = this.samples.some(s => s.image.matches(sample.image, filter));
    if (isMatching) {
      this.samples.push(sample);
    }
    return isMatching;
  }

  createRotations(image: Image) {
    return [image];
  }

  findRotationAngle(image1: Image, image2: Image) {
    return 0;
  }

  get start() {
    return this.samples[0].timestamp;
  }
  get end() {
    return this.samples[this.samples.length - 1].timestamp;
  }
}

class Shapes {
  shapes: Array<Shape> = [];

  collectShape(sample: Sample, filter: Filter) {
    const matching = this.shapes.some(s => s.saveMatching(sample, filter));
    if (!matching) {
      this.shapes.push(new Shape(sample));
    }
  }
}

function collectShapes2(r: Reader) {
  const { start, end, images } = parseInput1(r);

  const shapes = new Shapes();
  const filter = (px: number) => (px ? 1 : 0);
  for (const { timestamp, image } of images) {
    const shape = image.findShape();
    if (shape) {
      shapes.collectShape({ timestamp, image: shape }, filter);
    }
  }
  return { start, end, shapes };
}

function level2(r: Reader) {
  const { shapes } = collectShapes2(r);

  let output = "";
  for (const shape of shapes.shapes) {
    output += `${shape.start} ${shape.end} ${shape.samples.length}\n`;
  }
  return output;
}

assert(
  level2,
  readCase(2, 0),
  `4260 7263 2
6547 6547 1`,
);

// processFiles(level2, 2, 5);

function findSubsets(
  options: { start: number; end: number; shapes: Shapes },
  checkRotations = false,
) {
  const { end, shapes: oldshapes } = options;

  const matches = [];

  for (const shape of oldshapes.shapes) {
    const { samples } = shape;
    // just assume this is sorted already
    const sampleMap = new Map<number, Sample>(
      samples.map(s => [s.timestamp, s] as [number, Sample]),
    );

    for (let i = 0; i < samples.length; i++) {
      const sample1 = samples[i];
      // the timestamp has already been used by a subset
      if (!sampleMap.has(sample1.timestamp)) {
        continue;
      }
      outer: for (let j = i; j < samples.length; j++) {
        const sample2 = samples[j];
        const interval = sample2.timestamp - sample1.timestamp;
        const rotation = shape.findRotationAngle(sample1.image, sample2.image);
        // check that the first sample does not spawn somewhere in the middle
        if (sample1.timestamp > interval) {
          continue;
        }
        // skip this if we can‘t have 4 iterations
        if (sample1.timestamp + 3 * interval > end) {
          continue;
        }
        // check that there is a timestamp at each interval
        let lastSample = sample1;
        for (let k = sample1.timestamp + interval; k <= end; k += interval) {
          const sample2 = sampleMap.get(k);
          if (!sample2) {
            continue outer;
          }
          if (
            checkRotations &&
            shape.findRotationAngle(lastSample.image, sample2.image) !== rotation
          ) {
            continue outer;
          }
          lastSample = sample2;
        }

        const match = [];
        // we have a match, clear all the timestamps from the available set
        for (let k = sample1.timestamp; k <= end; k += interval) {
          match.push(k);
          sampleMap.delete(k);
        }
        matches.push(match);
      }
    }
  }

  // sort the subsets by their first timestamp
  matches.sort((m1, m2) => m1[0] - m2[0]);

  return matches;
}

function level3(r: Reader) {
  const collected = collectShapes2(r);
  const matches = findSubsets(collected);

  let output = "";
  for (const match of matches) {
    output += `${match[0]} ${match[match.length - 1]} ${match.length}\n`;
  }
  return output;
}

assert(
  level3,
  readCase(3, 0),
  `1 19 4
4 16 4`,
);

// processFiles(level3, 3, 6);

function level4(r: Reader) {
  let output = "";
  return output;
}

assert(
  level4,
  readCase(4, 0),
  `1 19 4
4 16 4`,
);

processFiles(level4, 4, 8);
