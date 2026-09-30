var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// vendor/difurious/lightweight-charts-line-tools-core/src/api/dummy-api.ts
function createDummyPluginApi() {
  const dummyFn = () => {
    console.error("Line Tools Plugin: Method called on a destroyed or uninitialized instance.");
  };
  const dummyFnString = () => {
    console.error("Line Tools Plugin: Method called on a destroyed or uninitialized instance.");
    return "[]";
  };
  const dummyFnBoolean = () => {
    console.error("Line Tools Plugin: Method called on a destroyed or uninitialized instance.");
    return false;
  };
  const dummyFnNull = () => {
    console.error("Line Tools Plugin: Method called on a destroyed or uninitialized instance.");
    return null;
  };
  const dummyFnArray = () => {
    console.error("Line Tools Plugin: Method called on a destroyed or uninitialized instance.");
    return [];
  };
  return {
    registerLineTool: dummyFn,
    addLineTool: () => {
      console.error("Line Tools Plugin: Method called on a destroyed or uninitialized instance.");
      return "";
    },
    createOrUpdateLineTool: dummyFn,
    removeLineToolsById: dummyFn,
    removeLineToolsByIdRegex: dummyFn,
    removeSelectedLineTools: dummyFn,
    removeAllLineTools: dummyFn,
    getSelectedLineTools: dummyFnString,
    getLineToolByID: dummyFnString,
    getLineToolsByIdRegex: dummyFnString,
    applyLineToolOptions: dummyFnBoolean,
    exportLineTools: dummyFnString,
    importLineTools: dummyFnBoolean,
    getDataInRange: dummyFnArray,
    getBarAtTime: dummyFnNull,
    getClosestBar: dummyFnNull,
    getBarAtCoordinate: dummyFnNull,
    getEarliestBar: dummyFnNull,
    getLatestBar: dummyFnNull,
    getFullTimeRange: dummyFnNull,
    subscribeLineToolsDoubleClick: dummyFn,
    unsubscribeLineToolsDoubleClick: dummyFn,
    subscribeLineToolsAfterEdit: dummyFn,
    unsubscribeLineToolsAfterEdit: dummyFn,
    subscribeLineToolsSingleClick: dummyFn,
    unsubscribeLineToolsSingleClick: dummyFn,
    setCrossHairXY: dummyFn,
    clearCrossHair: dummyFn,
    setMagnetThreshold: dummyFn,
    setTimeFormatter: dummyFn,
    setLocked: dummyFn,
    isLocked: dummyFnBoolean,
    destroy: dummyFn
  };
}

// vendor/difurious/lightweight-charts-line-tools-core/src/utils/helpers.ts
function colorStringToRgba(colorString) {
  colorString = colorString.toLowerCase();
  if (colorString === "transparent") {
    return [0, 0, 0, 0];
  }
  const rgbaRe = /^rgba\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?[\d]{0,10}(?:\.\d+)?)\s*\)$/;
  let matches = rgbaRe.exec(colorString);
  if (matches) {
    return [
      parseInt(matches[1], 10),
      parseInt(matches[2], 10),
      parseInt(matches[3], 10),
      parseFloat(matches[4])
    ];
  }
  const rgbRe = /^rgb\(\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*,\s*(-?\d{1,10})\s*\)$/;
  matches = rgbRe.exec(colorString);
  if (matches) {
    return [
      parseInt(matches[1], 10),
      parseInt(matches[2], 10),
      parseInt(matches[3], 10),
      1
    ];
  }
  const hexRe = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
  matches = hexRe.exec(colorString);
  if (matches) {
    return [
      parseInt(matches[1], 16),
      parseInt(matches[2], 16),
      parseInt(matches[3], 16),
      1
    ];
  }
  const shortHexRe = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
  matches = shortHexRe.exec(colorString);
  if (matches) {
    return [
      parseInt(matches[1] + matches[1], 16),
      parseInt(matches[2] + matches[2], 16),
      parseInt(matches[3] + matches[3], 16),
      1
    ];
  }
  if (colorString.includes("white") || colorString === "#fff") {
    return [255, 255, 255, 1];
  }
  console.warn(`[helpers.ts]Could not parse color: ${colorString}. Defaulting to transparent.`);
  return [0, 0, 0, 0];
}
function rgbaToGrayscale(rgbValue) {
  const redComponentGrayscaleWeight = 0.199;
  const greenComponentGrayscaleWeight = 0.687;
  const blueComponentGrayscaleWeight = 0.114;
  return redComponentGrayscaleWeight * rgbValue[0] + greenComponentGrayscaleWeight * rgbValue[1] + blueComponentGrayscaleWeight * rgbValue[2];
}
function generateContrastColors(backgroundColor) {
  const rgb = colorStringToRgba(backgroundColor);
  if (rgb[3] === 0) {
    return {
      background: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${rgb[3]})`,
      foreground: "white"
    };
  }
  return {
    background: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    foreground: rgbaToGrayscale(rgb) > 160 ? "black" : "white"
  };
}
function ensureNotNull(value) {
  if (value === null) {
    throw new Error("Value is null");
  }
  return value;
}
function ensureDefined(value) {
  if (value === void 0) {
    throw new Error("Value is undefined");
  }
  return value;
}
function deepCopy(object) {
  if (typeof object !== "object" || object === null) {
    return object;
  }
  if (object instanceof Date) {
    return new Date(object.getTime());
  }
  if (Array.isArray(object)) {
    return object.map((item) => deepCopy(item));
  }
  const copy = {};
  for (const key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      copy[key] = deepCopy(object[key]);
    }
  }
  return copy;
}
function merge(dst, ...sources) {
  for (const src of sources) {
    for (const key in src) {
      if (src[key] === void 0) {
        continue;
      }
      const srcValue = src[key];
      const dstValue = dst[key];
      if (Array.isArray(srcValue) && Array.isArray(dstValue)) {
        if (srcValue.length < dstValue.length) {
          dstValue.length = srcValue.length;
        }
        for (let i = 0; i < srcValue.length; i++) {
          const srcElement = srcValue[i];
          const dstElement = dstValue[i];
          if (typeof srcElement !== "object" || srcElement === null || dstElement === void 0) {
            dstValue[i] = srcElement;
          } else if (typeof dstElement === "object" && dstElement !== null) {
            merge(dstValue[i], srcValue[i]);
          } else {
            dstValue[i] = srcElement;
          }
        }
      } else if (typeof srcValue === "object" && srcValue !== null && typeof dstValue === "object" && dstValue !== null) {
        merge(dstValue, srcValue);
      } else {
        dst[key] = srcValue;
      }
    }
  }
  return dst;
}
var HASH_SOURCE = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randomHash(count = 12) {
  let hash = "";
  for (let i = 0; i < count; ++i) {
    const index = Math.floor(Math.random() * HASH_SOURCE.length);
    hash += HASH_SOURCE[index];
  }
  return hash;
}
var Delegate = class {
  constructor() {
    /**
        * Internal list of active subscribers.
        * @private
        */
    __publicField(this, "_listeners", []);
  }
  /**
   * Subscribes a callback function to the delegate.
      * 
      * When the event is fired, this callback will be executed with the provided arguments.
   * 
   * @param callback - The function to call when the event fires.
   * @param linkedObject - An optional object to link the subscription to. This allows removing multiple unrelated subscriptions at once via {@link unsubscribeAll}.
   * @param singleshot - If `true`, the subscription is automatically removed after the first time it is called.
   */
  subscribe(callback, linkedObject, singleshot) {
    const listener = {
      callback,
      linkedObject,
      singleshot: singleshot === true
    };
    this._listeners.push(listener);
  }
  /**
   * Unsubscribes a specific callback function from the delegate.
      * 
      * If the callback was added multiple times, this typically removes the first occurrence 
      * depending on implementation, though delegates usually enforce unique callback references per subscription context.
   * 
   * @param callback - The specific function reference to remove.
   */
  unsubscribe(callback) {
    const index = this._listeners.findIndex((listener) => callback === listener.callback);
    if (index > -1) {
      this._listeners.splice(index, 1);
    }
  }
  /**
   * Unsubscribes all callbacks that were registered with a specific `linkedObject`.
      * 
      * This is useful for cleaning up all event listeners associated with a specific UI component 
      * or tool instance when it is destroyed.
   * 
   * @param linkedObject - The object key used during subscription.
   */
  unsubscribeAll(linkedObject) {
    this._listeners = this._listeners.filter((listener) => listener.linkedObject !== linkedObject);
  }
  /**
   * Fires the event, calling all subscribed callbacks with the provided arguments.
      * 
      * This method takes a snapshot of the listeners array before iterating to ensure that 
      * if a listener unsubscribes itself during execution, the iteration remains stable.
      * 
      * @param param1 - The first event argument.
      * @param param2 - The second event argument.
      * @param param3 - The third event argument.
   */
  fire(param1, param2, param3) {
    const listenersSnapshot = [...this._listeners];
    this._listeners = this._listeners.filter((listener) => !listener.singleshot);
    listenersSnapshot.forEach((listener) => listener.callback(param1, param2, param3));
  }
  /**
   * Checks if the delegate has any active listeners.
      * 
      * This is useful for avoiding expensive calculations if no one is listening to the event.
      * 
   * @returns `true` if there is at least one active subscriber, `false` otherwise.
   */
  hasListeners() {
    return this._listeners.length > 0;
  }
  /**
   * Clears all listeners and frees up resources.
      * 
      * This should be called when the owner of the Delegate (e.g., the Plugin or a Tool) 
      * is being destroyed to prevent memory leaks.
   */
  destroy() {
    this._listeners = [];
  }
};
function roundPriceToStep(price, minMove) {
  if (!isFinite(price) || minMove <= 0) {
    return price;
  }
  const inv = 1 / minMove;
  const alignedPrice = Math.round(price * inv) / inv;
  const minMoveStr = minMove.toString();
  let precision = 0;
  if (minMoveStr.includes("e")) {
    const parts = minMoveStr.split("e");
    precision = Math.abs(Number(parts[1]));
  } else if (minMoveStr.includes(".")) {
    precision = minMoveStr.split(".")[1].length;
  }
  return Number(alignedPrice.toFixed(precision));
}

// vendor/difurious/lightweight-charts-line-tools-core/src/model/tool-registry.ts
var ToolRegistry = class {
  constructor() {
    /**
     * Private map to store the registered tool classes.
     * Key: {@link LineToolType} string (e.g., 'Rectangle')
     * Value: Constructor of a class that extends {@link BaseLineTool}
     * @private
     */
    __publicField(this, "_toolConstructors", /* @__PURE__ */ new Map());
  }
  /**
   * Registers a new line tool class with the registry.
   *
   * This method is typically called via the public {@link LineToolsCorePlugin.registerLineTool} API
   * to make a custom tool available for creation.
   *
   * @param type - The string identifier for the tool (e.g., 'Rectangle').
   * @param toolClass - The constructor of the class that extends {@link BaseLineTool}.
   * @returns void
   */
  registerTool(type, toolClass) {
    if (this._toolConstructors.has(type)) {
      console.warn(`Line tool type "${type}" is already registered and will be overwritten.`);
    }
    this._toolConstructors.set(type, toolClass);
  }
  /**
   * Checks if a line tool of a specific type has been registered.
   *
   * @param type - The line tool type to check.
   * @returns `true` if the tool is registered, otherwise `false`.
   */
  isRegistered(type) {
    return this._toolConstructors.has(type);
  }
  /**
   * Retrieves the constructor for a specific line tool type.
   *
   * @param type - The line tool type to retrieve.
   * @returns The class constructor if found.
   * @throws Will throw an error if the tool type is not registered.
   */
  getToolClass(type) {
    const toolClass = this._toolConstructors.get(type);
    if (!toolClass) {
      throw new Error(`Line tool type "${type}" is not registered. Ensure you have imported and registered the tool.`);
    }
    return toolClass;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/types.ts
var HitTestResult = class {
  constructor(type, data) {
    __publicField(this, "_data");
    __publicField(this, "_type");
    this._type = type;
    this._data = data || null;
  }
  type() {
    return this._type;
  }
  data() {
    return this._data;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/utils/geometry.ts
var Point = class _Point {
  constructor(x, y) {
    /** The x-coordinate (pixel value). */
    __publicField(this, "x");
    /** The y-coordinate (pixel value). */
    __publicField(this, "y");
    this.x = x;
    this.y = y;
  }
  /**
      * Adds another point/vector to this one.
      * @param point - The point to add.
      * @returns A new Point representing the sum (`this + point`).
      */
  add(point) {
    return new _Point(this.x + point.x, this.y + point.y);
  }
  /**
   * Adds a scaled version of another point/vector to this one.
   * Useful for linear interpolations or projections.
   * 
   * @param point - The direction vector to add.
   * @param scale - The scalar factor to multiply `point` by before adding.
   * @returns A new Point representing (`this + (point * scale)`).
   */
  addScaled(point, scale) {
    return new _Point(this.x + scale * point.x, this.y + scale * point.y);
  }
  /**
   * Subtracts another point/vector from this one.
   * @param point - The point to subtract.
   * @returns A new Point representing the difference (`this - point`).
   */
  subtract(point) {
    return new _Point(this.x - point.x, this.y - point.y);
  }
  /**
   * Calculates the dot product of this vector and another.
   * Formula: `x1*x2 + y1*y2`.
   * 
   * @param point - The other vector.
   * @returns The scalar dot product.
   */
  dotProduct(point) {
    return this.x * point.x + this.y * point.y;
  }
  /**
   * Calculates the 2D cross product (determinant) magnitude of this vector and another.
   * Formula: `x1*y2 - y1*x2`.
   * 
   * @param point - The other vector.
   * @returns The scalar cross product.
   */
  crossProduct(point) {
    return this.x * point.y - this.y * point.x;
  }
  /**
   * Calculates the signed angle between this vector and another.
   * 
   * @param point - The other vector.
   * @returns The angle in radians (range -π to π).
   */
  signedAngle(point) {
    return Math.atan2(this.crossProduct(point), this.dotProduct(point));
  }
  /**
   * Calculates the unsigned angle between this vector and another.
   * 
   * @param point - The other vector.
   * @returns The angle in radians (range 0 to π).
   */
  angle(point) {
    return Math.acos(this.dotProduct(point) / (this.length() * point.length()));
  }
  /**
   * Calculates the Euclidean length (magnitude) of the vector.
   * @returns The length of the vector.
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  /**
   * Multiplies the vector by a scalar value.
   * @param scale - The scaling factor.
   * @returns A new scaled Point.
   */
  scaled(scale) {
    return new _Point(this.x * scale, this.y * scale);
  }
  /**
    * Returns a normalized version of the vector (unit vector with length 1).
    * @returns A new Point with the same direction but length 1. Returns (0,0) if original length is 0.
    */
  normalized() {
    const len = this.length();
    if (len === 0) return new _Point(0, 0);
    return new _Point(this.x / len, this.y / len);
  }
  /**
   * Returns a perpendicular vector rotated 90 degrees counter-clockwise.
   * Maps `(x, y)` to `(-y, x)`.
   * 
   * @returns A new transposed Point.
   */
  transposed() {
    return new _Point(-this.y, this.x);
  }
  /**
   * Creates a deep copy of this Point.
   * @returns A new Point instance with identical coordinates.
   */
  clone() {
    return new _Point(this.x, this.y);
  }
};
var Box = class {
  constructor(a, b) {
    __publicField(this, "min");
    __publicField(this, "max");
    this.min = new Point(Math.min(a.x, b.x), Math.min(a.y, b.y));
    this.max = new Point(Math.max(a.x, b.x), Math.max(a.y, b.y));
  }
};
function equalPoints(a, b) {
  return a.x === b.x && a.y === b.y;
}
function line(a, b, c) {
  return { a, b, c };
}
function lineThroughPoints(a, b) {
  return line(a.y - b.y, b.x - a.x, a.x * b.y - b.x * a.y);
}
function lineSegment(a, b) {
  if (equalPoints(a, b)) {
    throw new Error("Points of a segment should be distinct");
  }
  return [a, b];
}
function addPoint(array, point) {
  for (let i = 0; i < array.length; i++) {
    if (equalPoints(array[i], point)) {
      return false;
    }
  }
  array.push(point);
  return true;
}
function intersectLineAndBox(line2, box) {
  if (line2.a === 0) {
    const l = -line2.c / line2.b;
    return box.min.y <= l && l <= box.max.y ? lineSegment(new Point(box.min.x, l), new Point(box.max.x, l)) : null;
  }
  if (line2.b === 0) {
    const h = -line2.c / line2.a;
    return box.min.x <= h && h <= box.max.x ? lineSegment(new Point(h, box.min.y), new Point(h, box.max.y)) : null;
  }
  const points = [];
  const u = function(value) {
    const i = -(line2.c + line2.a * value) / line2.b;
    if (box.min.y <= i && i <= box.max.y) {
      addPoint(points, new Point(value, i));
    }
  };
  const p = function(value) {
    const s = -(line2.c + line2.b * value) / line2.a;
    if (box.min.x <= s && s <= box.max.x) {
      addPoint(points, new Point(s, value));
    }
  };
  u(box.min.x);
  p(box.min.y);
  u(box.max.x);
  p(box.max.y);
  switch (points.length) {
    case 0:
      return null;
    case 1:
      return points[0];
    case 2:
      return equalPoints(points[0], points[1]) ? points[0] : lineSegment(points[0], points[1]);
  }
  throw new Error("We should have at most two intersection points");
}
function intersectRayAndBox(point0, point1, box) {
  const s = intersectLineSegments(point0, point1, box.min, new Point(box.max.x, box.min.y));
  const n = intersectLineSegments(point0, point1, new Point(box.max.x, box.min.y), box.max);
  const a = intersectLineSegments(point0, point1, box.max, new Point(box.min.x, box.max.y));
  const c = intersectLineSegments(point0, point1, new Point(box.min.x, box.max.y), box.min);
  const h = [];
  if (s !== null && s >= 0) {
    h.push(s);
  }
  if (n !== null && n >= 0) {
    h.push(n);
  }
  if (a !== null && a >= 0) {
    h.push(a);
  }
  if (c !== null && c >= 0) {
    h.push(c);
  }
  if (h.length === 0) {
    return null;
  }
  h.sort((e, t) => e - t);
  const d = pointInBox(point0, box) ? h[0] : h[h.length - 1];
  return point0.addScaled(point1.subtract(point0), d);
}
function intersectLineSegments(point0, point1, point2, point3) {
  const z = (function(e, t, i, s) {
    const r = t.subtract(e);
    const n = s.subtract(i);
    const o2 = r.x * n.y - r.y * n.x;
    if (Math.abs(o2) < 1e-6) {
      return null;
    }
    const a2 = e.subtract(i);
    return (a2.y * n.x - a2.x * n.y) / o2;
  })(point0, point1, point2, point3);
  if (z === null) {
    return null;
  }
  const o = point1.subtract(point0).scaled(z).add(point0);
  const a = distanceToSegment(point2, point3, o);
  return Math.abs(a.distance) < 1e-6 ? z : null;
}
function intersectLineSegmentAndBox(segment, box) {
  let x0 = segment[0].x;
  let y0 = segment[0].y;
  let x1 = segment[1].x;
  let y1 = segment[1].y;
  const minX = box.min.x;
  const minY = box.min.y;
  const maxX = box.max.x;
  const maxY = box.max.y;
  function outcode(n1, n2) {
    let z = 0;
    if (n1 < minX) z |= 1;
    else if (n1 > maxX) z |= 2;
    if (n2 < minY) z |= 4;
    else if (n2 > maxY) z |= 8;
    return z;
  }
  let accept = false;
  let outcode0 = outcode(x0, y0);
  let outcode1 = outcode(x1, y1);
  while (true) {
    if (!(outcode0 | outcode1)) {
      accept = true;
      break;
    } else if (outcode0 & outcode1) {
      break;
    } else {
      const currentOutcode = outcode0 || outcode1;
      let x = 0;
      let y = 0;
      if (currentOutcode & 8) {
        x = x0 + (x1 - x0) * (maxY - y0) / (y1 - y0);
        y = maxY;
      } else if (currentOutcode & 4) {
        x = x0 + (x1 - x0) * (minY - y0) / (y1 - y0);
        y = minY;
      } else if (currentOutcode & 2) {
        y = y0 + (y1 - y0) * (maxX - x0) / (x1 - x0);
        x = maxX;
      } else if (currentOutcode & 1) {
        y = y0 + (y1 - y0) * (minX - x0) / (x1 - x0);
        x = minX;
      }
      if (currentOutcode === outcode0) {
        x0 = x;
        y0 = y;
        outcode0 = outcode(x0, y0);
      } else {
        x1 = x;
        y1 = y;
        outcode1 = outcode(x1, y1);
      }
    }
  }
  return accept ? equalPoints(new Point(x0, y0), new Point(x1, y1)) ? new Point(x0, y0) : lineSegment(new Point(x0, y0), new Point(x1, y1)) : null;
}
function distanceToLine(point0, point1, point2) {
  const s = point1.subtract(point0);
  const r = point2.subtract(point0).dotProduct(s) / s.dotProduct(s);
  return { coeff: r, distance: point0.addScaled(s, r).subtract(point2).length() };
}
function distanceToSegment(point0, point1, point2) {
  const lineDist = distanceToLine(point0, point1, point2);
  if (lineDist.coeff >= 0 && lineDist.coeff <= 1) {
    return lineDist;
  }
  const n = point0.subtract(point2).length();
  const o = point1.subtract(point2).length();
  return n < o ? { coeff: 0, distance: n } : { coeff: 1, distance: o };
}
function pointInBox(point, box) {
  return point.x >= box.min.x && point.x <= box.max.x && point.y >= box.min.y && point.y <= box.max.y;
}
function pointInPolygon(point, polygon) {
  const x = point.x;
  const y = point.y;
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
}
function extendAndClipLineSegment(point0, point1, width, height, extendLeft, extendRight) {
  if (equalPoints(point0, point1)) {
    return null;
  }
  const topLeft = new Point(0, 0);
  const bottomRight = new Point(width, height);
  const clippingBox = new Box(topLeft, bottomRight);
  if (extendLeft) {
    if (extendRight) {
      const lineThrough = lineThroughPoints(point0, point1);
      if (lineThrough === null) {
        return null;
      }
      const intersection = intersectLineAndBox(lineThrough, clippingBox);
      return intersection;
    } else {
      const intersection = intersectRayAndBox(point1, point0, clippingBox);
      return intersection === null || equalPoints(point1, intersection) ? null : lineSegment(point1, intersection);
    }
  }
  if (extendRight) {
    const intersection = intersectRayAndBox(point0, point1, clippingBox);
    return intersection === null || equalPoints(point0, intersection) ? null : lineSegment(point0, intersection);
  } else {
    const intersection = intersectLineSegmentAndBox(lineSegment(point0, point1), clippingBox);
    return intersection;
  }
}
var _dateStringCache = /* @__PURE__ */ new Map();
function convertDateStringToUTCTimestamp(dateString) {
  const cached = _dateStringCache.get(dateString);
  if (cached !== void 0) {
    return cached;
  }
  const date = new Date(dateString);
  const timestamp = Math.floor(date.getTime() / 1e3);
  _dateStringCache.set(dateString, timestamp);
  return timestamp;
}
function convertUTCTimestampToDateString(timestamp) {
  const date = new Date(timestamp * 1e3);
  return date.toISOString().split("T")[0];
}
var _seriesIntervalCache = /* @__PURE__ */ new WeakMap();
function _getVerifiedBarInterval(series, direction, firstLogical, lastLogical) {
  const maxChecks = 10;
  const startIndex = direction === "last" ? lastLogical : firstLogical;
  const step = direction === "last" ? -1 : 1;
  const cacheRecord = _seriesIntervalCache.get(series);
  if (cacheRecord && cacheRecord.direction === direction && cacheRecord.start === startIndex) {
    return cacheRecord.interval;
  }
  let prevInterval = null;
  for (let i = 0; i < maxChecks; i++) {
    const barA = series.dataByIndex(startIndex + i * step, 0);
    const barB = series.dataByIndex(startIndex + (i + 1) * step, 0);
    if (!barA || !barB) break;
    const tA = typeof barA.time === "string" ? convertDateStringToUTCTimestamp(barA.time) : Number(barA.time);
    const tB = typeof barB.time === "string" ? convertDateStringToUTCTimestamp(barB.time) : Number(barB.time);
    const interval = Math.abs(tA - tB);
    if (prevInterval !== null && interval === prevInterval) {
      _seriesIntervalCache.set(series, { direction, start: startIndex, interval });
      return interval;
    }
    prevInterval = interval;
  }
  if (prevInterval !== null) {
    _seriesIntervalCache.set(series, { direction, start: startIndex, interval: prevInterval });
  }
  return prevInterval;
}
function logicalIndexToCoordinate(timeScale, index) {
  const leftLogical = Math.floor(index);
  const rightLogical = Math.ceil(index);
  if (leftLogical === rightLogical) {
    return timeScale.logicalToCoordinate(leftLogical);
  }
  const xLeft = timeScale.logicalToCoordinate(leftLogical);
  const xRight = timeScale.logicalToCoordinate(rightLogical);
  if (xLeft !== null && xRight !== null) {
    const fraction = index - leftLogical;
    return xLeft + fraction * (xRight - xLeft);
  }
  return timeScale.logicalToCoordinate(Math.round(index));
}
function interpolateTimeFromLogicalIndex(chart, series, logicalIndex) {
  if (!chart || !series) return null;
  const timeScale = chart.timeScale();
  const firstBar = series.dataByIndex(-Number.MAX_SAFE_INTEGER, 1);
  const lastBar = series.dataByIndex(Number.MAX_SAFE_INTEGER, -1);
  if (!firstBar || !lastBar) return null;
  const firstCoord = timeScale.timeToCoordinate(firstBar.time);
  const lastCoord = timeScale.timeToCoordinate(lastBar.time);
  if (firstCoord === null || lastCoord === null) return null;
  const firstLogical = Math.round(timeScale.coordinateToLogical(firstCoord));
  const lastLogical = Math.round(timeScale.coordinateToLogical(lastCoord));
  const firstTimeNum = typeof firstBar.time === "string" ? convertDateStringToUTCTimestamp(firstBar.time) : Number(firstBar.time);
  const lastTimeNum = typeof lastBar.time === "string" ? convertDateStringToUTCTimestamp(lastBar.time) : Number(lastBar.time);
  let interpolatedTime;
  if (logicalIndex >= firstLogical && logicalIndex <= lastLogical) {
    if (Number.isInteger(logicalIndex)) {
      const exactBar = series.dataByIndex(logicalIndex, 0);
      if (exactBar) return exactBar.time;
    }
    const leftIndex = Math.floor(logicalIndex);
    let rightIndex = Math.ceil(logicalIndex);
    if (leftIndex === rightIndex) rightIndex = leftIndex + 1;
    const leftBar = series.dataByIndex(leftIndex, 0);
    const rightBar = series.dataByIndex(rightIndex, 0);
    if (!leftBar || !rightBar) return null;
    const tLeft = typeof leftBar.time === "string" ? convertDateStringToUTCTimestamp(leftBar.time) : Number(leftBar.time);
    const tRight = typeof rightBar.time === "string" ? convertDateStringToUTCTimestamp(rightBar.time) : Number(rightBar.time);
    const fraction = logicalIndex - leftIndex;
    interpolatedTime = tLeft + fraction * (tRight - tLeft);
  } else {
    const isFuture = logicalIndex > lastLogical;
    const verifiedInterval = _getVerifiedBarInterval(series, isFuture ? "last" : "first", firstLogical, lastLogical);
    if (verifiedInterval === null || verifiedInterval === 0) return null;
    if (isFuture) {
      const logicalDelta = logicalIndex - lastLogical;
      interpolatedTime = lastTimeNum + logicalDelta * verifiedInterval;
    } else {
      const logicalDelta = firstLogical - logicalIndex;
      interpolatedTime = firstTimeNum - logicalDelta * verifiedInterval;
    }
  }
  if (typeof firstBar.time === "string") {
    return convertUTCTimestampToDateString(interpolatedTime);
  } else {
    return Math.round(interpolatedTime);
  }
}
function getExtendedVisiblePriceRange(tool) {
  const series = tool.getSeries();
  const paneHeight = tool.getChartDrawingHeight();
  return {
    from: series.coordinateToPrice(paneHeight),
    // Bottom Price
    to: series.coordinateToPrice(0)
    // Top Price
  };
}
function interpolateLogicalIndexFromTime(chart, series, timestamp) {
  if (!series || !chart) return null;
  const targetTimeNum = typeof timestamp === "string" ? convertDateStringToUTCTimestamp(timestamp) : Number(timestamp);
  const firstBar = series.dataByIndex(-Number.MAX_SAFE_INTEGER, 1);
  const lastBar = series.dataByIndex(Number.MAX_SAFE_INTEGER, -1);
  if (!firstBar || !lastBar) return null;
  const timeScale = chart.timeScale();
  const firstCoord = timeScale.timeToCoordinate(firstBar.time);
  const lastCoord = timeScale.timeToCoordinate(lastBar.time);
  if (firstCoord === null || lastCoord === null) return null;
  const firstLogical = Math.round(timeScale.coordinateToLogical(firstCoord));
  const lastLogical = Math.round(timeScale.coordinateToLogical(lastCoord));
  const firstTimeNum = typeof firstBar.time === "string" ? convertDateStringToUTCTimestamp(firstBar.time) : Number(firstBar.time);
  const lastTimeNum = typeof lastBar.time === "string" ? convertDateStringToUTCTimestamp(lastBar.time) : Number(lastBar.time);
  const coordinate = timeScale.timeToCoordinate(timestamp);
  if (coordinate !== null) {
    const logicalRaw = timeScale.coordinateToLogical(coordinate);
    if (logicalRaw !== null) {
      const logical = Math.round(logicalRaw);
      const checkBar = series.dataByIndex(logical, 0);
      if (checkBar) {
        const checkTimeNum = typeof checkBar.time === "string" ? convertDateStringToUTCTimestamp(checkBar.time) : Number(checkBar.time);
        if (checkTimeNum === targetTimeNum) {
          return logical;
        }
      }
    }
  }
  if (targetTimeNum >= firstTimeNum && targetTimeNum <= lastTimeNum) {
    let low = firstLogical;
    let high = lastLogical;
    let leftNeighborIndex = firstLogical;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midBar = series.dataByIndex(mid, 0);
      if (!midBar) break;
      const midTimeNum = typeof midBar.time === "string" ? convertDateStringToUTCTimestamp(midBar.time) : Number(midBar.time);
      if (midTimeNum === targetTimeNum) {
        return mid;
      } else if (midTimeNum < targetTimeNum) {
        leftNeighborIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const rightNeighborIndex = leftNeighborIndex + 1;
    const leftBar = series.dataByIndex(leftNeighborIndex, 0);
    const rightBar = series.dataByIndex(rightNeighborIndex, 0);
    if (leftBar && rightBar) {
      const tLeft = typeof leftBar.time === "string" ? convertDateStringToUTCTimestamp(leftBar.time) : Number(leftBar.time);
      const tRight = typeof rightBar.time === "string" ? convertDateStringToUTCTimestamp(rightBar.time) : Number(rightBar.time);
      const interval = tRight - tLeft;
      if (interval > 0) {
        const fraction = (targetTimeNum - tLeft) / interval;
        return leftNeighborIndex + fraction;
      }
    }
  }
  const isFuture = targetTimeNum > lastTimeNum;
  const verifiedInterval = _getVerifiedBarInterval(series, isFuture ? "last" : "first", firstLogical, lastLogical);
  if (verifiedInterval === null || verifiedInterval === 0) return null;
  if (isFuture) {
    const timeDelta = targetTimeNum - lastTimeNum;
    const logicalDelta = timeDelta / verifiedInterval;
    return lastLogical + logicalDelta;
  } else {
    const timeDelta = firstTimeNum - targetTimeNum;
    const logicalDelta = timeDelta / verifiedInterval;
    return firstLogical - logicalDelta;
  }
}
function rotatePoint(point, pivot, angle) {
  if (angle === 0) {
    return point.clone();
  }
  const x = (point.x - pivot.x) * Math.cos(angle) - (point.y - pivot.y) * Math.sin(angle) + pivot.x;
  const y = (point.x - pivot.x) * Math.sin(angle) + (point.y - pivot.y) * Math.cos(angle) + pivot.y;
  return new Point(x, y);
}

// vendor/difurious/lightweight-charts-line-tools-core/src/interaction/interaction-manager.ts
var DRAG_THRESHOLD = 10;
var CLICK_TIMEOUT = 300;
var InteractionManager = class {
  /**
   * Initializes the Interaction Manager, setting up all internal references and subscribing
   * to necessary DOM and Lightweight Charts events.
   *
   * This class serves as the central event handler, converting low-level mouse and touch
   * events into logical interaction commands for line tools (e.g., drag, select, create).
   *
   * @param plugin - The root {@link LineToolsCorePlugin} instance for internal updates and event firing.
   * @param chart - The Lightweight Charts chart API instance.
   * @param series - The primary series API instance.
   * @param tools - The map of all registered line tools.
   * @param toolRegistry - The registry for looking up tool constructors.
   */
  constructor(plugin, chart, series, tools, toolRegistry) {
    __publicField(this, "_plugin");
    __publicField(this, "_chart");
    __publicField(this, "_series");
    __publicField(this, "_tools");
    __publicField(this, "_toolRegistry");
    __publicField(this, "_horzScaleBehavior");
    // State Management
    __publicField(this, "_currentToolCreating", null);
    __publicField(this, "_selectedTool", null);
    __publicField(this, "_hoveredTool", null);
    // Interaction State (Editing)
    __publicField(this, "_isEditing", false);
    __publicField(this, "_draggedTool", null);
    __publicField(this, "_draggedPointIndex", null);
    __publicField(this, "_originalDragPoints", null);
    __publicField(this, "_dragStartPoint", null);
    // Cache for logical indices to ensure gap-proof translation
    __publicField(this, "_originalDragLogicalIndices", null);
    // Store the cursor that started the interaction
    __publicField(this, "_activeDragCursor", null);
    // Interaction State (Creation - Raw DOM Listeners)
    __publicField(this, "_isCreationGesture", false);
    __publicField(this, "_creationTool", null);
    __publicField(this, "_mouseDownPoint", null);
    __publicField(this, "_mouseDownTime", 0);
    __publicField(this, "_isDrag", false);
    __publicField(this, "_isShiftKeyDown", false);
    __publicField(this, "_lastCrosshairText", "");
    __publicField(this, "_lastCrosshairX", null);
    __publicField(this, "_lastSnapLogical", null);
    __publicField(this, "_lastSnapCandidates", []);
    /**
     * Lock State — when true, all mouse interactions are suppressed.
     * Tools remain visible but cannot be selected, moved, or drawn.
     * @private
     */
    __publicField(this, "_locked", false);
    /**
     * Tracks the last known chart-relative mouse position.
     * Used to accurately determine which pane the mouse is hovering over,
     * bypassing the resetting Y-coordinates of native crosshair events.
     * @private
     */
    __publicField(this, "_currentGlobalPoint", null);
    /**
     * Flag used to track if our supplemental crosshair time label is currently visible.
     * This is used to throttle requestUpdate() calls, ensuring we only trigger a 
     * chart repaint when the label's state actually changes.
     * @private
     */
    __publicField(this, "_crosshairSupplementalVisible", false);
    // --- Stable Event Listener References for Cleanup ---
    __publicField(this, "_isDestroyed", false);
    __publicField(this, "_boundHandleMouseDown", (event) => this._handleMouseDown(event));
    __publicField(this, "_boundHandleMouseMove", (event) => this._handleMouseMove(event));
    __publicField(this, "_boundHandleMouseUp", (event) => this._handleMouseUp(event));
    __publicField(this, "_boundHandleMouseLeave", (event) => this._handleMouseLeave(event));
    __publicField(this, "_boundHandleDblClick", (params) => this._handleDblClick(params));
    __publicField(this, "_boundHandleCrosshairMove", (params) => this._handleCrosshairMove(params));
    __publicField(this, "_boundHandleKeyDown", (event) => this._handleKey(event));
    __publicField(this, "_boundHandleKeyUp", (event) => this._handleKey(event));
    this._plugin = plugin;
    this._chart = chart;
    this._series = series;
    this._tools = tools;
    this._toolRegistry = toolRegistry;
    this._horzScaleBehavior = chart.horzBehaviour();
    this._subscribeToChartEvents();
  }
  // Add an optional bypass parameter to keep magnet active for unconstrained points
  screenPointToLineToolPoint(screenPoint, bypassMagnet = false) {
    const timeScale = this._chart.timeScale();
    let targetY = screenPoint.y;
    let snappedPrice = void 0;
    if (!bypassMagnet) {
      const snapResult = this._getSnappedY(screenPoint.x, screenPoint.y);
      targetY = snapResult.y;
      snappedPrice = snapResult.price;
    }
    let normalizedY = targetY - this._getActivePaneYOffset();
    const paneHeight = this._getActivePaneHeight();
    if (snappedPrice === void 0) {
      if (normalizedY < 0) {
        normalizedY = 0;
      } else if (normalizedY > paneHeight) {
        normalizedY = paneHeight;
      }
    }
    const rawPrice = this._series.coordinateToPrice(normalizedY);
    const logical = timeScale.coordinateToLogical(screenPoint.x);
    if (logical === null || rawPrice === null) {
      return null;
    }
    let finalPrice;
    if (snappedPrice !== void 0) {
      finalPrice = snappedPrice;
    } else {
      const options = this._series.options();
      const minMove = options?.priceFormat?.minMove || 0.01;
      finalPrice = roundPriceToStep(rawPrice, minMove);
    }
    let finalTime = null;
    const barAtCoordinate = this._plugin.getBarAtCoordinate(screenPoint.x);
    if (barAtCoordinate) {
      finalTime = barAtCoordinate.time;
    } else {
      finalTime = interpolateTimeFromLogicalIndex(this._chart, this._series, logical);
    }
    if (finalTime === null) {
      return null;
    }
    return {
      timestamp: this._horzScaleBehavior.key(finalTime),
      price: finalPrice
    };
  }
  /**
   * Sets the specific tool instance that is currently being drawn interactively by the user.
   *
   * This is called by the {@link LineToolsCorePlugin.addLineTool} method when initiating an
   * interactive creation gesture. This tool instance becomes the target for subsequent mouse clicks.
   *
   * @param tool - The {@link BaseLineTool} instance currently in creation mode, or `null` to clear.
   * @internal
   */
  setCurrentToolCreating(tool) {
    this._currentToolCreating = tool;
  }
  /**
   * Sets the global lock state for all drawing interactions.
   *
   * When locked, all mouse interactions (creation, selection, editing, dragging,
   * hovering) are instantly suppressed. If an interaction is currently in progress
   * when the lock is engaged, it is safely aborted to prevent "ghost" tools from
   * remaining stuck on the screen.
   *
   * @param locked - `true` to lock all interactions, `false` to unlock.
   */
  setLocked(locked) {
    this._locked = locked;
    if (locked) {
      this._resetInteractionStateFully();
    }
  }
  /**
   * Returns the current lock state of the Interaction Manager.
   * 
   * @returns `true` if interactions are locked, `false` otherwise.
   */
  isLocked() {
    return this._locked;
  }
  /**
   * Attaches a line tool primitive to the main series for rendering.
   *
   * This is an internal helper called by the {@link LineToolsCorePlugin} immediately after a tool is constructed.
   *
   * @param tool - The {@link BaseLineTool} to attach.
   * @private
   */
  attachTool(tool) {
    this._series.attachPrimitive(tool);
  }
  /**
   * Subscribes to all necessary browser DOM events (`mousedown`, `mousemove`, `mouseup`, `keydown`, `keyup`)
   * and Lightweight Charts API events (`subscribeDblClick`, `subscribeCrosshairMove`) to capture user input.
   *
   * @private
   */
  _subscribeToChartEvents() {
    const chartElement = this._chart.chartElement();
    chartElement.addEventListener("mousedown", this._boundHandleMouseDown, true);
    chartElement.addEventListener("mousemove", this._boundHandleMouseMove, true);
    chartElement.addEventListener("mouseleave", this._boundHandleMouseLeave, true);
    window.addEventListener("mouseup", this._boundHandleMouseUp);
    this._chart.subscribeDblClick(this._boundHandleDblClick);
    this._chart.subscribeCrosshairMove(this._boundHandleCrosshairMove);
    window.addEventListener("keydown", this._boundHandleKeyDown);
    window.addEventListener("keyup", this._boundHandleKeyUp);
  }
  /**
   * Releases all chart, window, and DOM listeners owned by this interaction manager.
   *
   * This method ensures that all event listeners are removed using the exact same 
   * references and capturing flags that were used during registration. It also 
   * resets active interaction states and severs internal API references to 
   * ensure the chart and series can be fully garbage collected.
   *
   * @returns void
   */
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    const chartElement = this._chart.chartElement();
    chartElement.removeEventListener("mousedown", this._boundHandleMouseDown, true);
    chartElement.removeEventListener("mousemove", this._boundHandleMouseMove, true);
    chartElement.removeEventListener("mouseleave", this._boundHandleMouseLeave, true);
    window.removeEventListener("mouseup", this._boundHandleMouseUp);
    window.removeEventListener("keydown", this._boundHandleKeyDown);
    window.removeEventListener("keyup", this._boundHandleKeyUp);
    this._chart.unsubscribeDblClick(this._boundHandleDblClick);
    this._chart.unsubscribeCrosshairMove(this._boundHandleCrosshairMove);
    this._resetInteractionStateFully();
    this._chart = null;
    this._series = null;
    this._horzScaleBehavior = null;
    this._plugin = null;
    this._tools = null;
    this._toolRegistry = null;
    this._hoveredTool = null;
    this._selectedTool = null;
    this._currentToolCreating = null;
    this._currentGlobalPoint = null;
  }
  /**
   * Handles global `keydown` and `keyup` events, specifically tracking the state of the 'Shift' key.
   *
   * The Shift key state is critical for enabling constraint-based drawing (e.g., 45-degree angle locking).
   *
   * @param event - The browser's KeyboardEvent.
   * @private
   */
  _handleKey(event) {
    if (event.key === "Shift") {
      const newState = event.type === "keydown";
      if (this._isShiftKeyDown !== newState) {
        this._isShiftKeyDown = newState;
        if (this._currentToolCreating || this._selectedTool) {
        }
      }
    }
  }
  /**
   * Detaches a line tool primitive from the chart's rendering pipeline and cleans up all internal references to it.
   *
   * This method is called by the {@link LineToolsCorePlugin} when a tool is removed.
   *
   * @param tool - The {@link BaseLineTool} to detach and clean up.
   * @internal
   */
  detachTool(tool) {
    try {
      tool.getPane().detachPrimitive(tool);
    } catch (e) {
      console.error(`[InteractionManager] Error detaching primitive for tool ${tool.id()}:`, e.message);
    }
    if (this._currentToolCreating === tool) {
      this._currentToolCreating = null;
    }
    if (this._selectedTool === tool) {
      this._plugin.fireSingleClickEvent(this._selectedTool, "deselected");
      this._selectedTool = null;
    }
    if (this._hoveredTool === tool) {
      this._hoveredTool = null;
    }
    if (this._draggedTool === tool || this._creationTool === tool) {
      this._isEditing = false;
      this._isCreationGesture = false;
      this._draggedTool = null;
      this._creationTool = null;
      this._draggedPointIndex = null;
      this._originalDragLogicalIndices = null;
      this._mouseDownPoint = null;
      this._mouseDownTime = 0;
      this._isDrag = false;
      this._chart.applyOptions({
        handleScroll: {
          pressedMouseMove: true
        }
      });
    }
  }
  /**
   * Calculates the "Snapped" Y-coordinate and exact price based on data in the active pane, 
   * utilizing a high-performance column cache with a "Live Candle Bypass."
   * 
   * ### Precision Fix: The "Native Truth" Pattern
   * To prevent line tools from storing weird floats (e.g., 12.3123 instead of 12.25), 
   * this engine now captures the exact numeric price directly from the series data 
   * before it is converted to pixels. This object is returned to the caller so 
   * that the "Round Trip" (Price -> Pixel -> Price) conversion—which is prone to 
   * floating point math errors—is bypassed entirely.
   * 
   * ### Efficiency & Real-Time Accuracy
   * To maintain high performance during vertical mouse wiggles, this engine caches 
   * candidate snap points for historical candles. However, it explicitly detects 
   * if the mouse is over the latest (live) candle in the series. 
   * 
   * If the candle is "Live," the cache is bypassed, and series data is fetched 
   * fresh on every pixel move. This ensures that intra-bar price updates 
   * (e.g., a wick growing in real-time) are reflected in the magnet snapping 
   * without latency.
   * 
   * ### Priority Hierarchy
   * 1. Active Tool `magnetThreshold` (if > 0)
   * 2. Global Plugin `magnetThreshold`
   * 
   * @param x - The global screen X coordinate in pixels.
   * @param y - The global screen Y coordinate in pixels.
   * @returns An object containing the snapped Y Coordinate and the exact Price value.
   * @private
   */
  _getSnappedY(x, y) {
    const activeTool = this._draggedTool || this._currentToolCreating;
    const toolThreshold = activeTool?.options().magnetThreshold;
    const effectiveThreshold = toolThreshold !== void 0 && toolThreshold > 0 ? toolThreshold : this._plugin.getMagnetThreshold();
    if (effectiveThreshold <= 0) return { y };
    const layout = this._plugin.getLayout();
    const targetPane = layout.panes.find((p) => y >= p.top && y <= p.top + p.height);
    if (!targetPane) return { y };
    const timeScale = this._chart.timeScale();
    const logical = timeScale.coordinateToLogical(x);
    if (logical === null) return { y };
    const roundedLogical = Math.round(logical);
    const latestBar = this._plugin.getLatestBar();
    let isLiveCandle = false;
    if (latestBar) {
      const latestLogical = timeScale.coordinateToLogical(timeScale.timeToCoordinate(latestBar.time));
      if (latestLogical !== null && roundedLogical === Math.round(latestLogical)) {
        isLiveCandle = true;
      }
    }
    let candidateSources = [];
    if (!isLiveCandle && this._lastSnapLogical === roundedLogical) {
      candidateSources = this._lastSnapCandidates;
    } else {
      targetPane.series.forEach((s) => {
        const dataAtTime = s.dataByIndex(roundedLogical, 0);
        if (!dataAtTime) return;
        if (dataAtTime.close !== void 0) {
          const ohlc = [dataAtTime.open, dataAtTime.high, dataAtTime.low, dataAtTime.close];
          for (const val of ohlc) {
            if (val !== void 0) {
              candidateSources.push({ price: val, series: s });
            }
          }
        } else if (dataAtTime.value !== void 0) {
          candidateSources.push({ price: dataAtTime.value, series: s });
        }
      });
      if (!isLiveCandle) {
        this._lastSnapLogical = roundedLogical;
        this._lastSnapCandidates = candidateSources;
      }
    }
    const paneTop = targetPane.top;
    const candidates = [];
    candidateSources.forEach((source) => {
      const localY = source.series.priceToCoordinate(source.price);
      if (localY !== null) {
        candidates.push({ y: localY + paneTop, price: source.price });
      }
    });
    if (candidates.length === 0) return { y };
    let nearestY = y;
    let nearestPrice = void 0;
    let minDistance = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const dist = Math.abs(y - cand.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestY = cand.y;
        nearestPrice = cand.price;
      }
    }
    if (minDistance <= effectiveThreshold) {
      return {
        y: nearestY,
        price: nearestPrice
      };
    }
    return { y };
  }
  /**
   * Finalizes the interactive creation of a tool once its required number of points have been placed.
   *
   * This method performs state cleanup, deselects all other tools, selects the new tool,
   * calls the tool's optional `normalize()` method, and fires the `afterEdit` event.
   *
   * @param tool - The {@link BaseLineTool} that has completed its creation.
   * @private
   */
  _finalizeToolCreation(tool) {
    tool.tryFinish();
    tool.clearGhostPoint();
    this._plugin.fireAfterEditEvent(tool, "lineToolFinished");
    this.deselectAllTools();
    this._selectedTool = tool;
    this._selectedTool.setSelected(true);
    this._plugin.fireSingleClickEvent(this._selectedTool, "selected");
    const toolWithNormalize = tool;
    if (toolWithNormalize.normalize) {
      toolWithNormalize.normalize();
      console.log(`[InteractionManager] Normalized tool after creation: ${tool.id()}`);
    }
    this._isCreationGesture = false;
    this._creationTool = null;
    this._isDrag = false;
    this._mouseDownPoint = null;
    this._mouseDownTime = 0;
    this.setCurrentToolCreating(null);
    this._chart.applyOptions({ handleScroll: { pressedMouseMove: true } });
    this._plugin.requestUpdate();
  }
  /**
   * Handles the initial `mousedown` event on the chart canvas.
   *
   * This is the crucial entry point for an interaction gesture, determining if the action is:
   * 1. The start of an interactive tool creation.
   * 2. The start of a drag/edit gesture on an existing tool (dragged anchor or body).
   * 3. An initial click that leads to selection.
   *
   * @param event - The browser's MouseEvent.
   * @private
   */
  _handleMouseDown(event) {
    if (this._locked) {
      return;
    }
    this._isShiftKeyDown = event.shiftKey;
    const point = this._eventToPoint(event);
    if (!point) {
      return;
    }
    this._isDrag = false;
    this._mouseDownPoint = point;
    this._mouseDownTime = performance.now();
    if (this._currentToolCreating) {
      this._creationTool = this._currentToolCreating;
      this._isCreationGesture = true;
      this._chart.applyOptions({ handleScroll: { pressedMouseMove: false } });
      return;
    }
    const hitResult = this._hitTest(point);
    if (hitResult && hitResult.tool) {
      if (!hitResult.tool.options().editable) {
        return;
      }
      if (!hitResult.tool.isSelected()) {
        this.deselectAllTools();
        this._selectedTool = hitResult.tool;
        this._selectedTool.setSelected(true);
        this._plugin.fireSingleClickEvent(this._selectedTool, "selected");
      }
      this._draggedTool = hitResult.tool;
      this._draggedPointIndex = hitResult.pointIndex;
      let capturedCursor = hitResult.suggestedCursor || "default" /* Default */;
      if (capturedCursor === "pointer" /* Pointer */ || capturedCursor === "default" /* Default */) {
        const toolDragCursor = hitResult.tool.options().defaultDragCursor;
        capturedCursor = toolDragCursor || "grabbing" /* Grabbing */;
      }
      this._activeDragCursor = capturedCursor;
      let allOriginalPoints = [];
      if (this._draggedTool.pointsCount === -1) {
        allOriginalPoints = deepCopy(this._draggedTool.getPermanentPointsForTranslation());
        if (this._draggedTool.anchor0TriggersTranslation() && this._draggedPointIndex === 0) {
          this._draggedPointIndex = null;
        }
      } else {
        const maxAnchorIndex = hitResult.tool.maxAnchorIndex ? hitResult.tool.maxAnchorIndex() : hitResult.tool.pointsCount - 1;
        const originalPointsArray = [];
        for (let i = 0; i <= maxAnchorIndex; i++) {
          const p = hitResult.tool.getPoint(i);
          originalPointsArray.push(p ? deepCopy(p) : null);
        }
        allOriginalPoints = originalPointsArray.filter((p) => p !== null);
      }
      this._originalDragPoints = allOriginalPoints;
      this._originalDragLogicalIndices = allOriginalPoints.map(
        (p) => interpolateLogicalIndexFromTime(this._chart, this._series, p.timestamp)
      );
      this._dragStartPoint = point;
      this._chart.applyOptions({ handleScroll: { pressedMouseMove: false } });
    }
  }
  /**
   * Handles the `mousemove` event, which primarily manages dragging/editing or ghost-point drawing.
   *
   * This logic handles:
   * 1. Applying drag/edit updates to a selected tool's points, including calculating **Shift-key constraints**.
   * 2. Translating the entire tool if the drag started on the body.
   * 3. Updating the "ghost" point of a tool currently in `Creation` phase.
   * 4. Applying the correct custom cursor style during the drag.
   *
   * @param event - The browser's MouseEvent.
   * @private
   */
  _handleMouseMove(event) {
    if (this._locked) {
      return;
    }
    this._isShiftKeyDown = event.shiftKey;
    const point = this._eventToPoint(event);
    if (!point) {
      return;
    }
    this._currentGlobalPoint = point;
    if (this._isCreationGesture || this._draggedTool) {
      if (this._mouseDownPoint && point.subtract(this._mouseDownPoint).length() > DRAG_THRESHOLD) {
        this._isDrag = true;
      }
    }
    if (this._isCreationGesture && this._creationTool && this._mouseDownPoint) {
      const tool = this._creationTool;
      const isDragCreationSupported = tool.supportsClickDragCreation?.() === true;
      const isShiftConstraintSupported = tool.supportsShiftClickDragConstraint?.() === true;
      if (!isDragCreationSupported && !this._isDrag) {
        return;
      }
      if (this._isDrag && isDragCreationSupported) {
        const p0LocationLogical = this.screenPointToLineToolPoint(this._mouseDownPoint, false);
        let constrainedScreenPoint = point;
        let snapAxis = "none";
        if (this._isShiftKeyDown && isShiftConstraintSupported) {
          const anchorIndexBeingDragged = 1;
          const phase = "creation" /* Creation */;
          const originalP0 = p0LocationLogical;
          if (originalP0 && tool.getShiftConstrainedPoint) {
            const allOriginalLogicalPointsForCreation = this._originalDragPoints || (originalP0 ? [originalP0] : []);
            const constraintResult = tool.getShiftConstrainedPoint(
              anchorIndexBeingDragged,
              point,
              phase,
              originalP0,
              // P0's original position is the constraint source
              allOriginalLogicalPointsForCreation
            );
            constrainedScreenPoint = constraintResult.point;
            snapAxis = constraintResult.snapAxis;
            if (snapAxis === "price") {
              constrainedScreenPoint.y = constrainedScreenPoint.y + this._getActivePaneYOffset();
            }
          }
        }
        let constrainedLogicalPoint = this.screenPointToLineToolPoint(constrainedScreenPoint, this._isShiftKeyDown);
        if (constrainedLogicalPoint && snapAxis !== "none") {
          const P0 = tool.getPoint(0) || p0LocationLogical;
          if (P0) {
            if (snapAxis === "time") {
              constrainedLogicalPoint = {
                timestamp: P0.timestamp,
                price: constrainedLogicalPoint.price
              };
            } else if (snapAxis === "price") {
              constrainedLogicalPoint = {
                timestamp: constrainedLogicalPoint.timestamp,
                price: P0.price
                // Bypass lossy round-trip converting back from screen pixel
              };
            }
          }
        }
        if (p0LocationLogical && constrainedLogicalPoint) {
          const toolPoints = tool.points();
          if (tool.pointsCount === -1) {
            tool.addPoint(constrainedLogicalPoint);
          } else {
            if (tool.points().length === 0) {
              tool.addPoint(p0LocationLogical);
              tool.addPoint(constrainedLogicalPoint);
            } else if (tool.points().length === 2) {
              tool.setPoint(1, constrainedLogicalPoint);
            }
          }
        }
      }
      this._creationTool.updateAllViews();
      this._plugin.requestUpdate();
      return;
    }
    if (this._draggedTool && this._dragStartPoint) {
      if (this._isDrag) {
        this._isEditing = true;
        if (this._activeDragCursor) {
          this._draggedTool.setOverrideCursor(this._activeDragCursor);
        }
      }
      if (this._isEditing) {
        const tool = this._draggedTool;
        const isAnchorDrag = this._draggedPointIndex !== null;
        const phase = isAnchorDrag ? "editing" /* Editing */ : "move" /* Move */;
        if (isAnchorDrag) {
          const anchorIndex = ensureNotNull(this._draggedPointIndex);
          let constrainedScreenPoint = point;
          let snapAxis = "none";
          if (this._isShiftKeyDown) {
            const originalLogicalPoint = this._originalDragPoints[anchorIndex];
            if (originalLogicalPoint && tool.getShiftConstrainedPoint) {
              const constraintResult = tool.getShiftConstrainedPoint(
                // <<< CHANGE 3: Capture ConstraintResult
                anchorIndex,
                point,
                phase,
                originalLogicalPoint,
                this._originalDragPoints
              );
              constrainedScreenPoint = constraintResult.point;
              snapAxis = constraintResult.snapAxis;
              if (constraintResult.snapAxis === "price") {
                constrainedScreenPoint.y = constrainedScreenPoint.y + this._getActivePaneYOffset();
              }
            }
          }
          let targetLogicalPoint = this.screenPointToLineToolPoint(constrainedScreenPoint);
          if (targetLogicalPoint && snapAxis !== "none") {
            const constraintSourceIndex = anchorIndex === 0 ? 1 : 0;
            const referenceLogicalPoint = this._originalDragPoints[constraintSourceIndex];
            if (referenceLogicalPoint) {
              if (snapAxis === "time") {
                targetLogicalPoint.timestamp = referenceLogicalPoint.timestamp;
              } else if (snapAxis === "price") {
                targetLogicalPoint.price = referenceLogicalPoint.price;
              }
            }
          }
          if (targetLogicalPoint) {
            tool.setPoint(anchorIndex, targetLogicalPoint);
          }
        } else {
          if (!this._originalDragPoints || this._originalDragPoints.length === 0) return;
          const delta = point.subtract(this._dragStartPoint);
          const tool2 = this._draggedTool;
          const initialLogicalP0 = this._originalDragPoints[0];
          const initialScreenP0 = tool2.pointToScreenPoint(initialLogicalP0);
          if (!initialScreenP0) return;
          const newScreenP0 = initialScreenP0.add(delta);
          const newLogicalP0 = tool2.screenPointToPoint(newScreenP0);
          if (!newLogicalP0) {
            console.warn(`[InteractionManager] Failed to determine new logical P0.`);
            return;
          }
          const initialP0LogicalIndex = this._originalDragLogicalIndices[0];
          const newP0LogicalIndex = this._chart.timeScale().coordinateToLogical(newScreenP0.x);
          if (initialP0LogicalIndex === null || newP0LogicalIndex === null) {
            console.warn(`[InteractionManager] Failed to determine logical indices for translation.`);
            return;
          }
          const logicalIndexDelta = newP0LogicalIndex - initialP0LogicalIndex;
          const rawPriceTranslationVector = newLogicalP0.price - initialLogicalP0.price;
          const newLogicalPoints = [];
          const seriesOptions = this._series.options();
          const minMove = seriesOptions?.priceFormat?.minMove || 0.01;
          const priceTranslationVector = roundPriceToStep(rawPriceTranslationVector, minMove);
          for (let i = 0; i < this._originalDragPoints.length; i++) {
            const originalLogicalPoint = this._originalDragPoints[i];
            const originalIndex = this._originalDragLogicalIndices[i];
            let newTimestamp = originalLogicalPoint.timestamp;
            if (originalIndex !== null) {
              const targetLogicalIndex = originalIndex + logicalIndexDelta;
              const interpolatedTime = interpolateTimeFromLogicalIndex(this._chart, this._series, targetLogicalIndex);
              if (interpolatedTime !== null) {
                newTimestamp = this._horzScaleBehavior.key(interpolatedTime);
              }
            }
            const translatedLogicalPoint = {
              timestamp: newTimestamp,
              // --- ROUNDING INJECTION: Clean the arithmetic result ---
              price: roundPriceToStep(originalLogicalPoint.price + priceTranslationVector, minMove)
            };
            newLogicalPoints.push(translatedLogicalPoint);
          }
          tool2.setPoints(newLogicalPoints);
        }
        this._draggedTool.updateAllViews();
        this._plugin.requestUpdate();
      }
    }
  }
  /**
   * Handles the `mouseup` event, finalizing any active interaction (creation or editing).
   *
   * This method is responsible for:
   * 1. Committing the final point in a click-click creation sequence.
   * 2. Finalizing a drag-based creation (e.g., Rectangle, Brush).
   * 3. Finalizing an editing drag (resizing or translation) and resetting the editing state.
   * 4. Handling standalone clicks for selection/deselection.
   *
   * @param event - The browser's MouseEvent.
   * @private
   */
  _handleMouseUp(event) {
    if (this._locked) {
      return;
    }
    this._isShiftKeyDown = event.shiftKey;
    const point = this._eventToPoint(event);
    const chartElement = this._chart.chartElement();
    const clickedInsideChartElement = chartElement.contains(event.target);
    if (!clickedInsideChartElement && !this._isDrag && !this._isCreationGesture && !this._draggedTool) {
      this._resetCommonGestureState();
      return;
    }
    let handledInteraction = false;
    if (this._isCreationGesture && this._creationTool && this._mouseDownPoint) {
      handledInteraction = true;
      const tool = this._creationTool;
      const timeDelta = performance.now() - this._mouseDownTime;
      const distanceMoved = point ? point.subtract(this._mouseDownPoint).length() : 0;
      const finalizationMethod = tool.getFinalizationMethod();
      const endPoint = point || this._mouseDownPoint;
      let finalScreenPoint = endPoint;
      let isDiscreteClick = timeDelta < CLICK_TIMEOUT && distanceMoved <= DRAG_THRESHOLD && !this._isDrag;
      if (tool.pointsCount === 1) {
        const finalScreenPoint2 = endPoint;
        const finalLogicalPoint = this.screenPointToLineToolPoint(finalScreenPoint2);
        if (finalLogicalPoint) {
          tool.addPoint(finalLogicalPoint);
          this._finalizeToolCreation(tool);
          return;
        } else {
          this.detachTool(tool);
          this._tools.delete(tool.id());
          this.setCurrentToolCreating(null);
          this._resetCreationGestureStateOnly();
          return;
        }
      }
      if (this._creationTool && !isDiscreteClick) {
        const tool2 = this._creationTool;
        const permanentPointsCount = tool2.getPermanentPointsCount();
        const isFixedPointTool = tool2.pointsCount > 0;
        const isSubsequentPointOfFixedTool = isFixedPointTool && permanentPointsCount > 0;
        if (isSubsequentPointOfFixedTool || tool2.supportsClickDragCreation?.() === false) {
          isDiscreteClick = true;
        }
      }
      const supportsClickClick = tool.supportsClickClickCreation?.() !== false;
      const supportsClickDrag = tool.supportsClickDragCreation?.() === true;
      if (finalizationMethod === "mouseUp" /* MouseUp */) {
        if (supportsClickDrag) {
          if (tool.getPermanentPointsCount() >= 2) {
            this._finalizeToolCreation(tool);
          } else {
            this.detachTool(tool);
            this._tools.delete(tool.id());
          }
          this._resetCreationGestureStateOnly();
          return;
        }
      }
      if (isDiscreteClick) {
        if (!supportsClickClick) {
          console.warn(`[InteractionManager] Tool ${tool.toolType} does not support click-click creation.`);
          this.setCurrentToolCreating(null);
          this.deselectAllTools();
          this._plugin.requestUpdate();
          this._resetCreationGestureStateOnly();
          return;
        }
        const isShiftKeyDown = this._isShiftKeyDown;
        const isShiftConstraintSupported = tool.supportsShiftClickClickConstraint?.() === true;
        let snapAxis = "none";
        if (isShiftKeyDown && isShiftConstraintSupported) {
          const anchorIndexBeingAdded = tool.getPermanentPointsCount();
          const anchorIndexUsedForConstraint = 0;
          const originalLogicalPoint = tool.getPoint(anchorIndexUsedForConstraint);
          const allOriginalLogicalPoints = [originalLogicalPoint];
          if (originalLogicalPoint && tool.getShiftConstrainedPoint) {
            const constraintResult = tool.getShiftConstrainedPoint(
              anchorIndexBeingAdded,
              endPoint,
              // Pass the raw mouse point
              "creation" /* Creation */,
              originalLogicalPoint,
              // P0's original position
              allOriginalLogicalPoints
            );
            finalScreenPoint = constraintResult.point;
            snapAxis = constraintResult.snapAxis;
            if (snapAxis === "price") {
              finalScreenPoint.y = finalScreenPoint.y + this._getActivePaneYOffset();
            }
          }
        }
        const isConstrained = this._isShiftKeyDown && tool.getPermanentPointsCount() > 0;
        let finalLogicalPoint = this.screenPointToLineToolPoint(finalScreenPoint, isConstrained);
        const isP1Click = tool.getPermanentPointsCount() === 1;
        if (finalLogicalPoint && isP1Click && snapAxis !== "none") {
          tool.setLastPoint(null);
          const P0 = tool.getPoint(0);
          if (P0) {
            if (snapAxis === "time") {
              finalLogicalPoint = {
                timestamp: P0.timestamp,
                price: finalLogicalPoint.price
                // Keep the interpolated price
              };
            } else if (snapAxis === "price") {
              finalLogicalPoint = {
                timestamp: finalLogicalPoint.timestamp,
                // Keep the interpolated time
                price: P0.price
              };
            }
          }
        } else {
          if (finalLogicalPoint) {
            tool.setLastPoint(null);
          }
        }
        if (finalLogicalPoint) {
          tool.addPoint(finalLogicalPoint);
        } else {
          console.warn(`[InteractionManager] Final logical point conversion failed. Click discarded.`);
        }
        if (finalizationMethod === "pointCount" /* PointCount */ && tool.isFinished()) {
          this._finalizeToolCreation(tool);
          return;
        } else {
        }
      } else if (this._isDrag) {
        if (!supportsClickDrag) {
          console.warn(`[InteractionManager] Tool ${tool.toolType} does not support click-drag creation.`);
          this.setCurrentToolCreating(null);
          this.deselectAllTools();
          this._plugin.requestUpdate();
          this._resetCreationGestureStateOnly();
          return;
        }
        if (finalizationMethod === "pointCount" /* PointCount */ && tool.pointsCount === 2) {
          if (tool.points().length === 2) {
            this._finalizeToolCreation(tool);
            return;
          }
        }
      }
      this._resetCreationGestureStateOnly();
      return;
    }
    if (this._draggedTool && this._dragStartPoint) {
      if (this._isEditing) {
        this._plugin.fireAfterEditEvent(this._draggedTool, "lineToolEdited");
        const tool = this._draggedTool;
        if (tool.normalize) {
          tool.normalize();
        }
      } else {
        this._handleStandaloneClick(this._dragStartPoint);
      }
      this._resetEditingGestureStateOnly();
      return;
    }
    const timeDeltaFinal = performance.now() - this._mouseDownTime;
    const distanceMovedFinal = this._mouseDownPoint && point ? point.subtract(this._mouseDownPoint).length() : 0;
    const wasAShortClick = timeDeltaFinal < CLICK_TIMEOUT && distanceMovedFinal <= DRAG_THRESHOLD && point;
    if (wasAShortClick) {
      const chartElement2 = this._chart.chartElement();
      const clickedInsideChartElement2 = chartElement2.contains(event.target);
      if (clickedInsideChartElement2) {
        handledInteraction = true;
        this._handleStandaloneClick(point);
      } else {
        handledInteraction = true;
      }
    } else {
      if (this._isDrag) {
        handledInteraction = true;
        this.deselectAllTools();
        this._plugin.requestUpdate();
      }
    }
    if (!handledInteraction) {
      this._resetInteractionStateFully();
    } else {
      this._resetCommonGestureState();
    }
  }
  /**
   * Clears flags related only to a one-time mouse gesture (drag state, mouse position/time).
   *
   * This is used during multi-point creation to reset the interaction flags *without* ending the
   * overall `_currentToolCreating` process.
   *
   * @private
   */
  /*
  private _resetCreationGestureStateOnly(): void {
  	this._isDrag = false;
  	this._mouseDownPoint = null;
  	this._mouseDownTime = 0;
  	this._isCreationGesture = false;
  	// IMPORTANT: Does NOT touch _currentToolCreating or _activeTool
  }
  */
  _resetCreationGestureStateOnly() {
    this._isCreationGesture = false;
    this._resetCommonGestureState();
  }
  /**
   * Clears flags and state related to an active tool editing/dragging session.
   *
   * This includes clearing the dragged tool reference, clearing the cursor override, and
   * re-enabling the chart's built-in scroll/pan functionality.
   *
   * @private
   */
  _resetEditingGestureStateOnly() {
    if (this._draggedTool) {
      this._draggedTool.setOverrideCursor(null);
    }
    this._activeDragCursor = null;
    this._isEditing = false;
    this._draggedTool = null;
    this._draggedPointIndex = null;
    this._dragStartPoint = null;
    this._originalDragLogicalIndices = null;
    this._originalDragPoints = null;
    this._chart.applyOptions({ handleScroll: { pressedMouseMove: true } });
    this._resetCommonGestureState();
  }
  /**
   * Clears the most fundamental mouse gesture state variables: drag flag, mouse down point, and time.
   *
   * @private
   */
  _resetCommonGestureState() {
    this._isDrag = false;
    this._mouseDownPoint = null;
    this._mouseDownTime = 0;
  }
  /**
   * Performs a complete reset of all interaction state flags, including clearing the tool in creation,
   * deselecting all tools, and requesting a chart update.
   *
   * This is typically used as a fallback for unhandled interactions or external API calls (e.g., context menus).
   *
   * @private
   */
  _resetInteractionStateFully() {
    this._resetCreationGestureStateOnly();
    this._resetEditingGestureStateOnly();
    this.setCurrentToolCreating(null);
    this.deselectAllTools();
    this._plugin.requestUpdate();
  }
  /**
   * Processes a discrete click that occurred outside of an active creation or editing gesture.
   *
   * This logic handles selection: if a tool was clicked, it becomes selected; otherwise, all tools are deselected.
   *
   * @param point - The screen coordinates of the click event.
   * @private
   */
  _handleStandaloneClick(point) {
    const clickedTool = point ? this._hitTest(point)?.tool : null;
    if (clickedTool) {
      if (this._selectedTool === clickedTool) return;
      this.deselectAllTools();
      this._selectedTool = clickedTool;
      this._selectedTool.setSelected(true);
      this._plugin.fireSingleClickEvent(this._selectedTool, "selected");
    } else {
      this.deselectAllTools();
    }
  }
  /**
   * Handles the chart's double-click event broadcast.
   *
   * This method checks for two conditions:
   * 1. **Creation Finalization:** Ends the drawing process for tools that use `FinalizationMethod.DoubleClick` (e.g., Path tool).
   * 2. **Event Firing:** Triggers the public `fireDoubleClickEvent` if an existing tool was hit.
   *
   * @param params - The event parameters provided by Lightweight Charts.
   * @private
   */
  _handleDblClick(params) {
    if (this._locked) {
      return;
    }
    const point = params.point ? new Point(params.point.x, params.point.y) : null;
    if (!point) return;
    if (this._currentToolCreating) {
      const tool = this._currentToolCreating;
      if (tool.getFinalizationMethod() === "doubleClick" /* DoubleClick */) {
        if (tool.getPermanentPointsCount() > 0) {
          tool.handleDoubleClickFinalization();
          this._finalizeToolCreation(tool);
          this._resetCreationGestureStateOnly();
        } else {
          this.detachTool(tool);
          this._tools.delete(tool.id());
          this.setCurrentToolCreating(null);
        }
        return;
      }
    }
    const hitResult = this._hitTest(point);
    if (hitResult && hitResult.tool) {
      this._plugin.fireDoubleClickEvent(hitResult.tool);
    }
  }
  /**
   * Handles the chart's crosshair move event, used for hover state and ghost-point drawing.
   *
   * This method:
   * 1. Manages the visual state of the tool currently being created (the "ghosting" point), applying Shift-key constraints.
   * 2. Updates the `_hoveredTool` property and sets its hover state, allowing views to draw hover effects.
   *
   * @param params - The event parameters provided by Lightweight Charts.
   * @private
   */
  _handleCrosshairMove(params) {
    if (this._locked) {
      return;
    }
    if (this._plugin.getMagnetThreshold() > 0 && !this._isShiftKeyDown && !this._currentToolCreating) {
      if (params.point && params.time) {
        const globalY = this._currentGlobalPoint ? this._currentGlobalPoint.y : -1;
        if (this._isMouseInActivePane(globalY)) {
          const globalX = this._currentGlobalPoint ? this._currentGlobalPoint.x : params.point.x;
          this._plugin.setCrossHairXY(globalX, globalY, true, params.time);
        }
      }
    }
    if (params.point && !params.time) {
      const logical = this._chart.timeScale().coordinateToLogical(params.point.x);
      if (logical !== null) {
        const interpolatedTime = interpolateTimeFromLogicalIndex(this._chart, this._series, logical);
        if (interpolatedTime !== null) {
          const timeAsHorzScaleItem = interpolatedTime;
          const pluginFormatter = this._plugin.getTimeFormatter();
          const chartFormatter = this._chart.options().localization.timeFormatter;
          let text = "";
          if (pluginFormatter) {
            text = pluginFormatter(timeAsHorzScaleItem);
          } else if (chartFormatter) {
            text = chartFormatter(timeAsHorzScaleItem);
          } else {
            const internalItem = this._horzScaleBehavior.convertHorzItemToInternal(timeAsHorzScaleItem);
            text = this._horzScaleBehavior.formatHorzItem(internalItem);
          }
          const snappedLogical = Math.round(logical);
          const snappedX = this._chart.timeScale().logicalToCoordinate(snappedLogical);
          if (snappedX !== null) {
            if (this._lastCrosshairX !== snappedX || this._lastCrosshairText !== text || !this._crosshairSupplementalVisible) {
              this._lastCrosshairX = snappedX;
              this._lastCrosshairText = text;
              this._plugin.updateCrosshairTimeLabel(text, snappedX, true);
              this._crosshairSupplementalVisible = true;
              this._plugin.requestUpdate();
            }
          }
        } else {
          if (this._crosshairSupplementalVisible) {
            this._lastCrosshairX = null;
            this._lastCrosshairText = "";
            this._plugin.updateCrosshairTimeLabel("", 0, false);
            this._crosshairSupplementalVisible = false;
            this._plugin.requestUpdate();
          }
        }
      }
    } else {
      if (this._crosshairSupplementalVisible) {
        this._lastCrosshairX = null;
        this._lastCrosshairText = "";
        this._plugin.updateCrosshairTimeLabel("", 0, false);
        this._crosshairSupplementalVisible = false;
        this._plugin.requestUpdate();
      }
    }
    const toolBeingCreated = this._currentToolCreating;
    if (toolBeingCreated) {
      const rawScreenPoint = this._currentGlobalPoint ? this._currentGlobalPoint.clone() : null;
      if (rawScreenPoint && toolBeingCreated.pointsCount === 1) {
        const logicalPoint = this.screenPointToLineToolPoint(rawScreenPoint);
        if (logicalPoint) {
          if (params.time && this._isMouseInActivePane(rawScreenPoint.y)) {
            this._plugin.setCrossHairXY(rawScreenPoint.x, rawScreenPoint.y, true, params.time);
          }
          toolBeingCreated.setLastPoint(logicalPoint);
          this._plugin.requestUpdate();
        }
        return;
      }
      const isShiftKeyDown = this._isShiftKeyDown;
      let finalScreenPoint = rawScreenPoint;
      let snapAxis = "none";
      const supportsClickClick = toolBeingCreated.supportsClickClickCreation?.() !== false;
      if (!supportsClickClick) {
        toolBeingCreated.setLastPoint(null);
        this._plugin.requestUpdate();
        return;
      }
      if (toolBeingCreated.points().length > 0 && rawScreenPoint && isShiftKeyDown && toolBeingCreated.supportsShiftClickClickConstraint?.() === true) {
        const anchorIndexBeingDragged = 1;
        const phase = "creation" /* Creation */;
        const anchorIndexUsedForConstraint = 0;
        const originalLogicalPoint = toolBeingCreated.getPoint(anchorIndexUsedForConstraint);
        const allOriginalLogicalPoints = [originalLogicalPoint];
        if (toolBeingCreated.getShiftConstrainedPoint && originalLogicalPoint) {
          const constraintResult = toolBeingCreated.getShiftConstrainedPoint(
            // <<< CHANGE: Capture ConstraintResult
            anchorIndexBeingDragged,
            rawScreenPoint,
            phase,
            originalLogicalPoint,
            allOriginalLogicalPoints
          );
          finalScreenPoint = constraintResult.point;
          snapAxis = constraintResult.snapAxis;
          if (constraintResult.snapAxis === "price") {
            finalScreenPoint.y = finalScreenPoint.y + this._getActivePaneYOffset();
          }
        }
      }
      if (finalScreenPoint) {
        const logicalPoint = this.screenPointToLineToolPoint(finalScreenPoint, isShiftKeyDown);
        if (logicalPoint) {
          if (toolBeingCreated.points().length > 0 && snapAxis !== "none") {
            const P0 = toolBeingCreated.getPoint(0);
            if (P0) {
              if (snapAxis === "time") {
                logicalPoint.timestamp = P0.timestamp;
              } else if (snapAxis === "price") {
                logicalPoint.price = P0.price;
              }
            }
          }
          if (params.time && rawScreenPoint && this._isMouseInActivePane(rawScreenPoint.y)) {
            this._plugin.setCrossHairXY(rawScreenPoint.x, rawScreenPoint.y, true, params.time);
          }
          if (toolBeingCreated.points().length > 0) {
            toolBeingCreated.setLastPoint(logicalPoint);
          }
        } else {
          toolBeingCreated.setLastPoint(null);
        }
      } else {
        toolBeingCreated.setLastPoint(null);
      }
      this._plugin.requestUpdate();
      return;
    }
    const point = this._currentGlobalPoint ? this._currentGlobalPoint.clone() : null;
    const hitResult = point ? this._hitTest(point) : null;
    const hoveredTool = hitResult ? hitResult.tool : null;
    if (this._hoveredTool && this._hoveredTool !== hoveredTool) {
      this._hoveredTool.setHovered(false);
    }
    this._hoveredTool = hoveredTool;
    if (hoveredTool) {
      hoveredTool.setHovered(true);
    }
  }
  /**
   * Performs a hit test on all visible line tools, iterating them in reverse Z-order (top-most first).
   *
   * @param point - The screen coordinates to test against all tools.
   * @returns An object containing the hit tool, the hit point index, and the suggested cursor type, or `null` if no tool was hit.
   * @private
   */
  _hitTest(point) {
    const tools = Array.from(this._tools.values()).reverse();
    for (const tool of tools) {
      if (!tool.options().visible) {
        continue;
      }
      const toolPaneOffset = this._getPaneYOffsetForTool(tool);
      const normalizedY = point.y - toolPaneOffset;
      const hitResult = tool._internalHitTest(point.x, normalizedY);
      if (hitResult) {
        return {
          tool,
          // The data() method gives us the payload, which is { pointIndex, cursorType }
          pointIndex: hitResult.data()?.pointIndex ?? null,
          // [NEW] Pass the cursor through
          suggestedCursor: hitResult.data()?.suggestedCursor ?? null
        };
      }
    }
    return null;
  }
  /**
   * Clears the selection state of the currently selected tool, if one exists.
   *
   * This is a public utility often called by the {@link LineToolsCorePlugin} or by the `InteractionManager`'s internal logic.
   *
   * @returns void
   */
  deselectAllTools() {
    if (this._selectedTool) {
      const toolToDeselect = this._selectedTool;
      this._selectedTool.setSelected(false);
      this._selectedTool = null;
      this._plugin.fireSingleClickEvent(toolToDeselect, "deselected");
      this._plugin.requestUpdate();
    }
  }
  /**
   * Converts a raw browser `MouseEvent` (which uses screen coordinates) into a chart-relative
   * {@link Point} object (CSS pixels relative to the chart canvas).
   *
   * @param event - The browser's MouseEvent.
   * @returns A chart-relative {@link Point} object, or `null` if the chart element bounding box cannot be retrieved.
   * @private
   */
  _eventToPoint(event) {
    const rect = this._chart.chartElement().getBoundingClientRect();
    return new Point(event.clientX - rect.left, event.clientY - rect.top);
  }
  /**
   * Handles the 'mouseleave' event on the chart container.
   * 
   * This is critical for crosshair synchronization. It ensures that when the mouse 
   * moves to another chart, this instance's "last known position" is cleared, 
   * preventing the passive magnet engine from using stale coordinates.
   * 
   * @param event - The browser's MouseEvent.
   * @private
   */
  _handleMouseLeave(event) {
    this._isShiftKeyDown = event.shiftKey;
    this._currentGlobalPoint = null;
    if (!this._currentToolCreating) {
      this._plugin.clearCrossHair();
    }
  }
  /**
   * Determines the vertical offset of the current series' pane.
   * 
   * @private
   * @returns The vertical offset in pixels.
   */
  _getActivePaneYOffset() {
    const layout = this._plugin.getLayout();
    const myPane = layout.panes.find((p) => p.series.indexOf(this._series) !== -1);
    return myPane ? myPane.top : 0;
  }
  /**
   * Determines the height of the current series' pane.
   * 
   * @private
   * @returns The pane height in pixels.
   */
  _getActivePaneHeight() {
    const layout = this._plugin.getLayout();
    const myPane = layout.panes.find((p) => p.series.indexOf(this._series) !== -1);
    return myPane ? myPane.height : 1e4;
  }
  /**
   * Validates if a global Y-coordinate is within the drawing bounds of the active pane.
   * 
   * @private
   * @param y - The global Y coordinate relative to the chart container.
   * @returns True if the mouse is in the active pane.
   */
  _isMouseInActivePane(y) {
    const layout = this._plugin.getLayout();
    const myPane = layout.panes.find((p) => p.series.indexOf(this._series) !== -1);
    if (!myPane) return true;
    return y >= myPane.top && y <= myPane.top + myPane.height;
  }
  /**
   * Determines the vertical offset for a specific tool's pane.
   * 
   * @private
   * @param tool - The specific tool instance being evaluated.
   * @returns The vertical offset in pixels.
   */
  _getPaneYOffsetForTool(tool) {
    const layout = this._plugin.getLayout();
    const toolPane = layout.panes.find((p) => p.series.indexOf(tool.getSeries()) !== -1);
    return toolPane ? toolPane.top : 0;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/model/price-axis-label-stacking-manager.ts
var LABEL_MARGIN_PX = 2;
var PriceAxisLabelStackingManager = class {
  /**
   * Initializes the stacking manager and sets up the default renderer options based on chart and series settings.
   *
   * @param chart - The Lightweight Charts chart API instance.
   * @param series - The primary series API instance.
   */
  constructor(chart, series) {
    __publicField(this, "_chart");
    __publicField(this, "_series");
    __publicField(this, "_labels", /* @__PURE__ */ new Map());
    __publicField(this, "_priceAxisRendererOptions", null);
    __publicField(this, "_currentPriceScale", null);
    this._chart = chart;
    this._series = series;
    console.log("[PriceAxisLabelStackingManager] Initializing...");
    const chartOptions = this._chart.options();
    const layoutOptions = chartOptions.layout;
    const priceScaleOptions = this._series.priceScale().options();
    this._priceAxisRendererOptions = {
      font: `${layoutOptions.fontSize || 12}px ${layoutOptions.fontFamily || "sans-serif"}`,
      fontFamily: layoutOptions.fontFamily || "sans-serif",
      color: layoutOptions.textColor || "#FFFFFF",
      fontSize: layoutOptions.fontSize || 12,
      baselineOffset: 0,
      borderSize: priceScaleOptions.borderVisible ? 1 : 0,
      paddingBottom: 2,
      paddingInner: 2,
      paddingOuter: 2,
      paddingTop: 2,
      tickLength: priceScaleOptions.ticksVisible ? 4 : 0
    };
    console.log("[PriceAxisLabelStackingManager] Initial PriceAxisViewRendererOptions set from chart/series defaults.");
  }
  /**
   * Converts a Y-coordinate (pixel) to a price value using the current price scale.
   *
   * @param coordinate - The Y-coordinate in pixels.
   * @returns The corresponding price value, or `null` if the price scale is not available.
   * @private
   */
  _coordinateToPrice(coordinate) {
    if (this._currentPriceScale) {
      return this._series.coordinateToPrice(coordinate);
    }
    return null;
  }
  /**
   * Registers a new label or updates an existing one for collision detection.
   *
   * Each label provides its desired coordinate, height, and a callback function for the manager
   * to apply the final, collision-free coordinate.
   *
   * @param labelData - The {@link LabelDataForStacking} object containing the label's required information.
   * @returns void
   */
  registerLabel(labelData) {
    const isNew = !this._labels.has(labelData.id);
    this._labels.set(labelData.id, labelData);
  }
  /**
   * Removes a label from the tracking system.
   *
   * This is called when a tool is destroyed or when a label becomes structurally invalid/invisible.
   * It also clears any fixed coordinate that was previously applied to the label.
   *
   * @param id - The unique identifier of the label to unregister (e.g., `toolId + '-p' + pointIndex`).
   * @returns void
   */
  unregisterLabel(id) {
    const label = this._labels.get(id);
    if (label) {
      label.setFixedCoordinate(void 0);
      this._labels.delete(id);
    }
  }
  /**
   * Updates the rendering options that define the size and padding of price axis labels.
   *
   * This information is critical for accurate height calculation during the collision detection process.
   *
   * @param options - The new {@link PriceAxisViewRendererOptions} object.
   * @returns void
   */
  setPriceAxisRendererOptions(options) {
    this._priceAxisRendererOptions = options;
  }
  /**
   * Executes the core stacking algorithm.
   *
   * 1. Collects all currently active and valid labels.
   * 2. Sorts them by their original Y-coordinate (top-to-bottom).
   * 3. Iterates through the sorted list, calculating and applying a new `fixedCoordinate`
   *    to any label that collides with a previously processed label.
   *
   * This method must be called synchronously whenever a tool's position changes to ensure
   * the labels are correctly positioned before the chart redraws.
   *
   * @returns void
   */
  updateStacking() {
    if (!this._priceAxisRendererOptions) {
      console.warn("[PALSManager] Cannot update stacking: PriceAxisViewRendererOptions not set. Skipping stacking adjustment.");
      this._labels.forEach((label) => label.setFixedCoordinate(void 0));
      return;
    }
    const priceScale = this._series.priceScale();
    if (!priceScale) {
      console.warn("[PALSManager] No price scale available. Skipping stacking adjustment.");
      this._labels.forEach((label) => label.setFixedCoordinate(void 0));
      return;
    }
    this._currentPriceScale = priceScale;
    const activeLabels = [];
    this._labels.forEach((label) => {
      if (label.isVisible() && isFinite(label.originalCoordinate) && label.height > 0) {
        activeLabels.push(label);
      } else {
        label.setFixedCoordinate(void 0);
      }
    });
    if (activeLabels.length < 2) {
      activeLabels.forEach((label) => label.setFixedCoordinate(void 0));
      return;
    }
    activeLabels.sort((a, b) => a.originalCoordinate - b.originalCoordinate);
    let lastOccupiedBottomCoord = void 0;
    for (let i = 0; i < activeLabels.length; i++) {
      const currentLabel = activeLabels[i];
      let newFixedCoord = currentLabel.originalCoordinate;
      const currentLabelHalfHeight = currentLabel.height / 2;
      const currentLabelTop = currentLabel.originalCoordinate - currentLabelHalfHeight;
      if (lastOccupiedBottomCoord !== void 0) {
        const collisionThreshold = lastOccupiedBottomCoord + LABEL_MARGIN_PX;
        if (currentLabelTop < collisionThreshold) {
          const newTop = collisionThreshold;
          newFixedCoord = newTop + currentLabelHalfHeight;
        } else {
        }
      }
      if (newFixedCoord !== currentLabel.originalCoordinate) {
        currentLabel.setFixedCoordinate(newFixedCoord);
      } else {
        currentLabel.setFixedCoordinate(void 0);
      }
      const finalCenterY = newFixedCoord !== currentLabel.originalCoordinate ? newFixedCoord : currentLabel.originalCoordinate;
      lastOccupiedBottomCoord = finalCenterY + currentLabelHalfHeight;
    }
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/utils/text-width-cache.ts
var defaultReplacementRe = /[2-9]/g;
var TextWidthCache = class {
  // Maps cacheString to metrics and usage tick
  /**
      * Initializes the cache with a specific capacity.
      * 
      * @param size - The maximum number of text metrics to store before evicting the oldest entries. Default is 50.
      */
  constructor(size = 50) {
    __publicField(this, "_maxSize");
    __publicField(this, "_actualSize", 0);
    __publicField(this, "_usageTick", 1);
    __publicField(this, "_oldestTick", 1);
    __publicField(this, "_tick2Labels", {});
    // Maps usage tick to cacheString
    __publicField(this, "_cache", /* @__PURE__ */ new Map());
    this._maxSize = size;
  }
  /**
      * Clears all cached entries and resets the usage tracking.
      * 
      * This should be called when font settings change (e.g., font size or family updates),
      * as previous measurements would be invalid.
      */
  reset() {
    this._actualSize = 0;
    this._cache.clear();
    this._usageTick = 1;
    this._oldestTick = 1;
    this._tick2Labels = {};
  }
  /**
      * Measures the width of the provided text, using the cache if available.
      * 
      * If the text (after optimization replacement) is in the cache, the stored width is returned.
      * Otherwise, the text is measured using the provided context, stored in the cache, and returned.
      * 
      * @param ctx - The canvas context to use for measurement if the cache misses.
      * @param text - The text string to measure.
      * @param optimizationReplacementRe - Optional regex to normalize the text (e.g., replacing digits with '0') to increase cache hits.
      * @returns The width of the text in pixels.
      */
  measureText(ctx, text, optimizationReplacementRe2) {
    return this._getMetrics(ctx, text, optimizationReplacementRe2).width;
  }
  /**
      * Calculates the vertical offset required to center text accurately.
      * 
      * Canvas `textBaseline = 'middle'` often results in slight visual misalignment depending on the font.
      * This method uses `actualBoundingBoxAscent` and `actualBoundingBoxDescent` (if supported) 
      * to calculate a pixel-perfect vertical correction.
      * 
      * @param ctx - The canvas context.
      * @param text - The text string to measure.
      * @param optimizationReplacementRe - Optional optimization regex.
      * @returns The y-axis offset in pixels.
      */
  yMidCorrection(ctx, text, optimizationReplacementRe2) {
    const metrics = this._getMetrics(ctx, text, optimizationReplacementRe2);
    return ((metrics.actualBoundingBoxAscent || 0) - (metrics.actualBoundingBoxDescent || 0)) / 2;
  }
  /**
      * Internal method to retrieve or compute `TextMetrics` for a string.
      * 
      * Handles the core LRU logic:
      * 1. Applies the optimization regex to the input text key.
      * 2. Checks the cache. If found, updates the usage tick and returns.
      * 3. If missing, evicts the oldest entry if the cache is full.
      * 4. Measures the text and stores the result.
      * 
      * @param ctx - The canvas context.
      * @param text - The text to measure.
      * @param optimizationReplacementRe - Regex for digit normalization.
      * @returns The standard `TextMetrics` object.
      * @private
      */
  _getMetrics(ctx, text, optimizationReplacementRe2) {
    const re = optimizationReplacementRe2 || defaultReplacementRe;
    const cacheString = String(text).replace(re, "0");
    if (this._cache.has(cacheString)) {
      const cacheEntry = ensureDefined(this._cache.get(cacheString));
      cacheEntry.tick = this._usageTick++;
      return cacheEntry.metrics;
    }
    if (this._actualSize === this._maxSize) {
      const oldestValueString = this._tick2Labels[this._oldestTick];
      delete this._tick2Labels[this._oldestTick];
      this._cache.delete(oldestValueString);
      this._oldestTick++;
      this._actualSize--;
    }
    ctx.save();
    ctx.textBaseline = "middle";
    const metrics = ctx.measureText(cacheString);
    ctx.restore();
    if (metrics.width === 0 && !!text.length) {
      return metrics;
    }
    this._cache.set(cacheString, { metrics, tick: this._usageTick });
    this._tick2Labels[this._usageTick] = cacheString;
    this._actualSize++;
    this._usageTick++;
    return metrics;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/rendering/time-axis-view-renderer.ts
var optimizationReplacementRe = /[1-9]/g;
var TimeAxisViewRenderer = class {
  // NEW: Fallback cache
  /**
   * Initializes the renderer. Data is set later via `setData`.
   */
  constructor() {
    __publicField(this, "_data", null);
    __publicField(this, "_fallbackTextWidthCache", null);
  }
  /**
   * Updates the data payload required to draw the time axis label.
   *
   * @param data - The {@link TimeAxisViewRendererData} containing the text, coordinate, and style.
   * @returns void
   */
  setData(data) {
    this._data = data;
  }
  /**
   * Draws the time axis label onto the chart's time scale area.
   *
   * This method calculates the label's required width, adjusts its final X-coordinate to ensure
   * it stays within the visible time scale bounds, and then draws the background, tick mark, and text.
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @param rendererOptions - The {@link TimeAxisViewRendererOptions} for styling and dimensions.
   * @returns void
   */
  draw(target, rendererOptions) {
    if (this._data === null || this._data.visible === false || this._data.text.length === 0) {
      return;
    }
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const pixelRatio = 1;
      ctx.font = rendererOptions.font;
      const textWidthCacheToUse = rendererOptions.widthCache || this._ensureFallbackTextWidthCache();
      const textWidth = Math.round(textWidthCacheToUse.measureText(ctx, this._data.text, optimizationReplacementRe));
      if (textWidth <= 0) {
        return;
      }
      const horzMargin = rendererOptions.paddingHorizontal;
      const labelWidth = textWidth + 2 * horzMargin;
      const labelWidthHalf = labelWidth / 2;
      const timeScaleWidth = this._data.width;
      let coordinate = this._data.coordinate;
      let x1 = Math.floor(coordinate - labelWidthHalf) + 0.5;
      const x2 = x1 + labelWidth;
      const y1 = 0;
      const y2 = y1 + rendererOptions.borderSize + rendererOptions.paddingTop + rendererOptions.fontSize + rendererOptions.paddingBottom;
      ctx.fillStyle = this._data.background;
      ctx.fillRect(Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1));
      if (this._data.tickVisible !== false) {
        const tickX = Math.round(this._data.coordinate);
        const tickTop = Math.round(y1);
        const tickBottom = Math.round(y2 + rendererOptions.tickLength);
        ctx.fillStyle = this._data.color;
        const tickWidth = 1;
        const tickOffset = 0.5;
        ctx.fillRect(tickX - tickOffset, tickTop, tickWidth, tickBottom - tickTop);
      }
      const yText = y2 - rendererOptions.baselineOffset - rendererOptions.paddingBottom;
      ctx.textAlign = "left";
      ctx.fillStyle = this._data.color;
      ctx.fillText(this._data.text, x1 + horzMargin, yText);
    });
  }
  /**
   * Calculates the total pixel height required to draw the label.
   *
   * This height includes font size, vertical padding, and border size.
   *
   * @param rendererOptions - The {@link TimeAxisViewRendererOptions} for dimensions.
   * @returns The calculated height in pixels.
   */
  height(rendererOptions) {
    return rendererOptions.borderSize + rendererOptions.paddingTop + rendererOptions.fontSize + rendererOptions.paddingBottom;
  }
  /**
   * Ensures a fallback {@link TextWidthCache} instance exists if one is not provided in `rendererOptions`.
   *
   * @returns The active {@link ITextWidthCache} instance.
   * @private
   */
  _ensureFallbackTextWidthCache() {
    if (this._fallbackTextWidthCache === null) {
      this._fallbackTextWidthCache = new TextWidthCache();
    }
    return this._fallbackTextWidthCache;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/views/crosshair-time-axis-label-view.ts
var CrosshairTimeAxisLabelView = class {
  /**
   * Initializes the crosshair time axis label view.
   * 
   * @param chart - The chart API instance for accessing options and formatting.
   */
  constructor(chart) {
    __publicField(this, "_chart");
    __publicField(this, "_timeScale");
    __publicField(this, "_renderer");
    // Internal state storage for the renderer
    __publicField(this, "_rendererData", {
      visible: false,
      background: "#4c525e",
      color: "white",
      text: "",
      width: 0,
      coordinate: 0,
      // Disable the vertical tick mark for the supplemental crosshair 
      // label to ensure it matches the native chart's clean aesthetic.
      tickVisible: false
    });
    __publicField(this, "_invalidated", true);
    this._chart = chart;
    this._timeScale = chart.timeScale();
    this._renderer = new TimeAxisViewRenderer();
  }
  /**
   * Updates the visual state of the supplemental label.
   * 
   * @param text - The formatted date/time string to display.
   * @param coordinate - The pixel X-coordinate where the label should be centered.
   * @param visible - Whether the supplemental label should be drawn.
   */
  updateState(text, coordinate, visible) {
    const data = this._rendererData;
    if (data.visible === visible && data.text === text && data.coordinate === coordinate) {
      return;
    }
    data.visible = visible;
    data.text = text;
    data.coordinate = coordinate;
    if (visible) {
      const chartOptions = this._chart.options();
      const backgroundColor = chartOptions.crosshair.vertLine.labelBackgroundColor;
      const colors = generateContrastColors(backgroundColor);
      data.background = colors.background;
      data.color = colors.foreground;
      data.width = this._timeScale.width();
    }
    this._invalidated = true;
  }
  /**
  * Defines the Z-Order for this specific view.
  * By returning 'top', we ensure the supplemental crosshair label sits 
  * above line tools and series data, matching the native crosshair behavior.
  */
  zOrder() {
    return "top";
  }
  /**
   * Implementation of ITimeAxisView. Returns the renderer.
   */
  getRenderer() {
    this._renderer.setData(this._rendererData);
    return this._renderer;
  }
  /**
   * Implementation of ITimeAxisView. Notifies the view that data is dirty.
   */
  update() {
    this._invalidated = true;
  }
  // #region ISeriesPrimitiveAxisView Requirements
  /**
   * Returns the current text content of the label.
   */
  text() {
    return this._rendererData.text;
  }
  /**
   * Returns the X-coordinate of the label.
   */
  coordinate() {
    return this._rendererData.coordinate;
  }
  /**
   * Returns the calculated text color.
   */
  textColor() {
    return this._rendererData.color;
  }
  /**
   * Returns the background color of the label tag.
   */
  backColor() {
    return this._rendererData.background;
  }
  /**
   * Returns whether the supplemental label is currently visible.
   */
  visible() {
    return this._rendererData.visible;
  }
  // #endregion
};

// vendor/difurious/lightweight-charts-line-tools-core/src/core-plugin.ts
var LineToolsCorePlugin = class {
  // Flag to block logic after destruction
  constructor(chart, series, horzScaleBehavior) {
    __publicField(this, "_chart");
    __publicField(this, "_series");
    __publicField(this, "_horzScaleBehavior");
    __publicField(this, "_tools", /* @__PURE__ */ new Map());
    __publicField(this, "_toolRegistry");
    __publicField(this, "_interactionManager");
    __publicField(this, "_priceAxisLabelStackingManager");
    __publicField(this, "_crosshairTimeView");
    __publicField(this, "_layoutSnapshot", null);
    /**
     * Optional user-provided function for formatting time axis labels.
     * @private
     */
    __publicField(this, "_customTimeFormatter", null);
    /**
     * The pixel tolerance for the magnetic snapping engine (0 = disabled).
     * This value acts as the global default for all line tools.
     * @private
     */
    __publicField(this, "_magnetThreshold", 0);
    // Delegates for broadcasting V3.8-compatible events
    __publicField(this, "_doubleClickDelegate", new Delegate());
    __publicField(this, "_afterEditDelegate", new Delegate());
    __publicField(this, "_selectSingleClickDelegate", new Delegate());
    // Throttled Stacking Update
    __publicField(this, "_stackingUpdateScheduled", false);
    __publicField(this, "_isDestroyed", false);
    this._chart = chart;
    this._series = series;
    this._horzScaleBehavior = horzScaleBehavior;
    this._toolRegistry = new ToolRegistry();
    this._interactionManager = new InteractionManager(this, this._chart, this._series, this._tools, this._toolRegistry);
    this._priceAxisLabelStackingManager = new PriceAxisLabelStackingManager(this._chart, this._series);
    this._crosshairTimeView = new CrosshairTimeAxisLabelView(this._chart);
    this._series.attachPrimitive(this);
    console.log("Line Tools Core Plugin initialized.");
  }
  /**
   * Retrieves a unified layout snapshot of the entire chart.
   * 
   * ### Performance
   * If the snapshot is less than 16ms old (approx. 1 frame), it returns the 
   * cached version. Otherwise, it performs a single, holistic measurement 
   * of all panes and dimensions.
   * 
   * @returns The current {@link ChartLayoutSnapshot}.
   */
  getLayout() {
    const now = performance.now();
    if (this._layoutSnapshot && now - this._layoutSnapshot.timestamp < 100) {
      return this._layoutSnapshot;
    }
    const chartElement = this._chart.chartElement();
    const chartRect = chartElement.getBoundingClientRect();
    const drawingWidth = this._chart.paneSize().width;
    const snapshot = {
      timestamp: now,
      width: drawingWidth,
      panes: []
    };
    try {
      const panes = this._chart.panes?.();
      if (panes) {
        panes.forEach((pane) => {
          const paneEl = pane.getHTMLElement?.();
          if (paneEl) {
            const rect = paneEl.getBoundingClientRect();
            snapshot.panes.push({
              paneApi: pane,
              top: rect.top - chartRect.top,
              height: paneEl.clientHeight,
              series: pane.getSeries?.() || []
            });
          }
        });
      }
    } catch (e) {
    }
    this._layoutSnapshot = snapshot;
    return snapshot;
  }
  /**
   * Requests a redraw of the chart.
   *
   * This method is the primary mechanism for internal components (like the {@link InteractionManager} or individual tools)
   * to trigger a render cycle after state changes (e.g., hovering, selecting, or modifying a tool).
   * It effectively calls `chart.applyOptions({})` to signal that the primitives need repainting.
   *
   * @internal
   * @returns void
   */
  requestUpdate() {
    this._chart.applyOptions({});
  }
  /**
   * Registers a custom line tool class with the plugin.
   *
   * Before a specific tool type (e.g., 'Rectangle', 'FibRetracement') can be created via
   * {@link addLineTool} or {@link importLineTools}, its class constructor must be registered here.
   * This maps a string identifier to the actual class implementation.
   *
   * @param type - The unique string identifier for the tool type (e.g., 'Rectangle').
   * @param toolClass - The class constructor for the tool, which must extend {@link BaseLineTool}.
   * @returns void
   *
   * @example
   * import { LineToolRectangle } from './my-tools/rectangle';
   * plugin.registerLineTool('Rectangle', LineToolRectangle);
   */
  registerLineTool(type, toolClass) {
    this._toolRegistry.registerTool(type, toolClass);
    console.log(`Registered line tool: ${type}`);
  }
  // #region ILineToolsApi Implementation
  /**
   * Adds a new line tool to the chart.
   *
   * If `points` is provided, the tool is drawn immediately at those coordinates.
   * If `points` is an empty array, `null`, or undefined, the plugin enters
   * **interactive creation mode**, allowing the user to click on the chart to draw the tool.
   *
   * @param type - The type of line tool to create (e.g., 'TrendLine', 'Rectangle').
   * @param points - An array of logical points (timestamp/price) to define the tool. Pass `[]` to start interactive drawing.
   * @param options - Optional configuration object to customize the tool's appearance (line color, width, etc.).
   * @returns The unique string ID of the newly created tool.
   *
   * @example
   * // Start drawing a Trend Line interactively (user clicks to place points)
   * plugin.addLineTool('TrendLine');
   *
   * @example
   * // Programmatically add a Rectangle at specific coordinates
   * plugin.addLineTool('Rectangle', [
   *   { timestamp: 1620000000, price: 100 },
   *   { timestamp: 1620086400, price: 120 }
   * ], {
   *   line: { color: '#ff0000', width: 2 },
   *   background: { color: 'rgba(255, 0, 0, 0.2)' }
   * });
   */
  addLineTool(type, points, options) {
    try {
      const initiateInteractive = points === null || points === void 0 || points.length === 0;
      const tool = this._createAndAddTool(type, points || [], options, void 0, initiateInteractive);
      return tool.id();
    } catch (e) {
      console.error(e.message);
      return "";
    }
  }
  /**
   * Creates a new line tool with a specific ID, or updates it if that ID already exists.
   *
   * Unlike `addLineTool`, this method requires a specific ID. It is primarily used for
   * state synchronization (e.g., `importLineTools`) where preserving the original tool ID is critical.
   *
   * @param type - The type of the line tool.
   * @param points - The points defining the tool.
   * @param options - The configuration options.
   * @param id - The unique ID to assign to the tool (or the ID of the tool to update).
   * @returns void
   */
  createOrUpdateLineTool(type, points, options, id) {
    const existingTool = this._tools.get(id);
    if (existingTool) {
      existingTool.setPoints(points);
      existingTool.applyOptions(options);
    } else {
      try {
        this._createAndAddTool(type, points, options, id);
      } catch (e) {
        console.error(e.message);
      }
    }
  }
  /**
   * Removes one or more line tools from the chart based on their unique IDs.
   *
   * @param ids - An array of unique string IDs representing the tools to remove.
   * @returns void
   *
   * @example
   * plugin.removeLineToolsById(['tool-id-1', 'tool-id-2']);
   */
  removeLineToolsById(ids) {
    let needsUpdate = false;
    ids.forEach((id) => {
      const tool = this._tools.get(id);
      if (tool) {
        this._interactionManager.detachTool(tool);
        tool.destroy();
        this._tools.delete(id);
        needsUpdate = true;
      }
    });
    if (needsUpdate) {
      this._chart.applyOptions({});
    }
  }
  /**
   * Removes all line tools whose IDs match the provided Regular Expression.
   *
   * This allows for bulk deletion of tools based on naming patterns (e.g., removing all tools tagged with 'temp-').
   *
   * @param regex - The Regular Expression to match against tool IDs.
   * @returns void
   *
   * @example
   * // Remove all tools starting with "drawing-"
   * plugin.removeLineToolsByIdRegex(/^drawing-/);
   */
  removeLineToolsByIdRegex(regex) {
    const idsToRemove = [];
    this._tools.forEach((tool) => {
      if (regex.test(tool.id())) {
        idsToRemove.push(tool.id());
      }
    });
    if (idsToRemove.length > 0) {
      this.removeLineToolsById(idsToRemove);
    }
  }
  /**
   * Removes the currently selected line tool(s) from the chart.
   *
   * This is typically wired to a keyboard shortcut (like the Delete key) or a UI button
   * to allow users to delete the specific tool they are interacting with.
   *
   * @returns void
   */
  removeSelectedLineTools() {
    const selectedIds = [];
    this._tools.forEach((tool) => {
      if (tool.isSelected()) {
        selectedIds.push(tool.id());
      }
    });
    if (selectedIds.length > 0) {
      this.removeLineToolsById(selectedIds);
    }
  }
  /**
   * Removes all line tools managed by this plugin from the chart.
   *
   * This performs a full cleanup, detaching every tool from the chart's series and
   * releasing associated resources.
   *
   * @returns void
   */
  removeAllLineTools() {
    const allIds = Array.from(this._tools.keys());
    if (allIds.length > 0) {
      this.removeLineToolsById(allIds);
    }
    console.log(`[CorePlugin] All tools removed. Final total tool count: ${this._tools.size}`);
  }
  /**
   * Retrieves the data for all line tools that are currently selected by the user.
   *
   * @returns A JSON string representing an array of the selected tools' data.
   *
   * @example
   * const selected = JSON.parse(plugin.getSelectedLineTools());
   * console.log(`User has selected ${selected.length} tools.`);
   */
  getSelectedLineTools() {
    const selectedTools = [];
    this._tools.forEach((tool) => {
      if (tool.isSelected()) {
        selectedTools.push(tool.getExportData());
      }
    });
    return JSON.stringify(selectedTools);
  }
  /**
   * Retrieves the data for a specific line tool by its unique ID.
   *
   * @param id - The unique identifier of the tool to retrieve.
   * @returns A JSON string representing an array containing the single tool's data, or an empty array `[]` if the ID was not found.
   *
   * @remarks
   * The return type is a JSON string to maintain compatibility with the V3.8 API structure.
   * You will typically need to `JSON.parse()` the result to work with the data programmatically.
   */
  getLineToolByID(id) {
    const tool = this._tools.get(id);
    return tool ? JSON.stringify([tool.getExportData()]) : JSON.stringify([]);
  }
  /**
   * Retrieves a list of line tools whose IDs match a specific Regular Expression.
   *
   * This is useful for grouping tools by naming convention (e.g., fetching all tools with IDs starting with 'trend-').
   *
   * @param regex - The Regular Expression to match against tool IDs.
   * @returns A JSON string representing an array of all matching line tools.
   *
   * @example
   * // Get all tools with IDs starting with "fib-"
   * const tools = plugin.getLineToolsByIdRegex(/^fib-/);
   */
  getLineToolsByIdRegex(regex) {
    const matchingTools = [];
    this._tools.forEach((tool) => {
      if (regex.test(tool.id())) {
        matchingTools.push(tool.getExportData());
      }
    });
    return JSON.stringify(matchingTools);
  }
  /**
   * Applies new configuration options or points to an existing line tool.
   *
   * This method is used to dynamically update a tool's appearance or position after it
   * has been created. It performs a partial merge, so you only need to provide the properties
   * you wish to change.
   *
   * Note: If the tool is currently selected, it will be deselected upon update to ensure visual consistency.
   *
   * @param toolData - An object containing the tool's `id`, `toolType`, and the `options` or `points` to update.
   * @returns `true` if the tool was found and updated, `false` otherwise (e.g., ID not found or type mismatch).
   *
   * @example
   * // Change the color of an existing tool to blue
   * plugin.applyLineToolOptions({
   *   id: 'existing-tool-id',
   *   toolType: 'TrendLine',
   *   options: {
   *     line: { color: 'blue' }
   *   },
   *   points: [] // Points can be omitted if not changing
   * });
   */
  applyLineToolOptions(toolData) {
    const tool = this._tools.get(toolData.id);
    if (!tool || tool.toolType !== toolData.toolType) {
      console.error(`Cannot apply options: Tool with ID "${toolData.id}" not found or type mismatch.`);
      return false;
    }
    if (tool.isSelected()) {
      tool.setSelected(false);
      this.fireSingleClickEvent(tool, "deselected");
    }
    if (toolData.options) {
      tool.applyOptions(toolData.options);
    }
    if (toolData.points) {
      const seriesOptions = this._series.options();
      const minMove = seriesOptions?.priceFormat?.minMove || 0.01;
      const sanitizedPoints = toolData.points.map((p) => ({
        ...p,
        price: roundPriceToStep(p.price, minMove)
      }));
      tool.setPoints(sanitizedPoints);
    }
    this._chart.applyOptions({});
    return true;
  }
  /**
   * Serializes the state of all currently drawn line tools into a JSON string.
   *
   * This export format is compatible with `importLineTools` and the V3.8 line tools plugin,
   * making it suitable for saving chart state to a database or local storage.
   *
   * @returns A JSON string representing an array of all line tools and their current state.
   *
   * @example
   * const savedState = plugin.exportLineTools();
   * localStorage.setItem('my-chart-tools', savedState);
   */
  exportLineTools() {
    const allToolsData = Array.from(this._tools.values()).map((tool) => tool.getExportData());
    console.log("Exporting all line tools:", allToolsData);
    return JSON.stringify(allToolsData);
  }
  /**
   * Imports a set of line tools from a JSON string.
   *
   * This method parses the provided JSON (typically generated by {@link exportLineTools}) and
   * creates or updates the tools on the chart.
   *
   * **Note:** This is a non-destructive import. It will not remove existing tools unless
   * the imported data overwrites them by ID. It creates new tools if the IDs do not exist
   * and updates existing ones if they do.
   *
   * @param json - A JSON string containing an array of line tool export data.
   * @returns `true` if the import process completed successfully, `false` if the JSON was invalid.
   */
  importLineTools(json) {
    try {
      const parsedTools = JSON.parse(json);
      if (!Array.isArray(parsedTools)) {
        throw new Error("Import data is not a valid array of line tools.");
      }
      parsedTools.forEach((toolData) => {
        this.createOrUpdateLineTool(toolData.toolType, toolData.points, toolData.options, toolData.id);
      });
      this.requestUpdate();
      return true;
    } catch (e) {
      console.error("Failed to import line tools:", e.message);
      return false;
    }
  }
  /**
   * Retrieves the series data rows within a specified time range.
   *
   * @param range - An object containing the 'from' and 'to' timestamps or date strings.
   * @returns An array of native series data objects (e.g., OHLC) found within the requested range.
   */
  getDataInRange(range) {
    const seriesData = this._series.data();
    if (seriesData.length === 0) return [];
    const fromKey = typeof range.from === "number" ? range.from : this._horzScaleBehavior.key(range.from);
    const toKey = typeof range.to === "number" ? range.to : this._horzScaleBehavior.key(range.to);
    const startIndex = this._findBarIndex(fromKey, "ceil");
    const endIndex = this._findBarIndex(toKey, "floor");
    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return [];
    return seriesData.slice(startIndex, endIndex + 1);
  }
  /**
   * Retrieves a single data row at a specific timestamp.
   *
   * @param time - The timestamp or business day string to look up.
   * @returns The data object if an exact match is found, otherwise `null`.
   */
  getBarAtTime(time) {
    const targetKey = typeof time === "number" ? time : this._horzScaleBehavior.key(time);
    const index = this._findBarIndex(targetKey, "exact");
    return index !== -1 ? this._series.dataByIndex(index, 0) : null;
  }
  /**
   * Finds the data row closest to a target timestamp based on the provided search mode.
   * Useful for cross-timeframe syncing (e.g., finding a 15m candle from a 1m timestamp).
   *
   * @param time - The target timestamp or business day string.
   * @param mode - The search strategy ('exact', 'floor', 'ceil', or 'nearest').
   * @returns The data object matching the criteria, or `null`.
   */
  getClosestBar(time, mode) {
    const targetKey = typeof time === "number" ? time : this._horzScaleBehavior.key(time);
    const index = this._findBarIndex(targetKey, mode);
    return index !== -1 ? this._series.dataByIndex(index, 0) : null;
  }
  /**
   * Retrieves the data row located at a specific pixel coordinate on the chart.
   *
   * @param x - The X-coordinate (in pixels) relative to the chart canvas.
   * @returns The data object corresponding to the bar under the coordinate, or `null`.
   */
  getBarAtCoordinate(x) {
    const timeScale = this._chart.timeScale();
    const logical = timeScale.coordinateToLogical(x);
    if (logical === null) return null;
    const time = timeScale.logicalToCoordinate(logical);
    return this._series.dataByIndex(Math.round(logical)) || null;
  }
  /**
   * Retrieves the first (earliest) data row currently loaded in the series.
   * 
   * ### Performance Note:
   * Uses $O(1)$ lookup via `dataByIndex` with `MismatchDirection.NearestRight` (1).
   * This completely avoids loading the series data array into memory, maintaining 144+ FPS.
   *
   * @returns The earliest data object, or `null` if the series is empty.
   */
  getEarliestBar() {
    return this._series.dataByIndex(-Number.MAX_SAFE_INTEGER, 1) || null;
  }
  /**
   * Retrieves the last (most recent) data row currently loaded in the series.
   * 
   * ### Performance Note:
   * Uses $O(1)$ lookup via `dataByIndex` with `MismatchDirection.NearestLeft` (-1).
   *
   * @returns The most recent data object, or `null` if the series is empty.
   */
  getLatestBar() {
    return this._series.dataByIndex(Number.MAX_SAFE_INTEGER, -1) || null;
  }
  /**
   * Retrieves the full time range covered by the currently loaded series data.
   * 
   * ### Performance Note:
   * Uses the optimized endpoint lookups to instantly determine the bounds 
   * without iterating or allocating the dataset.
   *
   * @returns An object with 'from' and 'to' timestamps, or `null` if the series is empty.
   */
  getFullTimeRange() {
    const firstBar = this.getEarliestBar();
    const lastBar = this.getLatestBar();
    if (!firstBar || !lastBar) return null;
    return {
      from: firstBar.time,
      to: lastBar.time
    };
  }
  /**
   * Subscribes a callback function to the "Double Click" event.
   *
   * This event fires whenever a user double-clicks on an existing line tool.
   * It is often used to open custom settings modals or perform specific actions on the tool.
   *
   * @param handler - The function to execute when the event fires. Receives {@link LineToolsDoubleClickEventParams}.
   * @returns void
   */
  subscribeLineToolsDoubleClick(handler) {
    this._doubleClickDelegate.subscribe(handler);
  }
  /**
   * Unsubscribes a previously registered callback from the "Double Click" event.
   *
   * @param handler - The specific callback function that was passed to {@link subscribeLineToolsDoubleClick}.
   * @returns void
   */
  unsubscribeLineToolsDoubleClick(handler) {
    this._doubleClickDelegate.unsubscribe(handler);
  }
  /**
   * Subscribes a callback function to the "After Edit" event.
   *
   * This event fires whenever a line tool is:
   * 1. Modified (points moved or properties changed).
   * 2. Finished creating (the final point was placed).
   *
   * @param handler - The function to execute when the event fires. Receives {@link LineToolsAfterEditEventParams}.
   * @returns void
   *
   * @example
   * plugin.subscribeLineToolsAfterEdit((params) => {
   *   console.log('Tool edited:', params.selectedLineTool.id);
   *   console.log('Edit stage:', params.stage);
   * });
   */
  subscribeLineToolsAfterEdit(handler) {
    this._afterEditDelegate.subscribe(handler);
  }
  /**
   * Unsubscribes a previously registered callback from the "After Edit" event.
   *
   * Use this to stop listening for tool creation or modification events, typically during
   * component cleanup or when the chart is being destroyed.
   *
   * @param handler - The specific callback function that was passed to {@link subscribeLineToolsAfterEdit}.
   * @returns void
   */
  unsubscribeLineToolsAfterEdit(handler) {
    this._afterEditDelegate.unsubscribe(handler);
  }
  /**
   * Subscribes a callback function to the "Single Click" selection event.
   * 
   * This event fires when a tool is selected or when the current selection is cleared.
   *
   * @param handler - The function to execute when the event fires. Receives {@link LineToolsSingleClickEventParams}.
   * @returns void
   */
  subscribeLineToolsSingleClick(handler) {
    this._selectSingleClickDelegate.subscribe(handler);
  }
  /**
   * Unsubscribes a previously registered callback from the "Single Click" selection event.
   *
   * @param handler - The specific callback function that was passed to {@link subscribeLineToolsSingleClick}.
   * @returns void
   */
  unsubscribeLineToolsSingleClick(handler) {
    this._selectSingleClickDelegate.unsubscribe(handler);
  }
  /**
   * Sets the crosshair position to a specific pixel coordinate (x, y) on the chart.
   *
   * @param x - The x-coordinate (in pixels).
   * @param y - The y-coordinate (in pixels).
   * @param visible - Controls the visibility.
   * @param providedTime - Optional. The logical time value.
   * @param providedPrice - Optional. The logical price value.
   * @returns void
   */
  setCrossHairXY(x, y, visible, providedTime, providedPrice) {
    if (!visible) {
      this.clearCrossHair();
      return;
    }
    const chart = this._chart;
    const mainSeries = this._series;
    if (providedTime !== void 0 && providedPrice !== void 0) {
      chart.setCrosshairPosition(
        providedPrice,
        providedTime,
        mainSeries
      );
      if (x !== null) {
        this._crosshairTimeView.update();
      }
      return;
    }
    if (x !== null && y !== null) {
      const lineToolPoint = this._interactionManager.screenPointToLineToolPoint(new Point(x, y));
      if (lineToolPoint) {
        const horizontalPosition = providedTime ? providedTime : lineToolPoint.timestamp;
        chart.setCrosshairPosition(
          lineToolPoint.price,
          horizontalPosition,
          mainSeries
        );
      } else {
        this.clearCrossHair();
      }
    }
  }
  /**
  * Clears the chart's crosshair, making it invisible.
  *
  * This acts as a proxy for the underlying Lightweight Charts API `clearCrosshairPosition()`.
  * Use this to programmatically hide the crosshair (e.g., when the mouse leaves a custom container).
  *
  * @returns void
  */
  /*
     public clearCrossHair(): void {
         this._chart.clearCrosshairPosition();
     }
  */
  clearCrossHair() {
    this._chart.clearCrosshairPosition();
    this._crosshairTimeView.updateState("", 0, false);
  }
  /**
   * Updates the state of the supplemental crosshair time axis label.
   * 
   * This is used internally by the InteractionManager to draw the crosshair 
   * label in the "blank space" where Lightweight Charts natively hides it.
   * 
   * @param text - The formatted time string.
   * @param x - The X coordinate in pixels.
   * @param visible - Whether the supplemental label should be shown.
   * @internal
   */
  updateCrosshairTimeLabel(text, x, visible) {
    this._crosshairTimeView.updateState(text, x, visible);
  }
  /**
   * Sets the magnet threshold in pixels for snapping to price data.
   * 
   * This value serves as the global default. Setting this will trigger a redraw 
   * to ensure any active ghost points or crosshairs immediate reflect the new 
   * snapping strength.
   *
   * @param pixels - The snapping tolerance in pixels.
   */
  setMagnetThreshold(pixels) {
    this._magnetThreshold = pixels;
    this.requestUpdate();
  }
  /**
   * Retrieves the current global magnet threshold.
   * 
   * This is used by the InteractionManager to determine the default 
   * snapping behavior when a tool does not provide its own override.
   * 
   * @internal
   * @returns The threshold in pixels.
   */
  getMagnetThreshold() {
    return this._magnetThreshold;
  }
  /**
   * Converts screen coordinates to logical time and price using the plugin's
   * internal interpolation and snapping engine.
   * 
   * @param x - Pixel X.
   * @param y - Pixel Y.
   * @returns The logical point.
   */
  getLogicalPoint(x, y) {
    return this._interactionManager.screenPointToLineToolPoint(new Point(x, y));
  }
  /**
   * Configures a custom formatter for the time labels.
   * 
   * [v1.1 MASTER SETTER]
   * This method acts as a synchronization proxy. It updates the chart's native 
   * localization while storing the formatter for the plugin's internal 
   * "Gap Repair" engine. By updating both, we ensure that the crosshair 
   * looks identical over data candles (handled by the chart) and in the 
   * blank space (handled by the plugin).
   * 
   * @param formatter - The formatting function, or null to revert to defaults.
   */
  setTimeFormatter(formatter) {
    this._customTimeFormatter = formatter;
    this._chart.applyOptions({
      localization: {
        timeFormatter: formatter
      }
    });
    this.requestUpdate();
  }
  /**
   * Retrieves the currently active custom time formatter.
   * 
   * @internal
   * @returns The formatter function, or `null` if none is set.
   */
  getTimeFormatter() {
    return this._customTimeFormatter;
  }
  /**
   * Sets the global interaction lock state for the plugin.
   * 
   * This implementation delegates the state management to the InteractionManager. 
   * If the chart is being locked, the manager will also handle the safety cleanup 
   * of any currently selected tools or active drawing gestures to ensure the 
   * UI doesn't get "stuck."
   * 
   * @param locked - `true` to disable all drawing and editing, `false` to restore interaction.
   */
  setLocked(locked) {
    this._interactionManager.setLocked(locked);
  }
  /**
   * Returns the current interaction lock state of the plugin.
   * 
   * @returns `true` if drawings are currently in read-only mode.
   */
  isLocked() {
    return this._interactionManager.isLocked();
  }
  /**
   * Completely destroys the line tools plugin instance and cleans up all associated memory.
   * 
   * This orchestrates a "Full Uninstall" sequence:
   * 1. Safely removes all active drawing tools and clears their individual states.
   * 2. Unbinds all internal mouse/keyboard event listeners in the Interaction Manager.
   * 3. Clears all event delegates to release user-provided callbacks from memory.
   * 4. Detaches the core plugin itself from the rendering engine.
   * 5. Transforms the instance into a no-op dummy by overwriting its own API methods.
   * 6. Severs all internal references to the chart and series to allow garbage collection.
   * 
   * @returns void
   */
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    console.log("[CorePlugin] Initiating logical destruction...");
    this._isDestroyed = true;
    this.removeAllLineTools();
    this._tools.clear();
    this._interactionManager.destroy();
    this._doubleClickDelegate.destroy();
    this._afterEditDelegate.destroy();
    this._selectSingleClickDelegate.destroy();
    try {
      this._series.detachPrimitive(this);
    } catch (e) {
    }
    const dummyApi = createDummyPluginApi();
    Object.keys(dummyApi).forEach((key) => {
      const member = dummyApi[key];
      if (typeof member === "function") {
        this[key] = member;
      }
    });
    this._chart = null;
    this._series = null;
    this._horzScaleBehavior = null;
    this._priceAxisLabelStackingManager = null;
    this._crosshairTimeView = null;
    this._customTimeFormatter = null;
    console.log("[CorePlugin] Plugin has been fully uninstalled and destroyed.");
  }
  // #endregion
  /**
   * Broadcasts an event indicating that a line tool has been double-clicked.
   *
   * This method is called internally by the {@link InteractionManager} upon detecting a double-click
   * interaction on a tool. It triggers listeners subscribed via {@link subscribeLineToolsDoubleClick}.
   *
   * @internal
   * @param tool - The tool instance that was double-clicked.
   * @returns void
   */
  fireDoubleClickEvent(tool) {
    const eventParams = {
      selectedLineTool: tool.getExportData()
    };
    this._doubleClickDelegate.fire(eventParams);
  }
  /**
   * Broadcasts an event indicating that a line tool's selection state has changed.
   * 
   * This method constructs a predictive payload where keys are always present,
   * but geometric and style data is set to null during a 'deselected' state 
   * to ensure the payload remains lightweight.
   *
   * @internal
   * @param tool - The tool instance whose state changed.
   * @param selectionState - The new state of the tool ('selected' or 'deselected').
   * @returns void
   */
  fireSingleClickEvent(tool, selectionState) {
    const eventParams = {
      selectionState,
      selectedLineTool: {
        id: tool.id(),
        toolType: tool.toolType,
        // Include points and options only if the tool is being selected
        points: selectionState === "selected" ? tool.points() : null,
        options: selectionState === "selected" ? tool.options() : null
      }
    };
    this._selectSingleClickDelegate.fire(eventParams);
  }
  /**
   * Broadcasts an event indicating that a line tool has been modified or created.
   *
   * This method is primarily called internally by the {@link InteractionManager} when a user
   * finishes drawing or editing a tool. It triggers any listeners subscribed via
   * {@link subscribeLineToolsAfterEdit}.
   *
   * @internal
   * @param tool - The tool instance that was edited.
   * @param stage - The stage of the edit action (e.g., 'lineToolEdited' for modification, 'lineToolFinished' for creation).
   * @returns void
   */
  fireAfterEditEvent(tool, stage) {
    const eventParams = {
      selectedLineTool: tool.getExportData(),
      stage
    };
    this._afterEditDelegate.fire(eventParams);
  }
  /**
   * Retrieves the instance of the Price Axis Label Stacking Manager.
   *
   * This manager is responsible for preventing overlap between the price labels of different tools
   * on the Y-axis. This accessor is primarily used internally by {@link BaseLineTool} to register its labels.
   *
   * @internal
   * @returns The shared {@link PriceAxisLabelStackingManager} instance.
   */
  getPriceAxisLabelStackingManager() {
    return this._priceAxisLabelStackingManager;
  }
  /**
   * Implementation of ISeriesPrimitive. Returns the views for the time axis.
   */
  timeAxisViews() {
    return [this._crosshairTimeView];
  }
  /**
  * Optional Z-Order implementation for the plugin primitive.
  * This ensures our injected crosshair label stays on the topmost layer.
  */
  zOrder() {
    return "top";
  }
  /**
   * Implementation of ISeriesPrimitive. We don't render anything on the price axis for the core itself.
   */
  priceAxisViews() {
    return [];
  }
  /**
   * Implementation of ISeriesPrimitive. We don't render anything on the main pane.
   */
  paneViews() {
    return [];
  }
  /**
   * Implementation of ISeriesPrimitive. The core itself does not capture mouse hits.
   */
  hitTest() {
    return null;
  }
  /**
   * Implementation of ISeriesPrimitive. Triggers when attached to a series.
   */
  attached(param) {
  }
  /**
   * Implementation of ISeriesPrimitive. Triggers when detached.
   */
  detached() {
  }
  /**
   * Implementation of ISeriesPrimitive. Signals that views need updating.
   */
  updateAllViews() {
    this._crosshairTimeView.update();
  }
  /**
   * Internal factory method to instantiate and register a new tool.
   *
   * This handles the common logic for `addLineTool`, `createOrUpdateLineTool`, and `importLineTools`,
   * including checking the registry, creating the instance, attaching it to the series, and
   * managing interactive state if required.
   *
   * @param type - The tool type identifier.
   * @param points - The initial points for the tool.
   * @param options - Optional configuration options.
   * @param id - Optional specific ID (if not provided, the tool generates its own).
   * @param initiateInteractive - If `true`, sets the tool to "Creating" mode and updates the InteractionManager.
   * @returns The newly created `BaseLineTool` instance.
   * @throws Error if the tool type is not registered.
   * @private
   */
  _createAndAddTool(type, points, options, id, initiateInteractive = false) {
    if (!this._toolRegistry.isRegistered(type)) {
      throw new Error(`Cannot create tool: Line tool type "${type}" is not registered.`);
    }
    if (initiateInteractive) {
      this._interactionManager.deselectAllTools();
    }
    const ToolClass = this._toolRegistry.getToolClass(type);
    const seriesOptions = this._series.options();
    const minMove = seriesOptions?.priceFormat?.minMove || 0.01;
    const sanitizedPoints = points.map((p) => ({
      ...p,
      price: roundPriceToStep(p.price, minMove)
    }));
    const newTool = new ToolClass(
      this,
      this._chart,
      this._series,
      this._horzScaleBehavior,
      options,
      sanitizedPoints,
      // Pass sanitized array instead of raw points
      this._priceAxisLabelStackingManager
    );
    if (id) {
      newTool.setId(id);
    }
    this._tools.set(newTool.id(), newTool);
    this._series.attachPrimitive(newTool);
    if (initiateInteractive) {
      newTool.setCreating(true);
      this._interactionManager.setCurrentToolCreating(newTool);
    }
    this._chart.applyOptions({});
    return newTool;
  }
  /**
   * Core Binary Search Engine: Finds the index of a bar based on its timestamp key.
   * 
   * Supports optimized lookup modes for crosshair synchronization and range fetching.
   * Time complexity: O(log n)
   *
   * @private
   * @param targetKey - The numeric timestamp key to search for.
   * @param mode - The search mode ('exact', 'floor', 'ceil', or 'nearest').
   * @returns The index of the matching bar in the series data array, or -1 if not found.
   */
  _findBarIndex(targetKey, mode) {
    const lastBar = this.getLatestBar();
    if (!lastBar) return -1;
    const timeScale = this._chart.timeScale();
    const lastLogical = timeScale.coordinateToLogical(timeScale.timeToCoordinate(lastBar.time));
    if (lastLogical === null) return -1;
    let low = 0;
    let high = Math.round(lastLogical);
    let lastValidIndex = -1;
    while (low <= high) {
      const mid = low + high >> 1;
      const midBar = this._series.dataByIndex(mid, 0);
      if (!midBar) break;
      const midKey = this._horzScaleBehavior.key(midBar.time);
      if (midKey === targetKey) return mid;
      if (midKey < targetKey) {
        if (mode === "floor" || mode === "nearest") lastValidIndex = mid;
        low = mid + 1;
      } else {
        if (mode === "ceil" || mode === "nearest") lastValidIndex = mid;
        high = mid - 1;
      }
    }
    if (mode === "exact" || lastValidIndex === -1) return -1;
    if (mode === "nearest") {
      const bar1 = this._series.dataByIndex(lastValidIndex, 0);
      if (bar1) {
        const k1 = this._horzScaleBehavior.key(bar1.time);
        const otherIndex = k1 < targetKey ? lastValidIndex + 1 : lastValidIndex - 1;
        const bar2 = this._series.dataByIndex(otherIndex, 0);
        if (bar2) {
          const k2 = this._horzScaleBehavior.key(bar2.time);
          if (Math.abs(targetKey - k2) < Math.abs(targetKey - k1)) {
            return otherIndex;
          }
        }
      }
    }
    return lastValidIndex;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/utils/canvas-helpers.ts
import { LineStyle } from "lightweight-charts";
function computeDashPattern(ctx, style) {
  const width = ctx.lineWidth;
  const isCapped = ctx.lineCap !== "butt";
  const capExtra = isCapped ? width : 0;
  let dash;
  let gap;
  switch (style) {
    case 1:
      dash = width === 1 ? 1 : width;
      gap = width === 1 ? 2 : width;
      break;
    case 2:
      dash = width === 1 ? 4 : 2 * width;
      gap = width === 1 ? 3 : 2 * width;
      break;
    case 3:
      dash = width === 1 ? 8 : 6 * width;
      gap = width === 1 ? 4 : 6 * width;
      break;
    case 4:
      dash = width === 1 ? 1 : width;
      gap = width === 1 ? 8 : 4 * width;
      break;
    case 0:
    // LineStyle.Solid
    default:
      return [];
  }
  return [Math.max(0.1, dash - capExtra), gap + capExtra];
}
function setLineDash(ctx, dashPattern) {
  if (ctx.setLineDash) {
    ctx.setLineDash(dashPattern);
  } else {
    ctx.mozDash = dashPattern;
    ctx.webkitLineDash = dashPattern;
  }
}
function setLineStyle(ctx, style) {
  ctx.lineDashOffset = 0;
  const dashPattern = computeDashPattern(ctx, style);
  setLineDash(ctx, dashPattern);
}
function computeEndLineSize(lineWidth) {
  switch (lineWidth) {
    case 1:
      return 3.5;
    case 2:
      return 2;
    case 3:
      return 1.5;
    case 4:
      return 1.25;
    default:
      return 1;
  }
}
function drawHorizontalLine(ctx, y, left, right) {
  ctx.beginPath();
  const correction = ctx.lineWidth % 2 ? 0.5 : 0;
  ctx.moveTo(left, y + correction);
  ctx.lineTo(right, y + correction);
  ctx.stroke();
}
function drawVerticalLine(ctx, x, top, bottom) {
  ctx.beginPath();
  const correction = ctx.lineWidth % 2 ? 0.5 : 0;
  ctx.moveTo(x + correction, top);
  ctx.lineTo(x + correction, bottom);
  ctx.stroke();
}
function drawLine(ctx, x1, y1, x2, y2, style) {
  if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
    return;
  }
  if (style !== LineStyle.Solid) {
    drawDashedLine(ctx, x1, y1, x2, y2, style);
  } else {
    drawSolidLine(ctx, x1, y1, x2, y2);
  }
}
function drawSolidLine(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function drawDashedLine(ctx, x1, y1, x2, y2, style) {
  ctx.save();
  ctx.beginPath();
  setLineStyle(ctx, style);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
function drawCircleEnd(point, ctx, width) {
  const circleEndMultiplier = computeEndLineSize(width);
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(point.x, point.y, width * circleEndMultiplier, 0, 2 * Math.PI, false);
  ctx.fill();
  ctx.restore();
}
function getArrowPoints(point0, point1, width) {
  const r = 0.5 * width;
  const n = Math.sqrt(2);
  const o = point1.subtract(point0);
  const a = o.normalized();
  const arrowheadMultiplier = computeEndLineSize(width);
  const l = 5 * width * arrowheadMultiplier;
  const c = 1 * r;
  if (o.length() < l * 0.1) {
    return [];
  }
  const h = a.scaled(l);
  const d = point1.subtract(h);
  const u = a.transposed();
  const p = 1 * l;
  const z = u.scaled(p);
  const m = d.add(z);
  const g = d.subtract(z);
  const f = m.subtract(point1).normalized().scaled(c);
  const v = g.subtract(point1).normalized().scaled(c);
  const S = point1.add(f);
  const y = point1.add(v);
  const b_val = r * (n - 1);
  const w = u.scaled(b_val);
  const C_val = Math.min(l - r / n, r * n * 1);
  const P = a.scaled(C_val);
  const T = point1.subtract(P).subtract(w);
  const x_val = point1.subtract(P).add(w);
  return [[m, S], [g, y], [T, x_val]];
}
function drawArrowEnd(point0, point1, ctx, width, style) {
  if (point1.subtract(point0).length() < 1) {
    return;
  }
  const arrowPoints = getArrowPoints(point0, point1, width);
  for (const segment of arrowPoints) {
    drawLine(ctx, segment[0].x, segment[0].y, segment[1].x, segment[1].y, style);
  }
}
function drawPathRoundRect(ctx, x, y, w, h, radii) {
  ctx.beginPath();
  ctx.moveTo(x + radii[0], y);
  ctx.lineTo(x + w - radii[1], y);
  if (radii[1] !== 0) {
    ctx.arcTo(x + w, y, x + w, y + radii[1], radii[1]);
  }
  ctx.lineTo(x + w, y + h - radii[2]);
  if (radii[2] !== 0) {
    ctx.arcTo(x + w, y + h, x + w - radii[2], y + h, radii[2]);
  }
  ctx.lineTo(x + radii[3], y + h);
  if (radii[3] !== 0) {
    ctx.arcTo(x, y + h, x, y + h - radii[3], radii[3]);
  }
  ctx.lineTo(x, y + radii[0]);
  if (radii[0] !== 0) {
    ctx.arcTo(x, y, x + radii[0], y, radii[0]);
  }
  ctx.closePath();
}
function drawRoundRect(ctx, x, y, width, height, radius, borderStyle) {
  let r;
  if (Array.isArray(radius)) {
    if (radius.length === 2) {
      r = [radius[0], radius[1], radius[0], radius[1]];
    } else if (radius.length === 4) {
      r = radius;
    } else {
      console.warn("Invalid radius array length. Expected 1, 2, or 4 elements. Defaulting to 0.");
      r = [0, 0, 0, 0];
    }
  } else {
    r = [radius, radius, radius, radius];
  }
  drawPathRoundRect(ctx, x, y, width, height, r);
  setLineStyle(ctx, borderStyle);
  ctx.stroke();
}
function fillRectWithBorder(ctx, point0, point1, backgroundColor, borderColor, borderWidth = 0, borderStyle, radius, borderAlign, extendLeft, extendRight, containerWidth) {
  const minX = Math.min(point0.x, point1.x);
  const maxX = Math.max(point0.x, point1.x);
  const minY = Math.min(point0.y, point1.y);
  const maxY = Math.max(point0.y, point1.y);
  const x1 = extendLeft ? 0 : minX;
  const x2 = extendRight ? containerWidth : maxX;
  const y1 = minY;
  const width = x2 - x1;
  const height = maxY - minY;
  let fillRadii;
  if (Array.isArray(radius)) {
    if (radius.length === 2) {
      fillRadii = [radius[0], radius[1], radius[0], radius[1]];
    } else if (radius.length === 4) {
      fillRadii = radius;
    } else {
      fillRadii = [0, 0, 0, 0];
    }
  } else {
    fillRadii = [radius, radius, radius, radius];
  }
  if (backgroundColor !== void 0) {
    ctx.fillStyle = backgroundColor;
    drawPathRoundRect(ctx, x1, y1, width, height, fillRadii);
    ctx.fill();
  }
  if (borderColor !== void 0 && borderWidth > 0) {
    setLineStyle(ctx, borderStyle || LineStyle.Solid);
    let offsetLeft = 0;
    let offsetRight = 0;
    let offsetTop = 0;
    let offsetBottom = 0;
    switch (borderAlign) {
      case "outer":
        offsetLeft = -borderWidth / 2;
        offsetRight = borderWidth / 2;
        offsetTop = -borderWidth / 2;
        offsetBottom = borderWidth / 2;
        break;
      case "center":
        offsetLeft = -borderWidth / 2;
        offsetRight = borderWidth / 2;
        offsetTop = -borderWidth / 2;
        offsetBottom = borderWidth / 2;
        break;
      case "inner":
        offsetLeft = borderWidth / 2;
        offsetRight = -borderWidth / 2;
        offsetTop = borderWidth / 2;
        offsetBottom = -borderWidth / 2;
        break;
    }
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = borderColor;
    drawPathRoundRect(ctx, x1 + offsetLeft, y1 + offsetTop, width - offsetLeft + offsetRight, height - offsetTop + offsetBottom, fillRadii);
    ctx.stroke();
  }
}

// vendor/difurious/lightweight-charts-line-tools-core/src/utils/text-helpers.ts
var MINIMUM_PADDING_PIXELS = 5;
var cacheCanvas = null;
function createCacheCanvas() {
  if (cacheCanvas === null) {
    const canvas = document.createElement("canvas");
    canvas.width = 0;
    canvas.height = 0;
    cacheCanvas = ensureNotNull(canvas.getContext("2d"));
  }
}
function getBoxWidth(data, maxLineWidth) {
  return maxLineWidth + 2 * getScaledBackgroundInflationX(data) + 2 * getScaledBoxPaddingX(data);
}
function getBoxHeight(data, linesCount) {
  const scaledFontSize = getScaledFontSize(data);
  const scaledPadding = getScaledPadding(data);
  return scaledFontSize * linesCount + scaledPadding * (linesCount - 1) + 2 * getScaledBackgroundInflationY(data) + 2 * getScaledBoxPaddingY(data);
}
function getScaledBoxPaddingY(data) {
  const userDefinedPadding = data.text?.box?.padding?.y || 0;
  const scaledUserPadding = userDefinedPadding * getFontAwareScale(data);
  return scaledUserPadding + MINIMUM_PADDING_PIXELS;
}
function getScaledBoxPaddingX(data) {
  const userDefinedPadding = data.text?.box?.padding?.x || 0;
  const scaledUserPadding = userDefinedPadding * getFontAwareScale(data);
  return scaledUserPadding + MINIMUM_PADDING_PIXELS;
}
function getScaledBackgroundInflationY(data) {
  return (data.text?.box?.background?.inflation?.y || 0) * getFontAwareScale(data);
}
function getScaledBackgroundInflationX(data) {
  return (data.text?.box?.background?.inflation?.x || 0) * getFontAwareScale(data);
}
function getScaledPadding(data) {
  return (data.text?.padding || 0) * getFontAwareScale(data);
}
function getScaledFontSize(data) {
  return Math.ceil(getFontSize(data) * getFontAwareScale(data));
}
function getFontSize(data) {
  return data.text?.font?.size || 30;
}
function getFontAwareScale(data) {
  const scale = Math.max(0.01, data.text?.box?.scale || 1);
  if (scale === 1) {
    return scale;
  }
  const fontSize = getFontSize(data);
  return Math.ceil(scale * fontSize) / fontSize;
}
function isRtl() {
  return typeof window !== "undefined" && "rtl" === window.document.dir;
}
function textWrap(text, font, lineWrapWidth) {
  createCacheCanvas();
  const ctx = ensureNotNull(cacheCanvas);
  let wrapWidthNum;
  if (typeof lineWrapWidth === "string") {
    wrapWidthNum = parseInt(lineWrapWidth);
  } else if (typeof lineWrapWidth === "number") {
    wrapWidthNum = lineWrapWidth;
  } else {
    wrapWidthNum = 0;
  }
  text += "";
  const lines = !Number.isInteger(wrapWidthNum) || !isFinite(wrapWidthNum) || wrapWidthNum <= 0 ? text.split(/\r\n|\r|\n|$/) : text.split(/[^\S\r\n]*(?:\r\n|\r|\n|$)/);
  if (lines.length > 0 && !lines[lines.length - 1]) {
    lines.pop();
  }
  if (!Number.isInteger(wrapWidthNum) || !isFinite(wrapWidthNum) || wrapWidthNum <= 0) {
    return lines;
  }
  ctx.font = font;
  const wrappedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line2 = lines[i];
    const lineWidth = ctx.measureText(line2).width;
    if (lineWidth <= wrapWidthNum) {
      wrappedLines.push(line2);
      continue;
    }
    const splitWordsAndSeparators = line2.split(/([-)\]},.!?:;])|(\s+)/);
    const currentLineWords = [];
    let currentLineWidth = 0;
    for (let j = 0; j < splitWordsAndSeparators.length; j++) {
      const segment = splitWordsAndSeparators[j];
      if (segment === void 0 || segment === "") continue;
      const segmentWidth = ctx.measureText(segment).width;
      if (currentLineWidth + segmentWidth <= wrapWidthNum) {
        currentLineWords.push(segment);
        currentLineWidth += segmentWidth;
      } else {
        if (currentLineWords.length > 0) {
          wrappedLines.push(currentLineWords.join(""));
          currentLineWords.length = 0;
          currentLineWidth = 0;
        }
        if (segmentWidth > wrapWidthNum) {
          let tempWord = "";
          for (let k = 0; k < segment.length; k++) {
            const char = segment[k];
            const charWidth = ctx.measureText(char).width;
            if (currentLineWidth + charWidth <= wrapWidthNum) {
              tempWord += char;
              currentLineWidth += charWidth;
            } else {
              if (tempWord.length > 0) {
                wrappedLines.push(tempWord);
              }
              tempWord = char;
              currentLineWidth = charWidth;
            }
          }
          if (tempWord.length > 0) {
            currentLineWords.push(tempWord);
            currentLineWidth = ctx.measureText(tempWord).width;
          }
        } else {
          currentLineWords.push(segment);
          currentLineWidth += segmentWidth;
        }
      }
    }
    if (currentLineWords.length > 0) {
      wrappedLines.push(currentLineWords.join(""));
    }
  }
  return wrappedLines;
}
function isFullyTransparent(color) {
  if (typeof color !== "string") {
    return false;
  }
  color = color.toLowerCase().trim();
  if (color === "transparent") {
    return true;
  }
  const alphaRegex = /(?:rgba|hsla)\((?:\s*\d+\s*,){3}\s*(\d*\.?\d+)\s*\)/;
  const match = color.match(alphaRegex);
  if (match && match[1]) {
    const alpha = parseFloat(match[1]);
    return alpha === 0;
  }
  return false;
}

// vendor/difurious/lightweight-charts-line-tools-core/src/utils/culling-helpers.ts
function getToolBoundingBox(points) {
  if (points.length === 0) return null;
  let minTime = points[0].timestamp;
  let maxTime = points[0].timestamp;
  let minPrice = points[0].price;
  let maxPrice = points[0].price;
  for (const point of points) {
    minTime = Math.min(minTime, point.timestamp);
    maxTime = Math.max(maxTime, point.timestamp);
    minPrice = Math.min(minPrice, point.price);
    maxPrice = Math.max(maxPrice, point.price);
  }
  return { minTime, maxTime, minPrice, maxPrice };
}
function getViewportBounds(tool) {
  try {
    const chart = tool.getChart();
    const series = tool.getSeries();
    const timeScale = chart.timeScale();
    const priceRangeResult = getExtendedVisiblePriceRange(tool);
    if (!priceRangeResult || priceRangeResult.from === null || priceRangeResult.to === null) {
      return null;
    }
    const logicalRange = timeScale.getVisibleLogicalRange();
    if (!logicalRange) {
      return null;
    }
    const BUFFER = 1;
    const leftLogical = logicalRange.from - BUFFER;
    const rightLogical = logicalRange.to + BUFFER;
    const rawMinTime = interpolateTimeFromLogicalIndex(chart, series, leftLogical);
    const rawMaxTime = interpolateTimeFromLogicalIndex(chart, series, rightLogical);
    if (rawMinTime === null || rawMaxTime === null) {
      return null;
    }
    const minTimeNum = Number(rawMinTime);
    const maxTimeNum = Number(rawMaxTime);
    let minTime = Math.ceil(minTimeNum);
    let maxTime = Math.floor(maxTimeNum);
    if (minTime >= maxTime) {
      maxTime = minTime + 1;
    }
    const minPriceRaw = Math.min(priceRangeResult.from, priceRangeResult.to);
    const maxPriceRaw = Math.max(priceRangeResult.from, priceRangeResult.to);
    const viewportBounds = {
      minTime,
      maxTime,
      minPrice: minPriceRaw,
      maxPrice: maxPriceRaw
    };
    return viewportBounds;
  } catch (e) {
    return null;
  }
}
function getCullingStateWithExtensions(points, viewportBounds, extendOptions) {
  const timeDegenerate = viewportBounds.minTime === viewportBounds.maxTime;
  let p1;
  let p2;
  const origP0 = points[0];
  const origP1 = points[1];
  if (points[0].timestamp > points[1].timestamp) {
    p1 = points[1];
    p2 = points[0];
  } else {
    p1 = points[0];
    p2 = points[1];
  }
  const [t_enter, t_exit] = calculateInfiniteLineClip(p1, p2, viewportBounds);
  if (t_enter > t_exit) {
    const toolBounds2 = getToolBoundingBox(points);
    if (toolBounds2.minPrice > viewportBounds.maxPrice) {
      return "top" /* OffScreenTop */;
    }
    if (toolBounds2.maxPrice < viewportBounds.minPrice) {
      return "bottom" /* OffScreenBottom */;
    }
    if (toolBounds2.maxTime < viewportBounds.minTime) {
      return "left" /* OffScreenLeft */;
    }
    if (toolBounds2.minTime > viewportBounds.maxTime) {
      return "right" /* OffScreenRight */;
    }
    return "fullyOffScreen" /* FullyOffScreen */;
  } else {
  }
  const t_start = extendOptions.left ? -Infinity : 0;
  const t_end = extendOptions.right ? Infinity : 1;
  const overlap_start = Math.max(t_start, t_enter);
  const overlap_end = Math.min(t_end, t_exit);
  if (overlap_start <= overlap_end) {
    return "visible" /* Visible */;
  } else {
  }
  const toolBounds = getToolBoundingBox(points);
  if (toolBounds.minPrice > viewportBounds.maxPrice) {
    return "top" /* OffScreenTop */;
  }
  if (toolBounds.maxPrice < viewportBounds.minPrice) {
    return "bottom" /* OffScreenBottom */;
  }
  if (toolBounds.maxTime < viewportBounds.minTime) {
    return "left" /* OffScreenLeft */;
  }
  if (toolBounds.minTime > viewportBounds.maxTime) {
    return "right" /* OffScreenRight */;
  }
  return "fullyOffScreen" /* FullyOffScreen */;
}
function calculateInfiniteLineClip(p1, p2, viewport) {
  const timeDegenerate = viewport.minTime === viewport.maxTime;
  const dx = p2.timestamp - p1.timestamp;
  const dy = p2.price - p1.price;
  let t_enter = -Infinity;
  let t_exit = Infinity;
  if (dx === 0) {
    if (p1.timestamp < viewport.minTime || p1.timestamp > viewport.maxTime) {
      return [Infinity, -Infinity];
    }
  } else {
    if (timeDegenerate) {
      const t_single = (viewport.minTime - p1.timestamp) / dx;
      t_enter = Math.max(t_enter, t_single);
      t_exit = Math.min(t_exit, t_single);
    } else {
      let t1 = (viewport.minTime - p1.timestamp) / dx;
      let t2 = (viewport.maxTime - p1.timestamp) / dx;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
      }
      t_enter = Math.max(t_enter, t1);
      t_exit = Math.min(t_exit, t2);
    }
  }
  if (dy === 0) {
    if (p1.price < viewport.minPrice || p1.price > viewport.maxPrice) {
      return [Infinity, -Infinity];
    }
  } else {
    let t1 = (viewport.minPrice - p1.price) / dy;
    let t2 = (viewport.maxPrice - p1.price) / dy;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }
    t_enter = Math.max(t_enter, t1);
    t_exit = Math.min(t_exit, t2);
  }
  if (t_enter > t_exit) {
    return [Infinity, -Infinity];
  }
  return [t_enter, t_exit];
}
function getToolCullingState(points, tool, extendOptions, singlePointOrientation, cullingInfo, isAreaBased = false) {
  if (points.length === 0) {
    return "fullyOffScreen" /* FullyOffScreen */;
  }
  const viewportBounds = getViewportBounds(tool);
  if (!viewportBounds) {
    return "visible" /* Visible */;
  }
  if (isAreaBased) {
    const toolBounds2 = getToolBoundingBox(points);
    if (!toolBounds2) return "fullyOffScreen" /* FullyOffScreen */;
    const toolMinT = extendOptions?.left ? -Infinity : toolBounds2.minTime;
    const toolMaxT = extendOptions?.right ? Infinity : toolBounds2.maxTime;
    const overlapsTime = viewportBounds.maxTime >= toolMinT && viewportBounds.minTime <= toolMaxT;
    const overlapsPrice = viewportBounds.maxPrice >= toolBounds2.minPrice && viewportBounds.minPrice <= toolBounds2.maxPrice;
    if (overlapsTime && overlapsPrice) {
      return "visible" /* Visible */;
    }
    if (toolBounds2.minPrice > viewportBounds.maxPrice) return "top" /* OffScreenTop */;
    if (toolBounds2.maxPrice < viewportBounds.minPrice) return "bottom" /* OffScreenBottom */;
    if (toolMaxT < viewportBounds.minTime) return "left" /* OffScreenLeft */;
    if (toolMinT > viewportBounds.maxTime) return "right" /* OffScreenRight */;
    return "fullyOffScreen" /* FullyOffScreen */;
  }
  const hasExtensions = extendOptions && (extendOptions.left || extendOptions.right);
  const callTwoPointCuller = (pA, pB, extend) => {
    return getCullingStateWithExtensions([pA, pB], viewportBounds, extend);
  };
  if (points.length >= 3 && cullingInfo?.subSegments && extendOptions) {
    let isAnySegmentVisible = false;
    for (const [indexA, indexB] of cullingInfo.subSegments) {
      if (points[indexA] && points[indexB]) {
        if (callTwoPointCuller(points[indexA], points[indexB], extendOptions) === "visible" /* Visible */) {
          isAnySegmentVisible = true;
          break;
        }
      }
    }
    if (isAnySegmentVisible) {
      return "visible" /* Visible */;
    } else {
      return "fullyOffScreen" /* FullyOffScreen */;
    }
  }
  if (points.length === 1) {
    const p = points[0];
    const isLeftActive = extendOptions?.left ?? false;
    const isRightActive = extendOptions?.right ?? false;
    const orientation = singlePointOrientation;
    const isHorizontalLineActive = hasExtensions && (orientation?.horizontal ?? false);
    const isVerticalLineActive = hasExtensions && (orientation?.vertical ?? false);
    if (!isHorizontalLineActive && !isVerticalLineActive) {
      if (p.timestamp >= viewportBounds.minTime && p.timestamp <= viewportBounds.maxTime && p.price >= viewportBounds.minPrice && p.price <= viewportBounds.maxPrice) {
        return "visible" /* Visible */;
      }
      if (p.price > viewportBounds.maxPrice) return "top" /* OffScreenTop */;
      if (p.price < viewportBounds.minPrice) return "bottom" /* OffScreenBottom */;
      if (p.timestamp < viewportBounds.minTime) return "left" /* OffScreenLeft */;
      if (p.timestamp > viewportBounds.maxTime) return "right" /* OffScreenRight */;
      return "fullyOffScreen" /* FullyOffScreen */;
    }
    let isToolVisible = false;
    if (isHorizontalLineActive) {
      const isAlignedVertically = p.price >= viewportBounds.minPrice && p.price <= viewportBounds.maxPrice;
      if (isAlignedVertically) {
        if (isLeftActive && p.timestamp >= viewportBounds.minTime) {
          isToolVisible = true;
        }
        if (isRightActive && p.timestamp <= viewportBounds.maxTime) {
          isToolVisible = true;
        }
      }
    }
    if (isVerticalLineActive) {
      const isAlignedHorizontally = p.timestamp >= viewportBounds.minTime && p.timestamp <= viewportBounds.maxTime;
      if (isAlignedHorizontally) {
        isToolVisible = true;
      }
    }
    if (isToolVisible) {
      return "visible" /* Visible */;
    }
    if (p.price > viewportBounds.maxPrice) return "top" /* OffScreenTop */;
    if (p.price < viewportBounds.minPrice) return "bottom" /* OffScreenBottom */;
    if (p.timestamp < viewportBounds.minTime) return "left" /* OffScreenLeft */;
    if (p.timestamp > viewportBounds.maxTime) return "right" /* OffScreenRight */;
    return "fullyOffScreen" /* FullyOffScreen */;
  }
  if (points.length === 2) {
    if (!hasExtensions) {
      const toolBounds2 = getToolBoundingBox(points);
      if (!toolBounds2) return "visible" /* Visible */;
      if (toolBounds2.minPrice > viewportBounds.maxPrice) return "top" /* OffScreenTop */;
      if (toolBounds2.maxPrice < viewportBounds.minPrice) return "bottom" /* OffScreenBottom */;
      if (toolBounds2.maxTime < viewportBounds.minTime) return "left" /* OffScreenLeft */;
      if (toolBounds2.minTime > viewportBounds.maxTime) return "right" /* OffScreenRight */;
      return "visible" /* Visible */;
    }
    return callTwoPointCuller(points[0], points[1], extendOptions);
  }
  const toolBounds = getToolBoundingBox(points);
  if (!toolBounds) return "visible" /* Visible */;
  if (toolBounds.minPrice > viewportBounds.maxPrice) return "top" /* OffScreenTop */;
  if (toolBounds.maxPrice < viewportBounds.minPrice) return "bottom" /* OffScreenBottom */;
  if (toolBounds.maxTime < viewportBounds.minTime) return "left" /* OffScreenLeft */;
  if (toolBounds.minTime > viewportBounds.maxTime) return "right" /* OffScreenRight */;
  return "visible" /* Visible */;
}

// vendor/difurious/lightweight-charts-line-tools-core/src/model/data-source.ts
var DataSource = class {
  constructor() {
    /**
     * The API instance for the price scale this data source is currently bound to.
     * This can be the default price scale or a custom one.
     * @protected
     */
    __publicField(this, "_priceScale", null);
    __publicField(this, "_zorder", 0);
  }
  /**
   * Retrieves the current Z-order value, which determines the drawing layer of the tool's primitive.
   * @returns The Z-order index.
   */
  zorder() {
    return this._zorder;
  }
  /**
   * Sets the drawing layer of the tool's primitive.
   * @param zorder - The new Z-order index.
   * @returns void
   */
  setZorder(zorder) {
    this._zorder = zorder;
  }
  /**
   * Retrieves the API for the price scale this primitive is attached to.
   * @returns The `IPriceScaleApi` instance, or `null`.
   */
  priceScale() {
    return this._priceScale;
  }
  /**
   * Sets the API instance for the price scale.
   * @param priceScale - The `IPriceScaleApi` instance, or `null` to clear.
   * @returns void
   */
  setPriceScale(priceScale) {
    this._priceScale = priceScale;
  }
  /**
   * Checks if the data source is visible.
   * @returns Always returns `true` by default, but derived classes can override.
   */
  visible() {
    return true;
  }
  /**
   * Provides an array of views for labels drawn in the pane (not used by default).
   * @returns An empty array.
   */
  labelPaneViews() {
    return [];
  }
  /**
   * Provides an array of views for drawing content above the series data (not used by default).
   * @returns An empty array.
   */
  topPaneViews() {
    return [];
  }
  // This will point to IChartApiBase<any> in PriceDataSource
};

// vendor/difurious/lightweight-charts-line-tools-core/src/model/price-data-source.ts
var PriceDataSource = class extends DataSource {
  /**
   * Initializes the data source by storing the reference to the chart model.
   *
   * @param model - The `IChartApiBase` instance.
   */
  constructor(model) {
    super();
    /**
     * The reference to the Lightweight Charts chart API instance.
     * @protected
     * @readonly
     */
    __publicField(this, "_model");
    this._model = model;
  }
  /**
   * Retrieves the chart model API instance.
   *
   * This implements the abstract `IDataSource.model()` contract.
   *
   * @returns The `IChartApiBase` instance.
   */
  model() {
    return this._model;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/rendering/price-axis-view-renderer.ts
var PriceAxisViewRenderer = class {
  /**
   * Initializes the renderer with the initial data payloads.
   *
   * @param data - The {@link PriceAxisViewRendererData} containing the text and visibility flags.
   * @param commonData - The {@link PriceAxisViewRendererCommonData} containing coordinate and base style information.
   */
  constructor(data, commonData) {
    __publicField(this, "_data");
    __publicField(this, "_commonData");
    this.setData(data, commonData);
  }
  /**
   * Updates the data used by the renderer.
   *
   * @param data - The new {@link PriceAxisViewRendererData}.
   * @param commonData - The new {@link PriceAxisViewRendererCommonData}.
   * @returns void
   */
  setData(data, commonData) {
    this._data = data;
    this._commonData = commonData;
  }
  /**
   * Draws the price axis label onto the canvas.
   *
   * This method calculates the final layout, applies pixel snapping, draws the background/border/tick mark,
   * and renders the text based on the provided alignment ('left'/'right').
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @param rendererOptions - The {@link PriceAxisViewRendererOptions} for styling and dimensions.
   * @param textWidthCache - The {@link TextWidthCache} for accurate text measurement.
   * @param width - The total width of the Price Axis area in pixels.
   * @param align - The horizontal alignment of the axis ('left' for right scale, 'right' for left scale).
   * @returns void
   */
  draw(target, rendererOptions, textWidthCache, width, align) {
    if (!this._data.visible) {
      return;
    }
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const pixelRatio = mediaSize.width / width;
      ctx.font = rendererOptions.font;
      const tickSize = this._data.tickVisible || !this._data.moveTextToInvisibleTick ? rendererOptions.tickLength : 0;
      const horzBorder = rendererOptions.borderSize;
      const paddingTop = rendererOptions.paddingTop;
      const paddingBottom = rendererOptions.paddingBottom;
      const paddingInner = rendererOptions.paddingInner;
      const paddingOuter = rendererOptions.paddingOuter;
      const text = this._data.text;
      const textWidth = Math.ceil(textWidthCache.measureText(ctx, text));
      const baselineOffset = rendererOptions.baselineOffset;
      const totalHeight = rendererOptions.fontSize + paddingTop + paddingBottom;
      const halfHeight = Math.ceil(totalHeight * 0.5);
      const totalWidth = horzBorder + textWidth + paddingInner + paddingOuter + tickSize;
      let yMid = this._commonData.coordinate;
      if (this._commonData.fixedCoordinate) {
        yMid = this._commonData.fixedCoordinate;
      }
      yMid = Math.round(yMid);
      const yTop = yMid - halfHeight;
      const yBottom = yTop + totalHeight;
      const alignRight = align === "right";
      const xInside = alignRight ? width : 0;
      let xOutside = xInside;
      let xTick;
      let xText;
      ctx.lineWidth = 1;
      ctx.lineCap = "butt";
      if (text) {
        if (alignRight) {
          xOutside = xInside - totalWidth;
          xTick = xInside - tickSize;
          xText = xOutside + paddingOuter;
        } else {
          xOutside = xInside + totalWidth;
          xTick = xInside + tickSize;
          xText = xInside + horzBorder + tickSize + paddingInner;
        }
        const tickHeight = pixelRatio >= 1 ? 1 : 0.5;
        const horzBorderMedia = horzBorder;
        const xInsideMedia = alignRight ? width : 0;
        const yTopMedia = Math.round(yTop);
        const xOutsideMedia = Math.round(xOutside);
        const yMidMedia = Math.round(yMid);
        ctx.save();
        ctx.fillStyle = this._commonData.background;
        ctx.beginPath();
        ctx.moveTo(xInsideMedia, yTopMedia);
        ctx.lineTo(xOutsideMedia, yTopMedia);
        ctx.lineTo(xOutsideMedia, yBottom);
        ctx.lineTo(xInsideMedia, yBottom);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = this._data.borderColor;
        ctx.fillRect(alignRight ? xInsideMedia - horzBorderMedia : 0, yTopMedia, horzBorderMedia, yBottom - yTopMedia);
        if (this._data.tickVisible) {
          ctx.fillStyle = this._commonData.color;
          ctx.fillRect(xInsideMedia, yMidMedia, xTick - xInsideMedia, tickHeight);
        }
        ctx.textAlign = "left";
        ctx.fillStyle = this._commonData.color;
        ctx.fillText(text, xText, yBottom - paddingBottom - baselineOffset);
      }
    });
  }
  /**
   * Calculates the total pixel height required to draw the label.
   *
   * This height includes font size and vertical padding defined in the options.
   *
   * @param rendererOptions - The {@link PriceAxisViewRendererOptions} for dimensions.
   * @param useSecondLine - Flag to calculate height for a second line of text (not typically used for price labels).
   * @returns The calculated height in pixels, or 0 if the label is invisible.
   */
  height(rendererOptions, useSecondLine) {
    if (!this._data.visible) {
      return 0;
    }
    return rendererOptions.fontSize + rendererOptions.paddingTop + rendererOptions.paddingBottom;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/views/price-axis-view.ts
var PriceAxisView = class {
  // Flag to force and update
  /**
      * Initializes the Price Axis View.
      * 
      * @param ctor - Optional constructor for the renderer. Defaults to `PriceAxisViewRenderer`.
      */
  constructor(ctor) {
    // These objects hold the data that will be passed to the actual renderer.
    // We have one for the "axis label" itself and one for potential "pane-side labels".
    __publicField(this, "_commonRendererData", {
      coordinate: 0,
      // Price coordinates on the axis
      color: "#FFF",
      // Text color (default white)
      background: "#000"
      // Background color of the label (default black)
    });
    __publicField(this, "_axisRendererData", {
      text: "",
      visible: false,
      tickVisible: true,
      // Option to draw a small tick mark next to the label
      moveTextToInvisibleTick: false,
      // If tick is invisible, should text move away?
      borderColor: ""
      // Border color for the label box
    });
    __publicField(this, "_paneRendererData", {
      text: "",
      visible: false,
      tickVisible: false,
      moveTextToInvisibleTick: true,
      borderColor: ""
    });
    // These are the actual renderer instances that will perform the drawing.
    __publicField(this, "_axisRenderer");
    __publicField(this, "_paneRenderer");
    // For labels drawn within the pane (e.g., custom price lines)
    __publicField(this, "_invalidated", true);
    const RendererImpl = ctor || PriceAxisViewRenderer;
    this._axisRenderer = new RendererImpl(this._axisRendererData, this._commonRendererData);
    this._paneRenderer = new RendererImpl(this._paneRendererData, this._commonRendererData);
  }
  // -------------------------------------------------------------------
  // Implementation of IPriceAxisView / ISeriesPrimitiveAxisView methods
  // -------------------------------------------------------------------
  /**
      * Retrieves the text to be displayed on the axis label.
      * 
      * @returns The formatted price string.
      */
  text() {
    this._updateRendererDataIfNeeded();
    return this._axisRendererData.text;
  }
  /**
      * Retrieves the Y-coordinate for the label.
      * 
      * **Stacking Logic:** This method checks if a `fixedCoordinate` has been set by the 
      * `PriceAxisLabelStackingManager`. If so, it returns that shifted coordinate to prevent 
      * overlap. Otherwise, it returns the natural price-to-coordinate value.
      * 
      * @returns The Y-coordinate in pixels.
      */
  coordinate() {
    this._updateRendererDataIfNeeded();
    if (this._commonRendererData.fixedCoordinate !== void 0) {
      return this._commonRendererData.fixedCoordinate;
    }
    return this._commonRendererData.coordinate;
  }
  /**
      * Marks the view as invalid, forcing a data recalculation on the next access.
      */
  update() {
    this._invalidated = true;
  }
  /**
      * Measures the height required by the label.
      * 
      * It queries both the axis renderer and the pane renderer and returns the maximum height
      * to ensure sufficient space is reserved.
      * 
      * @param rendererOptions - Current styling options from the chart.
      * @param useSecondLine - Whether to account for a second line of text (default `false`).
      * @returns The height in pixels.
      */
  height(rendererOptions, useSecondLine = false) {
    return Math.max(
      this._axisRenderer.height(rendererOptions, useSecondLine),
      this._paneRenderer.height(rendererOptions, useSecondLine)
    );
  }
  /**
      * Retrieves the manually fixed Y-coordinate set by the Stacking Manager.
      * 
      * @returns The fixed coordinate, or `0` if unset (nominal type cast).
      */
  getFixedCoordinate() {
    return this._commonRendererData.fixedCoordinate || 0;
  }
  /**
      * Sets a manual Y-coordinate for this view.
      * 
      * This is called by the `PriceAxisLabelStackingManager` when it detects a collision
      * with another label.
      * 
      * @param value - The new Y-coordinate in pixels.
      */
  setFixedCoordinate(value) {
    this._commonRendererData.fixedCoordinate = value;
  }
  /**
      * Retrieves the text color for the label.
      * 
      * @returns A CSS color string.
      */
  textColor() {
    this._updateRendererDataIfNeeded();
    return this._commonRendererData.color;
  }
  /**
      * Retrieves the background color for the label.
      * 
      * @returns A CSS color string.
      */
  backColor() {
    this._updateRendererDataIfNeeded();
    return this._commonRendererData.background;
  }
  /**
      * Checks if the view is currently visible.
      * 
      * Returns `true` if either the main axis label or the pane-side label is set to visible.
      * 
      * @returns `true` if visible, `false` otherwise.
      */
  visible() {
    this._updateRendererDataIfNeeded();
    return this._axisRendererData.visible || this._paneRendererData.visible;
  }
  /**
      * Retrieves the renderer for the main axis label.
      * 
      * This method triggers a data update if the view is invalidated, applies the latest
      * data to the renderer instance, and returns it for drawing by the chart engine.
      * 
      * @returns The {@link IPriceAxisViewRenderer} for the axis.
      */
  getRenderer() {
    this._updateRendererDataIfNeeded();
    this._axisRenderer.setData(this._axisRendererData, this._commonRendererData);
    return this._axisRenderer;
  }
  /**
      * Retrieves the renderer for the pane-side label (e.g., text drawn inside the chart area near the axis).
      * 
      * @returns The {@link IPriceAxisViewRenderer} for the pane.
      */
  getPaneRenderer() {
    this._updateRendererDataIfNeeded();
    this._paneRenderer.setData(this._paneRendererData, this._commonRendererData);
    return this._paneRenderer;
  }
  // -------------------------------------------------------------------
  // Private helper to ensure data is fresh before rendering
  // -------------------------------------------------------------------
  /**
      * Internal helper to trigger data recalculation if the view is dirty.
      * 
      * It resets default visibility flags and colors before calling the abstract `_updateRendererData`.
      * 
      * **Note on Stacking:** This method intentionally does *not* reset `fixedCoordinate`. 
      * The fixed coordinate is managed exclusively by the concrete view's interaction with the 
      * `PriceAxisLabelStackingManager`, ensuring that stacking shifts persist across standard update cycles.
      * 
      * @private
      */
  _updateRendererDataIfNeeded() {
    if (this._invalidated) {
      this._axisRendererData.text = "";
      this._axisRendererData.visible = false;
      this._axisRendererData.tickVisible = true;
      this._axisRendererData.moveTextToInvisibleTick = false;
      this._axisRendererData.borderColor = "";
      this._paneRendererData.text = "";
      this._paneRendererData.visible = false;
      this._paneRendererData.tickVisible = false;
      this._paneRendererData.moveTextToInvisibleTick = true;
      this._paneRendererData.borderColor = "";
      this._commonRendererData.coordinate = 0;
      this._commonRendererData.color = "#FFF";
      this._commonRendererData.background = "#000";
      this._updateRendererData(this._axisRendererData, this._paneRendererData, this._commonRendererData);
      this._invalidated = false;
    }
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/views/line-tool-price-axis-label-view.ts
var LineToolPriceAxisLabelView = class extends PriceAxisView {
  /**
      * Initializes the price axis label view.
      * 
      * @param tool - The parent line tool instance.
      * @param pointIndex - The index of the point in the tool's data array that this label represents.
      * @param chart - The chart API instance.
      * @param priceAxisLabelStackingManager - The manager instance to register this label with for collision resolution.
      */
  constructor(tool, pointIndex, chart, priceAxisLabelStackingManager) {
    super();
    __publicField(this, "_tool");
    __publicField(this, "_pointIndex");
    __publicField(this, "_chart");
    __publicField(this, "_priceAxisLabelStackingManager");
    // NEW: Store the fixed coordinate provided by the stacking manager
    __publicField(this, "_fixedCoordinate");
    __publicField(this, "_isRegistered", false);
    this._tool = tool;
    this._pointIndex = pointIndex;
    this._chart = chart;
    this._priceAxisLabelStackingManager = priceAxisLabelStackingManager;
  }
  /**
   * Retrieves the index of the point this label is associated with.
   * 
   * Used primarily by the {@link PriceAxisLabelStackingManager} to generate a unique ID 
   * for this label (e.g., `ToolID-pIndex`).
   * 
   * @returns The zero-based point index.
   */
  getPointIndex() {
    return this._pointIndex;
  }
  /**
   * Callback method used by the {@link PriceAxisLabelStackingManager} to update the label's vertical position.
   * 
   * If the stacking manager detects a collision, it calls this method with a new, adjusted Y-coordinate.
   * This method then triggers an immediate chart update to ensure the label is drawn at the new position
   * in the same render frame, preventing visual jitter.
   * 
   * @param coordinate - The calculated collision-free Y-coordinate, or `undefined` to use the natural position.
   */
  setFixedCoordinateFromManager(coordinate) {
    if (this._fixedCoordinate !== coordinate) {
      this._fixedCoordinate = coordinate;
      this.update();
      this._tool._triggerChartUpdate();
    }
  }
  /**
   * The core logic for updating the renderer's state.
   * 
   * This method performs the following tasks:
   * 1. Validates the existence of logical points and API references.
   * 2. Determines interaction-based visibility (excluding hover states).
   * 3. Registers the label with the PriceAxisLabelStackingManager for collision resolution.
   * 4. Configures the final renderer data with high-contrast colors and formatted price strings.
   * 
   * @param axisRendererData - The data object for the main axis label.
   * @param paneRendererData - The data object for any pane-side rendering (unused).
   * @param commonData - Shared data (coordinates, colors) between axis and pane renderers.
   */
  _updateRendererData(axisRendererData, paneRendererData, commonData) {
    commonData.fixedCoordinate = this._fixedCoordinate;
    axisRendererData.visible = false;
    paneRendererData.visible = false;
    const toolOptions = this._tool.options();
    const priceScaleApi = this._tool.priceScale();
    const series = this._tool.getSeries();
    const point = this._tool.getPoint(this._pointIndex);
    const labelId = this._tool.id() + "-p" + this._pointIndex;
    if (this._tool.isCulled()) {
      if (this._isRegistered) {
        this._priceAxisLabelStackingManager.unregisterLabel(labelId);
        this._isRegistered = false;
        this.setFixedCoordinateFromManager(void 0);
      }
      return;
    }
    const isToolActive = this._tool.isSelected() || this._tool.isEditing() || this._tool.isCreating();
    const isLabelVisuallyActive = toolOptions.priceAxisLabelAlwaysVisible || isToolActive;
    const isStructurallyValid = toolOptions.visible && toolOptions.showPriceAxisLabels && isLabelVisuallyActive && point && isFinite(point.price) && priceScaleApi && series;
    if (!isStructurallyValid) {
      if (this._isRegistered) {
        this._priceAxisLabelStackingManager.unregisterLabel(labelId);
        this._isRegistered = false;
        this.setFixedCoordinateFromManager(void 0);
      }
      return;
    }
    const backgroundColor = this._tool.priceAxisLabelColor();
    commonData.coordinate = series.priceToCoordinate(point.price);
    const layoutOptions = this._chart.options().layout;
    const priceScaleOptions = priceScaleApi.options();
    const currentRendererOptions = {
      font: `${layoutOptions.fontSize}px ${layoutOptions.fontFamily}`,
      fontFamily: layoutOptions.fontFamily,
      color: layoutOptions.textColor,
      fontSize: layoutOptions.fontSize,
      baselineOffset: Math.round(layoutOptions.fontSize / 10),
      borderSize: priceScaleOptions.borderVisible ? 1 : 0,
      paddingBottom: Math.floor(layoutOptions.fontSize / 3.5),
      paddingTop: Math.floor(layoutOptions.fontSize / 3.5),
      paddingInner: Math.max(Math.ceil(layoutOptions.fontSize / 2 - (priceScaleOptions.ticksVisible ? 4 : 0) / 2), 0),
      paddingOuter: Math.ceil(layoutOptions.fontSize / 2 + (priceScaleOptions.ticksVisible ? 4 : 0) / 2),
      tickLength: priceScaleOptions.ticksVisible ? 4 : 0
    };
    let labelHeight = 16;
    try {
      const textToMeasure = series.priceFormatter().format(point.price) || "0";
      const tempRendererData = { text: textToMeasure, visible: true, tickVisible: false };
      const tempCommonData = { coordinate: 0, background: "black", color: "white" };
      const tempRenderer = new PriceAxisViewRenderer(tempRendererData, tempCommonData);
      labelHeight = tempRenderer.height(currentRendererOptions, false);
    } catch (e) {
    }
    this._priceAxisLabelStackingManager.registerLabel({
      id: labelId,
      toolId: this._tool.id(),
      originalCoordinate: commonData.coordinate,
      height: labelHeight,
      setFixedCoordinate: (coord) => this.setFixedCoordinateFromManager(coord),
      isVisible: () => true
      // Already checked structural validity
    });
    this._isRegistered = true;
    if (backgroundColor !== null) {
      const colors = generateContrastColors(backgroundColor);
      commonData.background = colors.background;
      commonData.color = colors.foreground;
      axisRendererData.text = series.priceFormatter().format(point.price);
      axisRendererData.borderColor = colors.background;
      axisRendererData.visible = true;
    } else {
      axisRendererData.visible = false;
    }
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/views/line-tool-time-axis-label-view.ts
var LineToolTimeAxisLabelView = class {
  /**
      * Initializes the time axis label view.
      * 
      * @param tool - The parent line tool instance.
      * @param pointIndex - The index of the point in the tool's data array that this label represents.
      * @param chart - The chart API instance (used for time scale access and formatting).
      */
  constructor(tool, pointIndex, chart) {
    __publicField(this, "_tool");
    __publicField(this, "_pointIndex");
    __publicField(this, "_chart");
    // Reference to chart for timescale & formatting
    __publicField(this, "_timeScale");
    // Direct reference to timeScaleAPI for convenience
    __publicField(this, "_renderer");
    __publicField(this, "_rendererData", {
      visible: false,
      background: "#4c525e",
      // Default background, will be overridden
      color: "white",
      // Default text color, will be overridden
      text: "",
      width: 0,
      // Will be filled by updateImpl
      coordinate: 0
      // X-coordinate will be filled by updateImpl
    });
    __publicField(this, "_invalidated", true);
    this._tool = tool;
    this._pointIndex = pointIndex;
    this._chart = chart;
    this._timeScale = chart.timeScale();
    this._renderer = new TimeAxisViewRenderer();
  }
  // -------------------------------------------------------------------
  // Implementation of ITimeAxisView / ISeriesPrimitiveAxisView methods
  // -------------------------------------------------------------------
  /**
      * Marks the view as invalidated.
      * 
      * This signals that the internal data (text, coordinate, color) needs to be recalculated 
      * before the next render cycle. This is typically called when the tool moves or options change.
      */
  update() {
    this._invalidated = true;
  }
  /**
      * Retrieves the renderer responsible for drawing the label.
      * 
      * This method ensures the renderer's data is up-to-date by triggering a recalculation 
      * (`_updateImpl`) if the view is invalidated.
      * 
      * @returns The {@link ITimeAxisViewRenderer} instance.
      */
  getRenderer() {
    this._updateRendererDataIfNeeded();
    this._renderer.setData(this._rendererData);
    return this._renderer;
  }
  /**
      * Retrieves the formatted text content for the label.
      * 
      * @returns The formatted date/time string based on the chart's localization settings.
      */
  text() {
    this._updateRendererDataIfNeeded();
    return this._rendererData.text;
  }
  /**
      * Retrieves the X-coordinate of the label's center.
      * 
      * @returns The screen coordinate in pixels.
      */
  coordinate() {
    this._updateRendererDataIfNeeded();
    return this._rendererData.coordinate;
  }
  /**
      * Retrieves the text color.
      * 
      * @returns A CSS color string (usually calculated for high contrast against the background).
      */
  textColor() {
    this._updateRendererDataIfNeeded();
    return this._rendererData.color;
  }
  /**
      * Retrieves the background color of the label tag.
      * 
      * @returns A CSS color string (derived from the tool's styling options).
      */
  backColor() {
    this._updateRendererDataIfNeeded();
    return this._rendererData.background;
  }
  /**
      * Checks if the label should be currently visible.
      * 
      * Visibility depends on:
      * 1. The tool's global visibility.
      * 2. The `showTimeAxisLabels` option.
      * 3. The tool's interaction state (selected/hovered) vs. `timeAxisLabelAlwaysVisible`.
      * 
      * @returns `true` if the label should be drawn.
      */
  visible() {
    this._updateRendererDataIfNeeded();
    return this._rendererData.visible;
  }
  /**
      * Calculates the required height of the label in the time scale area.
      * 
      * This delegates to the renderer's measurement logic to ensure consistency.
      * 
      * @param rendererOptions - Current styling options for the time axis.
      * @returns The height in pixels.
      */
  height(rendererOptions) {
    return this._renderer.height(rendererOptions);
  }
  // -------------------------------------------------------------------
  // Private/Protected helper methods for updating data
  // -------------------------------------------------------------------
  /**
      * Internal helper to trigger data recalculation only if the view is dirty.
      * 
      * @private
      */
  _updateRendererDataIfNeeded() {
    if (this._invalidated) {
      this._updateImpl();
      this._invalidated = false;
    }
  }
  /**
   * Synchronizes the internal state of the time axis label with the tool's current logical position.
   * 
   * This method acts as the data-preparation engine for the renderer. It performs 
   * visibility arbitration, tiered text formatting (matching chart localization), 
   * high-contrast color generation, and coordinate mapping.
   * 
   * ### Sub-Pixel Accuracy
   * This view utilizes fractional logical index interpolation to ensure that labels 
   * do not "jump" between candles on higher timeframes. By calculating visual positions 
   * manually via neighbor-probing, it avoids native API limitations that would otherwise 
   * cause labels to stick to the left edge of the screen.
   * 
   * @private
   * @returns void
   */
  _updateImpl() {
    const data = this._rendererData;
    data.visible = false;
    data.text = "";
    data.coordinate = 0;
    if (this._tool.isCulled()) {
      return;
    }
    const toolOptions = this._tool.options();
    const isToolActive = this._tool.isSelected() || this._tool.isEditing() || this._tool.isCreating();
    if (!toolOptions.visible || !toolOptions.showTimeAxisLabels || !(toolOptions.timeAxisLabelAlwaysVisible || isToolActive)) {
      return;
    }
    const point = this._tool.getPoint(this._pointIndex);
    if (!point || !isFinite(point.timestamp)) {
      return;
    }
    const timeAsHorzScaleItem = point.timestamp;
    const pluginFormatter = this._tool.coreApi().getTimeFormatter();
    const chartFormatter = this._chart.options().localization.timeFormatter;
    if (pluginFormatter) {
      data.text = pluginFormatter(timeAsHorzScaleItem);
    } else if (chartFormatter) {
      data.text = chartFormatter(timeAsHorzScaleItem);
    } else {
      const internalHorzItem = this._tool.horzScaleBehavior.convertHorzItemToInternal(timeAsHorzScaleItem);
      data.text = this._tool.horzScaleBehavior.formatHorzItem(internalHorzItem);
    }
    const backgroundColor = this._tool.timeAxisLabelColor();
    if (backgroundColor === null) return;
    const colors = generateContrastColors(backgroundColor);
    data.background = colors.background;
    data.color = colors.foreground;
    if (this._timeScale.getVisibleLogicalRange() === null) return;
    const interpolatedLogicalIndex = interpolateLogicalIndexFromTime(
      this._chart,
      this._tool.getSeries(),
      timeAsHorzScaleItem
    );
    if (interpolatedLogicalIndex === null) return;
    const finalX = logicalIndexToCoordinate(this._timeScale, interpolatedLogicalIndex);
    if (finalX === null || !isFinite(finalX) || isNaN(finalX)) {
      return;
    }
    data.coordinate = finalX;
    data.width = this._timeScale.width();
    data.visible = true;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/model/base-line-tool.ts
var BaseLineTool = class extends PriceDataSource {
  /**
   * Initializes the Base Line Tool instance.
   *
   * Sets up core references, assigns the unique ID, and creates the persistent Price and Time Axis View instances
   * based on the tool's required `pointsCount`.
   *
   * @param coreApi - The core plugin instance.
   * @param chart - The chart API instance.
   * @param series - The series API instance this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior for time conversion utilities.
   * @param finalOptions - The complete and final configuration options for the tool instance.
   * @param points - Initial array of logical points.
   * @param toolType - The specific string identifier for the tool.
   * @param pointsCount - The fixed number of points this tool requires (`-1` for unbounded).
   * @param priceAxisLabelStackingManager - The manager for label collision resolution.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, finalOptions, points = [], toolType, pointsCount, priceAxisLabelStackingManager) {
    super(chart);
    // Abstract properties that must be defined by child classes
    // These properties are now set in the constructor from subclass arguments
    /**
     * The unique string identifier for this specific tool's type (e.g., 'TrendLine', 'Rectangle').
     * This is defined by the concrete implementation class.
     * @readonly
     */
    __publicField(this, "toolType");
    /**
     * The fixed number of logical points this tool requires.
     *
     * - A positive number (e.g., `2` for a TrendLine) means the tool is *bounded*.
     * - A value of `-1` (e.g., for Brush, Path) means the tool is *unbounded* and can have a variable number of points.
     * @readonly
     */
    __publicField(this, "pointsCount");
    // Storage for axis view instances
    __publicField(this, "_priceAxisLabelViews", []);
    __publicField(this, "_timeAxisLabelViews", []);
    /**
     * Reference to the manager responsible for resolving price axis label collisions.
     * Used to ensure this tool's price labels do not overlap others.
     * @protected
     */
    __publicField(this, "_priceAxisLabelStackingManager");
    __publicField(this, "_overrideCursor", null);
    // Core instances and plugin API
    __publicField(this, "_chart");
    __publicField(this, "_series");
    __publicField(this, "_horzScaleBehavior");
    __publicField(this, "_coreApi");
    __publicField(this, "_requestUpdate");
    // Tool-specific state
    __publicField(this, "_id");
    __publicField(this, "_options", {});
    __publicField(this, "_points");
    __publicField(this, "_paneViews", []);
    // Interaction state
    __publicField(this, "_selected", false);
    __publicField(this, "_hovered", false);
    __publicField(this, "_editing", false);
    __publicField(this, "_creating", false);
    __publicField(this, "_lastPoint", null);
    __publicField(this, "_editedPointIndex", null);
    __publicField(this, "_currentPoint", new Point(0, 0));
    __publicField(this, "_isDestroying", false);
    /**
     * Internal flag indicating if the tool is currently positioned off-screen.
     * @private
     */
    __publicField(this, "_isCulled", false);
    __publicField(this, "_attachedPane", null);
    this._id = randomHash();
    this._coreApi = coreApi;
    this._chart = chart;
    this._series = series;
    this._horzScaleBehavior = horzScaleBehavior;
    this._points = points;
    this._creating = points.length === 0;
    this.toolType = toolType;
    this.pointsCount = pointsCount;
    this._priceAxisLabelStackingManager = priceAxisLabelStackingManager;
    this._setupOptions(finalOptions);
    if (this._options.magnetThreshold === void 0) {
      this._options.magnetThreshold = 0;
    }
    if (this.pointsCount !== -1) {
      for (let i = 0; i < this.pointsCount; i++) {
        this._priceAxisLabelViews[i] = new LineToolPriceAxisLabelView(this, i, this._chart, this._priceAxisLabelStackingManager);
        this._timeAxisLabelViews[i] = new LineToolTimeAxisLabelView(this, i, this._chart);
      }
    }
  }
  /**
   * Calculates whether the tool is currently visible within the chart's viewport.
   * 
   * ### The "Calculate Once, Use Everywhere" Pattern
   * This method is the central point for the tool's geometric visibility logic (Culling). 
   * It is called automatically by {@link updateAllViews} before any rendering occurs.
   * 
   * ### Why implement this?
   * 1. **Performance:** By determining if a tool is off-screen before drawing, we avoid 
   *    expensive canvas operations and coordinate math in the Views.
   * 2. **Synchronization:** Storing the result in the Model ensures that the Main Pane, 
   *    the Price Axis, and the Time Axis all "agree" on whether they should be visible. 
   *    This prevents bugs like a label showing up for a tool that isn't on screen.
   * 
   * ### Implementation Guide
   * Concrete subclasses should override this method and use the `getToolCullingState` utility. 
   * You must pass the specific geometric "quirks" of your tool (e.g., if it's 
   * infinite horizontally like a Horizontal Line, or has Rays/Extensions).
   * 
   * **Important:** Your implementation must end by calling {@link _setIsCulled} with the result.
   * 
   * @example
   * ```ts
   * protected override updateCullingState(): void {
   *     const result = getToolCullingState(this.points(), this, this.options().line.extend);
   *     this._setIsCulled(result !== OffScreenState.Visible);
   * }
   * ```
   * 
   * @protected
   * @returns void
   */
  updateCullingState() {
  }
  /**
   * Provides an array of price axis view components to Lightweight Charts for rendering the tool's labels.
   *
   * This implementation wraps the internal `_priceAxisLabelViews` array.
   *
   * @returns A readonly array of {@link IPriceAxisView} components.
   */
  priceAxisViews() {
    if (this._isDestroying) return [];
    const views = [...this._priceAxisLabelViews];
    return views;
  }
  /**
   * Provides an array of time axis view components to Lightweight Charts for rendering the tool's labels.
   *
   * This implementation wraps the internal `_timeAxisLabelViews` array.
   *
   * @returns A readonly array of {@link ITimeAxisView} components.
   */
  timeAxisViews() {
    if (this._isDestroying) return [];
    const views = [...this._timeAxisLabelViews];
    return views;
  }
  /**
   * Temporarily overrides the cursor style displayed over the chart pane, bypassing normal hover detection.
   *
   * This is typically used by the {@link InteractionManager} during an active drag or edit gesture
   * to ensure the cursor stays consistent (e.g., `grabbing`) regardless of where the mouse moves.
   *
   * @param cursor - The {@link PaneCursorType} to enforce, or `null` to revert to default behavior.
   */
  setOverrideCursor(cursor) {
    this._overrideCursor = cursor;
  }
  /**
   * The public hit-test method required by the Lightweight Charts `ISeriesPrimitive` interface.
   *
   * This method acts as an adapter, calling `_internalHitTest` and converting its internal
   * result (`HitTestResult`) into the required LWC `PrimitiveHoveredItem` format, including
   * cursor determination and Z-order.
   *
   * @param x - The X coordinate from Lightweight Charts (in pixels).
   * @param y - The Y coordinate from Lightweight Charts (in pixels).
   * @returns A `PrimitiveHoveredItem` if the tool is hit, otherwise `null`.
   */
  hitTest(x, y) {
    if (this._overrideCursor) {
      return {
        externalId: this.id(),
        zOrder: "normal",
        cursorStyle: this._overrideCursor
      };
    }
    if (!this.options().editable) {
      const ourX2 = x;
      const ourY2 = y;
      const internalResult2 = this._internalHitTest(ourX2, ourY2);
      if (internalResult2 !== null) {
        return {
          externalId: this.id(),
          zOrder: "normal",
          cursorStyle: this.options().notEditableCursor || "not-allowed" /* NotAllowed */
        };
      }
      return null;
    }
    const ourX = x;
    const ourY = y;
    const internalResult = this._internalHitTest(ourX, ourY);
    if (internalResult === null) {
      return null;
    }
    const hitData = internalResult.data();
    let cursorStyle = "default" /* Default */;
    if (hitData?.suggestedCursor) {
      cursorStyle = hitData.suggestedCursor;
    } else {
      const options = this.options();
      switch (internalResult.type()) {
        case 3 /* MovePointBackground */:
          cursorStyle = options.defaultDragCursor || "grabbing" /* Grabbing */;
          break;
        case 2 /* MovePoint */:
        case 1 /* Regular */:
          cursorStyle = options.defaultHoverCursor || "pointer" /* Pointer */;
          break;
        case 4 /* ChangePoint */:
          cursorStyle = "nwse-resize" /* DiagonalNwSeResize */;
          break;
        default:
          cursorStyle = "default" /* Default */;
          break;
      }
    }
    return {
      externalId: this.id(),
      // Return the unique ID of the tool
      zOrder: "normal",
      // Default zOrder for line tools
      cursorStyle
      // NEW: Use the determined cursorStyle
    };
  }
  /**
   * Lifecycle hook called by Lightweight Charts when the primitive is first attached to a series.
   *
   * This method finalizes the setup by acquiring necessary runtime references:
   * the `IPriceScaleApi`, the `requestUpdate` callback, and the {@link IPaneApi} reference.
   *
   * @param param - The parameters provided by Lightweight Charts upon attachment.
   * @returns void
   */
  attached(param) {
    this._chart = param.chart;
    this._series = param.series;
    this.setPriceScale(param.series.priceScale());
    this._requestUpdate = param.requestUpdate;
    this._horzScaleBehavior = param.horzScaleBehavior;
    this._attachedPane = this._chart.panes().find((p) => {
      return p.getSeries().some((s) => s === this._series);
    }) || null;
    if (!this._attachedPane) {
      console.warn(`[BaseLineTool] Tool ${this.id()} attached to a series not found in any pane. This primitive relies on IPaneApi access.`);
    }
    for (const pv of this._paneViews) {
      if (pv.updateSeries) {
        pv.updateSeries(param.series);
      }
    }
  }
  /**
   * Lifecycle hook called by Lightweight Charts when the primitive is detached from a series.
   *
   * This performs crucial cleanup by nullifying references to external Lightweight Charts API objects
   * (chart, series, pane, etc.) to prevent memory leaks and stale closures.
   *
   * @returns void
   */
  detached() {
    this._chart = null;
    this._series = null;
    this._horzScaleBehavior = null;
    this._attachedPane = null;
    this._requestUpdate = null;
  }
  /**
   * Returns the {@link IPaneApi} instance to which this tool is currently attached.
   *
   * This reference is required for internal operations like detaching the tool primitive.
   *
   * @returns The {@link IPaneApi} for the attached pane.
   * @throws An error if the tool has not been successfully attached to a series/pane yet.
   */
  getPane() {
    if (!this._attachedPane) {
      throw new Error(`Tool ${this.id()} is not attached to a pane. 'attached()' might not have been called or ran into an issue.`);
    }
    return this._attachedPane;
  }
  // #region Public API for managing tool state & properties
  /**
   * Retrieves the unique string identifier for this tool instance.
   *
   * @returns The unique ID.
   */
  id() {
    return this._id;
  }
  /**
   * Sets a specific unique ID for this tool instance.
   *
   * This is primarily used during programmatic creation via {@link LineToolsCorePlugin.createOrUpdateLineTool}
   * to ensure a user-defined ID is preserved.
   *
   * @param id - The unique string ID to assign.
   * @returns void
   */
  setId(id) {
    this._id = id;
  }
  /**
   * Checks if the tool is currently in the selected state.
   *
   * The selected state typically enables anchor handles and border highlighting.
   *
   * @returns `true` if selected, `false` otherwise.
   */
  isSelected() {
    return this._selected;
  }
  /**
   * Checks if the mouse cursor is currently hovering over the tool.
   *
   * The hovered state often triggers a temporary visual change, like a different border color.
   *
   * @returns `true` if hovered, `false` otherwise.
   */
  isHovered() {
    return this._hovered;
  }
  /**
   * Checks if the tool is currently being actively edited (i.e., an anchor point is being dragged).
   *
   * The editing state is distinct from being merely selected.
   *
   * @returns `true` if an anchor is being dragged, `false` otherwise.
   */
  isEditing() {
    return this._editing;
  }
  /**
   * Checks if the tool is currently in the process of being created by user interaction.
   *
   * The creating state is active from the moment the tool is initiated until its final point is placed.
   *
   * @returns `true` if in creation mode, `false` otherwise.
   */
  isCreating() {
    return this._creating;
  }
  /**
   * Checks if the tool is currently culled (off-screen).
   * 
   * When a tool is culled, its pane renderers and axis labels should typically 
   * be hidden to optimize performance and prevent visual clutter.
   * 
   * @returns `true` if culled, `false` if visible.
   */
  isCulled() {
    return this._isCulled;
  }
  /**
   * Updates the internal culling state.
   * 
   * @param culled - The new culling state.
   * @protected
   */
  _setIsCulled(culled) {
    this._isCulled = culled;
  }
  /**
   * Sets the tool's selection state and triggers a view update to reflect the change.
   *
   * @param selected - The new selection state (`true` to select, `false` to deselect).
   * @returns void
   */
  setSelected(selected) {
    this._selected = selected;
    this.updateAllViews();
    this._requestUpdate?.();
  }
  /**
   * Sets the tool's hovered state and triggers a view update if the state changes.
   *
   * @param hovered - The new hover state.
   * @returns void
   */
  setHovered(hovered) {
    this._hovered = hovered;
    this.updateAllViews();
    this._requestUpdate?.();
  }
  /**
   * Sets the tool's editing state (active drag is in progress).
   *
   * This typically happens when the user clicks down on an anchor and moves beyond the drag threshold.
   *
   * @param editing - The new editing state.
   * @returns void
   */
  setEditing(editing) {
    this._editing = editing;
    this.updateAllViews();
    this._requestUpdate?.();
  }
  /**
   * Sets the tool's creation state.
   *
   * This is used internally by the {@link InteractionManager} to track which tool instance
   * is currently accepting new points from user clicks.
   *
   * @param creating - The new creation state.
   * @returns void
   */
  setCreating(creating) {
    this._creating = creating;
  }
  /**
   * Returns the index of the anchor point currently being dragged/edited.
   *
   * @returns The zero-based index of the dragged point, or `null` if `isEditing` is false.
   */
  editedPointIndex() {
    return this._editing ? this._editedPointIndex : null;
  }
  /**
   * Sets the index of the anchor point that is currently the target of an editing drag.
   *
   * @param index - The index of the point, or `null` to clear the reference.
   * @returns void
   */
  setEditedPointIndex(index) {
    this._editedPointIndex = index;
  }
  /**
   * Retrieves the last known screen coordinates of the mouse cursor over the chart.
   *
   * This point is continuously updated by the {@link InteractionManager} and is used by renderers
   * (like the anchor renderer) to draw effects relative to the mouse position (e.g., hover halo).
   *
   * @returns A {@link Point} object with the current mouse screen coordinates.
   */
  currentPoint() {
    return this._currentPoint;
  }
  /**
   * Sets the last known screen coordinates of the mouse cursor.
   *
   * @param point - The new screen coordinate point.
   * @returns void
   */
  setCurrentPoint(point) {
    this._currentPoint = point;
  }
  /**
   * Retrieves the full list of points used for drawing the tool.
   *
   * This list includes both the permanent, committed points (`_points`) and, if the tool is in
   * creation mode, the single temporary "ghost" point (`_lastPoint`) currently following the cursor.
   *
   * @returns A composite array of {@link LineToolPoint}s.
   */
  points() {
    const points = [...this._points, ...this._lastPoint ? [this._lastPoint] : []];
    return this.pointsCount === -1 ? points : points.slice(0, this.pointsCount);
  }
  /**
   * Retrieves the single temporary "ghost" point used for live preview during tool creation.
   *
   * @returns The last calculated {@link LineToolPoint} of the mouse position, or `null`.
   */
  getLastPoint() {
    return this._lastPoint;
  }
  /**
   * Sets or clears the temporary "ghost" point.
   *
   * Used during the tool creation process to show a live preview that follows the user's mouse.
   * Setting this immediately calls `_triggerChartUpdate`.
   *
   * @param point - The temporary {@link LineToolPoint}, or `null` to clear it.
   * @returns void
   */
  setLastPoint(point) {
    this._lastPoint = point;
    this._triggerChartUpdate();
  }
  /**
   * Overwrites the entire array of permanent points defining the tool's geometry.
   *
   * This method is called during programmatic updates or when the entire tool is translated (moved).
   *
   * @param points - The new array of {@link LineToolPoint}s.
   * @returns void
   */
  setPoints(points) {
    this._points = points;
  }
  /**
   * Adds a new, permanent {@link LineToolPoint} to the end of the tool's point array.
   *
   * This is called by the {@link InteractionManager} when a user performs a click to commit a new point during creation.
   *
   * @param point - The {@link LineToolPoint} to add.
   * @returns void
   */
  addPoint(point) {
    this._points.push(point);
  }
  /**
   * Retrieves a permanent point from the internal array by its index.
   *
   * @param index - The zero-based index of the point.
   * @returns The requested {@link LineToolPoint}, or `null` if the index is out of bounds.
   */
  getPoint(index) {
    return this._points[index] || null;
  }
  /**
   * Updates a specific permanent point in the internal array with new logical coordinates.
   *
   * This method is called during editing (resizing) of a specific anchor point.
   *
   * @param index - The index of the point to modify.
   * @param point - The new {@link LineToolPoint} coordinates.
   * @returns void
   */
  setPoint(index, point) {
    if (this._points[index]) {
      this._points[index] = point;
    }
  }
  /**
   * Returns the number of permanently committed points currently defining the tool.
   *
   * This count excludes any temporary "ghost" point and is used by the {@link InteractionManager}
   * to decide the index of the next point to add.
   *
   * @returns The number of permanent points.
   */
  getPermanentPointsCount() {
    return this._points.length;
  }
  /**
   * Retrieves the complete and final configuration options object for this tool instance.
   *
   * This includes both the {@link LineToolOptionsCommon} and the tool-specific options.
   *
   * @returns The full options object.
   */
  options() {
    return this._options;
  }
  /**
   * Deeply merges a partial set of new options into the tool's current configuration.
   *
   * This is the core method for updating the tool's appearance programmatically. It automatically
   * triggers a full view update and a chart redraw after the merge is complete.
   *
   * @param options - A deep partial of the tool's options structure containing changes to be merged.
   * @returns void
   */
  applyOptions(options) {
    merge(this._options, options);
    this.updateAllViews("options");
    this._requestUpdate?.();
  }
  /**
   * Checks if the tool has acquired its minimum required number of permanent points.
   *
   * For bounded tools (`pointsCount > 0`), this returns true if `_points.length` meets `pointsCount`.
   * For unbounded tools (`pointsCount === -1`), this check typically passes early, deferring finalization to `getFinalizationMethod`.
   *
   * @returns `true` if the tool is ready to exit creation mode, `false` otherwise.
   */
  isFinished() {
    return this._points.length >= this.pointsCount;
  }
  /**
   * Attempts to transition the tool out of the `creating` state and into the `selected` state.
   *
   * This is called by the {@link InteractionManager} after a point is added. If `isFinished()` is true,
   * the creation state is reset, the selected state is set, and views are updated.
   *
   * @returns void
   */
  tryFinish() {
    if (this.isFinished()) {
      this._creating = false;
      this._editing = false;
      this.setSelected(true);
      this.updateAllViews();
      this._requestUpdate?.();
    }
  }
  /**
   * Generates the complete, serializable {@link LineToolExport} object representing the tool's current state.
   *
   * This is the fundamental data output used for API responses, event payloads, and state persistence.
   *
   * @returns The full export data object.
   */
  getExportData() {
    return {
      id: this.id(),
      toolType: this.toolType,
      points: this.points(),
      options: this.options()
    };
  }
  // #endregion
  // #region ISeriesPrimitive implementation
  /**
   * Provides an array of pane view components to Lightweight Charts for rendering the tool's body.
   *
   * This implements the `ISeriesPrimitive` contract.
   *
   * @returns A readonly array of {@link IPaneView} components.
   */
  paneViews() {
    if (this._isDestroying) {
      return [];
    }
    return this._paneViews;
  }
  /**
   * Signals that all associated view components (pane, price axis, time axis) need to update their internal data and caches.
   *
   * This method automatically triggers the synchronous update of the {@link PriceAxisLabelStackingManager}
   * to ensure correct vertical placement of labels before the next render.
   * 
   * @param updateType - Optional hint about what changed ('data', 'options', etc.) to assist views with optimized cache clearing.
   * @returns void
   */
  updateAllViews(updateType) {
    this.updateCullingState();
    this._paneViews.forEach((view) => view.update(updateType));
    if (this.pointsCount === -1) {
    }
    this._priceAxisLabelViews.forEach((view) => view.update());
    this._timeAxisLabelViews.forEach((view) => view.update());
    this._priceAxisLabelStackingManager.updateStacking();
  }
  /**
   * Retrieves the color that should be used for the price axis label background.
   *
   * Concrete tools should override this to return a dynamic color based on the tool's current state (e.g., color of P0).
   *
   * @returns A color string (e.g., '#FF0000') or `null` if the label should not be visible.
   */
  priceAxisLabelColor() {
    return "#2962FF";
  }
  /**
   * Retrieves the color that should be used for the time axis label background.
   *
   * Concrete tools should override this to return a dynamic color based on the tool's current state (e.g., color of P0).
   *
   * @returns A color string (e.g., '#FF0000') or `null` if the label should not be visible.
   */
  timeAxisLabelColor() {
    return "#2962FF";
  }
  /**
   * Retrieves the Lightweight Charts Series API instance this tool is attached to.
   *
   * @returns The `ISeriesApi` instance.
   * @throws An error if the series has not been attached (e.g., in `detached` state).
   */
  getSeries() {
    if (!this._series) {
      throw new Error(`Series not attached to tool ${this.id()}.`);
    }
    return this._series;
  }
  /**
   * Retrieves the Lightweight Charts Chart API instance associated with this tool.
   *
   * @returns The `IChartApiBase` instance.
   * @throws An error if the chart API is not available.
   */
  getChart() {
    if (!this._chart) {
      throw new Error("Chart API not available. Tool might not be attached.");
    }
    return this._chart;
  }
  /**
   * Retrieves the chart's horizontal scale behavior instance.
   *
   * This object is critical for correctly converting time values (`Time`, `UTCTimestamp`, etc.)
   * to and from the generic `HorzScaleItem` type used by Lightweight Charts.
   *
   * @returns The `IHorzScaleBehavior` instance.
   * @throws An error if the scale behavior is not attached.
   */
  get horzScaleBehavior() {
    if (!this._horzScaleBehavior) {
      throw new Error(`Horizontal Scale Behavior not attached to tool ${this.id()}.`);
    }
    return this._horzScaleBehavior;
  }
  /**
   * Retrieves the reference to the main Core Plugin instance.
   * 
   * This allows views and sub-components to access global plugin settings 
   * like custom formatters or snapping configurations.
   * 
   * @returns The {@link LineToolsCorePlugin} instance.
   */
  coreApi() {
    return this._coreApi;
  }
  // #endregion
  // #region Utilities for subclasses
  /**
   * Transforms a logical data point (timestamp/price) into pixel screen coordinates.
   *
   * Uses unified logical-to-coordinate interpolation to ensure timeframe immunity 
   * and bypass native API decimal bugs.
   *
   * @param point - The logical point to convert.
   * @returns A Point with screen coordinates, or null.
   */
  pointToScreenPoint(point) {
    const logicalIndex = interpolateLogicalIndexFromTime(this._chart, this._series, point.timestamp);
    if (logicalIndex === null) return null;
    const x = logicalIndexToCoordinate(this._chart.timeScale(), logicalIndex);
    const y = this._series.priceToCoordinate(point.price);
    if (x === null || y === null || !isFinite(x) || isNaN(x) || isNaN(y)) {
      return null;
    }
    return new Point(x, y);
  }
  /**
   * Transforms a pixel screen coordinate into a logical data point (timestamp/price).
   *
   * This method is the inverse of `pointToScreenPoint` and is primarily used by the
   * {@link InteractionManager} to determine the final logical coordinates of a user click or drag.
   *
   * @param point - The {@link Point} with screen coordinates.
   * @returns A logical {@link LineToolPoint}, or `null` if conversion fails.
   */
  screenPointToPoint(point) {
    const timeScale = this._chart.timeScale();
    const rawPrice = this._series.coordinateToPrice(point.y);
    const logical = timeScale.coordinateToLogical(point.x);
    if (logical === null || rawPrice === null) {
      return null;
    }
    const options = this._series.options();
    const minMove = options?.priceFormat?.minMove || 0.01;
    const finalPrice = roundPriceToStep(rawPrice, minMove);
    const interpolatedTime = interpolateTimeFromLogicalIndex(this._chart, this._series, logical);
    if (interpolatedTime === null) {
      console.warn(`[BaseLineTool] screenPointToPoint: Could not determine interpolated time for screen point: ${JSON.stringify(point)}.`);
      return null;
    }
    return {
      timestamp: this._horzScaleBehavior.key(interpolatedTime),
      price: finalPrice
    };
  }
  /**
   * Sets the internal array of pane view components.
   *
   * This protected method is called by the concrete line tool's `constructor` or `updateAllViews`
   * to define what graphical elements (lines, shapes, text, etc.) will be rendered.
   *
   * @param views - An array of {@link IUpdatablePaneView} instances.
   * @protected
   */
  _setPaneViews(views) {
    this._paneViews = views;
  }
  /**
   * Assigns the tool's final and complete configuration options.
   *
   * Concrete tool implementations use this during construction, ensuring the base class
   * always holds a unique, finalized options object.
   *
   * @param finalOptions - The complete options object.
   * @protected
   */
  _setupOptions(finalOptions) {
    this._options = finalOptions;
  }
  // #endregion
  /**
   * Cleans up and releases all resources held by the line tool instance.
   *
   * This is the final internal cleanup hook called by the {@link LineToolsCorePlugin} when the tool is removed.
   * It ensures memory safety by:
   * 1. Unregistering all price axis labels from the stacking manager.
   * 2. Clearing all internal view and point references.
   * 3. Nullifying the price scale.
   *
   * @returns void
   */
  destroy() {
    this._isDestroying = true;
    this._triggerChartUpdate();
    this._priceAxisLabelViews.forEach((view) => {
      if (view instanceof LineToolPriceAxisLabelView) {
        this._priceAxisLabelStackingManager.unregisterLabel(this.id() + "-p" + view.getPointIndex());
      }
    });
    this._priceAxisLabelStackingManager.updateStacking();
    this._paneViews.forEach((paneView) => {
      const renderer = paneView.renderer();
      if (renderer && renderer.clear) {
        renderer.clear();
      }
    });
    this._paneViews = [];
    this._points = [];
    this._lastPoint = null;
    this.setPriceScale(null);
    this._selected = false;
    this._hovered = false;
    this._editing = false;
    this._creating = false;
    this._editedPointIndex = null;
    this._currentPoint = new Point(0, 0);
  }
  /**
   * Triggers a chart update (redraw) via the internal `requestUpdate` callback.
   *
   * This is the standard mechanism for the tool to force the chart to redraw itself
   * after a state change that affects its visual output.
   *
   * @internal
   * @returns void
   */
  _triggerChartUpdate() {
    if (this._requestUpdate && !this._isDestroying) {
      this._requestUpdate();
    }
  }
  /**
   * Implements the `IDataSource` method for the base value.
   *
   * For line tools, this typically has no meaning and returns 0.
   *
   * @returns The base value (0).
   */
  base() {
    return 0;
  }
  /**
   * Provides autoscale information for the primitive, implementing the `IDataSource` contract.
   *
   * By default, line tools do not influence the chart's autoscale range, and this method returns `null`.
   * Tools that need to affect the autoscale (e.g., specialized markers) must override this.
   *
   * @param startTimePoint - The logical index of the start of the visible range.
   * @param endTimePoint - The logical index of the end of the visible range.
   * @returns An {@link AutoscaleInfo} object if the tool affects the scale, or `null`.
   */
  autoscaleInfo(startTimePoint, endTimePoint) {
    return null;
  }
  /**
   * Implements the `IDataSource` method for providing the price scale's first value.
   *
   * This is primarily used for features like percentage-based price scales. For general line tools,
   * this is typically not applicable.
   *
   * @returns The {@link FirstValue} object, or `null`.
   */
  firstValue() {
    return null;
  }
  /**
   * Provides an {@link IPriceFormatter} for this tool, implementing the `IDataSource` contract.
   *
   * This is usually a no-op formatter as the underlying series' formatter is preferred.
   *
   * @returns A basic {@link IPriceFormatter} implementation.
   */
  formatter() {
    return {
      format: (price) => price.toString(),
      // Basic string conversion for format
      formatTickmarks: (prices) => prices.map((p) => p.toString())
      // Basic string conversion for tickmarks
    };
  }
  /**
   * Implements the `IDataSource` method to provide a price line color.
   *
   * This is typically not used for line tools and returns an empty string.
   *
   * @param lastBarColor - The color of the last bar in the series (unused).
   * @returns An empty string.
   */
  priceLineColor(lastBarColor) {
    return "";
  }
  /**
   * OPTIONAL: Indicates if dragging the first anchor point (index 0) of an unbounded tool (e.g., Brush)
   * should be treated as a full tool translation (move) rather than just a point edit.
   *
   * This is used by the {@link InteractionManager} to distinguish the drag behavior of tools like Brush vs. Path.
   *
   * @returns `true` if dragging anchor 0 should translate the whole tool, `false` otherwise.
   */
  anchor0TriggersTranslation() {
    return false;
  }
  /**
   * OPTIONAL: Hook for tools that finalize creation on a double-click (e.g., Path tool).
   *
   * This allows the tool to perform specific cleanup (like removing the last "rogue" point added
   * on the final single click before the double-click) before the creation process concludes.
   *
   * @returns The instance of the tool (for method chaining).
   */
  handleDoubleClickFinalization() {
    return this;
  }
  /**
   * Returns the method a user must employ to signal the end of the tool's creation process.
   *
   * Concrete tools must override this if they don't finalize automatically when `pointsCount` is reached.
   *
   * @returns The required {@link FinalizationMethod} (e.g., `MouseUp`, `DoubleClick`, or `PointCount`).
   */
  getFinalizationMethod() {
    return "pointCount" /* PointCount */;
  }
  /**
   * Retrieves the complete array of permanent points that should be translated when the tool is moved.
   *
   * This is used by the {@link InteractionManager} to get a stable snapshot of all points
   * for calculating logical translation vectors.
   *
   * @returns An array of permanent {@link LineToolPoint}s.
   */
  getPermanentPointsForTranslation() {
    return [...this._points];
  }
  /**
   * Clears the temporary "ghost" point (`_lastPoint`), ensuring it is no longer rendered.
   *
   * This is called by the {@link InteractionManager} upon finalization of the tool's creation.
   *
   * @returns void
   */
  clearGhostPoint() {
    this._lastPoint = null;
  }
  /**
   * Retrieves the pixel width of the chart's drawing area, excluding the Price Axis.
   * 
   * This utilizes the unified layout engine in the Core Plugin to ensure 
   * high-performance, layout-thrashing-free access to dimensions.
   * 
   * @returns The current width in pixels.
   */
  getChartDrawingWidth() {
    return this._coreApi.getLayout().width;
  }
  /**
   * Retrieves the pixel height of the specific chart pane this tool is attached to.
   * 
   * This method automatically identifies the tool's parent pane from the 
   * unified layout snapshot using its series reference.
   * 
   * @returns The specific pane height in pixels.
   */
  getChartDrawingHeight() {
    const layout = this._coreApi.getLayout();
    const myPane = layout.panes.find((p) => p.series.indexOf(this._series) !== -1);
    return myPane ? myPane.height : 0;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/rendering/line-anchor-renderer.ts
import { LineStyle as LineStyle2 } from "lightweight-charts";
var interactionTolerance = {
  //anchor: 5, // Pixel tolerance for clicking on an anchor
  anchor: 8
};
var AnchorPoint = class _AnchorPoint extends Point {
  /**
   * Initializes a new Anchor Point.
   *
   * @param x - The X-coordinate in pixels.
   * @param y - The Y-coordinate in pixels.
   * @param data - The index of this point in the parent tool's point array.
   * @param square - If `true`, the anchor is drawn as a square; otherwise, it is a circle.
   * @param specificCursor - An optional, specific cursor to display when hovering over this anchor.
   */
  constructor(x, y, data, square = false, specificCursor) {
    super(x, y);
    __publicField(this, "data");
    __publicField(this, "square");
    __publicField(this, "specificCursor");
    this.data = data;
    this.square = square;
    this.specificCursor = specificCursor;
  }
  /**
   * Creates a deep copy of the anchor point, preserving all metadata.
   * @returns A new {@link AnchorPoint} instance.
   */
  clone() {
    return new _AnchorPoint(this.x, this.y, this.data, this.square, this.specificCursor);
  }
};
var LineAnchorRenderer = class {
  /**
   * Initializes the Anchor Renderer.
   *
   * @param chart - The Lightweight Charts chart API instance (for context/API access).
   * @param data - Optional initial {@link LineAnchorRendererData} to set.
   */
  constructor(chart, data) {
    /**
     * Internal data payload.
     * @internal
     */
    __publicField(this, "_data", null);
    __publicField(this, "_chart");
    this._chart = chart;
    this._data = data ?? null;
  }
  /**
   * Overwrites the entire data payload for the renderer.
   * @param data - The new {@link LineAnchorRendererData}.
   * @returns void
   */
  setData(data) {
    this._data = data;
  }
  /**
   * Partially updates the current data payload by merging a set of changes.
   * @param data - A partial update object for the {@link LineAnchorRendererData}.
   * @returns void
   */
  updateData(data) {
    if (this._data) {
      this._data = merge(this._data, data);
    }
  }
  /**
   * Draws all configured anchor points (circles or squares) onto the chart pane.
   *
   * It uses helper drawing functions (`drawCircleBody`, `drawRectBody`) to render
   * the main handle and applies special effects (shadows/halos) if the anchor is hovered.
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @returns void
   */
  draw(target) {
    if (!this._data || !this._data.visible) {
      return;
    }
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const squarePoints = [];
      const squareColors = [];
      const circlePoints = [];
      const circleColors = [];
      for (let e = 0; e < this._data.points.length; ++e) {
        const point = this._data.points[e];
        const color = this._data.backgroundColors[e];
        if (point.square) {
          squarePoints.push(point);
          squareColors.push(color);
        } else {
          circlePoints.push(point);
          circleColors.push(color);
        }
      }
      ctx.strokeStyle = this._data.color;
      if (squarePoints.length) {
        this._drawPoints(ctx, squarePoints, squareColors, drawRectBody, drawRectShadow);
      }
      if (circlePoints.length) {
        this._drawPoints(ctx, circlePoints, circleColors, drawCircleBody, drawCircleShadow);
      }
    });
  }
  /**
   * Performs a hit test specifically over the anchor points.
   *
   * This logic uses an augmented radius (`this._data.radius + interactionTolerance.anchor`)
   * to create a larger, forgiving target area for the user to click/drag.
   * It determines the specific anchor index hit and the appropriate cursor type (e.g., 'resize').
   *
   * @param x - The X coordinate for the hit test.
   * @param y - The Y coordinate for the hit test.
   * @returns A {@link HitTestResult} containing the anchor index and cursor, or `null`.
   */
  hitTest(x, y) {
    if (this._data === null) {
      return null;
    }
    const position = new Point(x, y);
    const hitThreshold = this._data.radius + interactionTolerance.anchor;
    for (let i = 0; i < this._data.points.length; ++i) {
      const point = this._data.points[i];
      const distance = point.subtract(position).length();
      if (distance <= hitThreshold) {
        let suggestedCursor = "default" /* Default */;
        if (point.specificCursor) {
          suggestedCursor = point.specificCursor;
        } else if (this._data.defaultAnchorHoverCursor) {
          suggestedCursor = this._data.defaultAnchorHoverCursor;
        } else if (this._data.hitTestType === 4 /* ChangePoint */) {
          suggestedCursor = "nwse-resize" /* DiagonalNwSeResize */;
        } else {
          suggestedCursor = "pointer" /* Pointer */;
        }
        const pointIndex = point.data;
        return new HitTestResult(this._data.hitTestType, { pointIndex, suggestedCursor });
      }
    }
    return null;
  }
  /**
   * Internal helper to iterate over a list of points (either circles or squares) and draw their bodies and hover shadows.
   *
   * This abstracts the logic for drawing the shape itself (`drawBody`) and applying the hover effect (`drawShadow`).
   *
   * @param ctx - The CanvasRenderingContext2D.
   * @param points - The array of {@link AnchorPoint}s to draw.
   * @param colors - The array of corresponding background colors.
   * @param drawBody - The callback function to draw the main body of the shape.
   * @param drawShadow - The callback function to draw the hover shadow/halo.
   * @private
   */
  _drawPoints(ctx, points, colors, drawBody, drawShadow) {
    const data = this._data;
    const currentPoint = data.currentPoint;
    let lineWidth = Math.max(1, Math.floor(data.strokeWidth || 2));
    if (data.selected) {
      lineWidth += 1;
    }
    const radius = data.radius * 2;
    for (let d = 0; d < points.length; ++d) {
      const point = points[d];
      ctx.fillStyle = colors[d];
      if (!(Number.isInteger(point.data) && data.editedPointIndex === point.data)) {
        drawBody(ctx, point, radius / 2, lineWidth);
        if (point.subtract(currentPoint).length() <= data.radius + interactionTolerance.anchor) {
          const hoveredLineWidth = Math.max(1, data.hoveredStrokeWidth);
          drawShadow(ctx, point, radius / 2, hoveredLineWidth);
        }
      }
    }
  }
};
function drawRect(ctx, point, radius, lineWidth) {
  ctx.lineWidth = lineWidth;
  const n = radius + lineWidth / 2;
  drawRoundRect(ctx, point.x - n, point.y - n, 2 * n, 2 * n, (radius + lineWidth) / 2, LineStyle2.Solid);
  ctx.closePath();
}
function drawRectShadow(ctx, point, radius, lineWidth) {
  ctx.globalAlpha = 0.2;
  drawRect(ctx, point, radius, lineWidth);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawRectBody(ctx, point, radius, lineWidth) {
  drawRect(ctx, point, radius - lineWidth, lineWidth);
  ctx.fill();
  ctx.stroke();
}
function drawCircleShadow(ctx, point, radius, lineWidth) {
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius + lineWidth / 2, 0, 2 * Math.PI, true);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawCircleBody(ctx, point, radius, lineWidth) {
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius - lineWidth / 2, 0, 2 * Math.PI, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// vendor/difurious/lightweight-charts-line-tools-core/src/rendering/generic-renderers.ts
import { LineStyle as LineStyle3 } from "lightweight-charts";
var interactionTolerance2 = {
  line: 4
  // Make the line hit-test a bit more forgiving
};
var SegmentRenderer = class {
  /**
   * Initializes the Segment Renderer.
   *
   * @param hitTest - An optional, pre-configured {@link HitTestResult} template that will be returned on a successful hit.
   */
  constructor(hitTest) {
    __publicField(this, "_data", null);
    __publicField(this, "_mediaSize", { width: 0, height: 0 });
    __publicField(this, "_hitTest");
    this._hitTest = hitTest || new HitTestResult(2 /* MovePoint */);
  }
  /**
   * Sets the data payload required to draw and hit-test the segment.
   *
   * @param data - The {@link SegmentRendererData} containing the points and styling options.
   * @returns void
   */
  setData(data) {
    this._data = data;
  }
  /**
   * Draws the line segment onto the chart pane.
   *
   * This method calculates any necessary line extensions or viewport clipping before drawing
   * the final segment, ensuring that the line stays within the visible area.
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @returns void
   */
  draw(target) {
    if (!this._data || !this._data.points || this._data.points.length < 2) {
      return;
    }
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      this._mediaSize = mediaSize;
      const { line: line2, points } = this._data;
      const [point0, point1] = points;
      const lineWidth = line2.width || 1;
      const lineColor = line2.color || "white";
      const lineStyle = line2.style || LineStyle3.Solid;
      ctx.lineCap = line2.cap || "butt";
      ctx.lineJoin = line2.join || "miter";
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      setLineStyle(ctx, lineStyle);
      this._drawEnds(ctx, points, lineWidth, lineStyle);
      const extendedClippedSegment = extendAndClipLineSegment(
        point0,
        point1,
        mediaSize.width,
        mediaSize.height,
        !!line2.extend?.left,
        // Convert boolean to real boolean
        !!line2.extend?.right
        // Convert boolean to real boolean
      );
      if (extendedClippedSegment !== null && lineWidth > 0) {
        if (extendedClippedSegment instanceof Point) {
          return;
        }
        const [start, end] = extendedClippedSegment;
        if (start.x === end.x) {
          drawVerticalLine(ctx, start.x, start.y, end.y);
        } else if (start.y === end.y) {
          drawHorizontalLine(ctx, start.y, start.x, end.x);
        } else {
          drawLine(ctx, start.x, start.y, end.x, end.y, lineStyle);
        }
      }
    });
  }
  /**
   * Performs a hit test along the entire rendered path of the line segment.
   *
   * This includes any extended or clipped portions of the line, providing a large enough
   * tolerance to make clicking on the line easy.
   *
   * @param x - The X coordinate for the hit test.
   * @param y - The Y coordinate for the hit test.
   * @returns A {@link HitTestResult} if the coordinates are within the line's tolerance, otherwise `null`.
   */
  hitTest(x, y) {
    if (!this._data || this._data.points.length < 2 || !this._mediaSize.width || !this._mediaSize.height) {
      return null;
    }
    const { line: line2, points, toolDefaultHoverCursor } = this._data;
    const [point0, point1] = points;
    const extendedClippedSegment = extendAndClipLineSegment(
      point0,
      point1,
      this._mediaSize.width,
      this._mediaSize.height,
      !!line2.extend?.left,
      !!line2.extend?.right
    );
    if (extendedClippedSegment === null) {
      return null;
    }
    if (extendedClippedSegment instanceof Point) {
      if (extendedClippedSegment.subtract(new Point(x, y)).length() <= interactionTolerance2.line) {
        const suggestedCursor = toolDefaultHoverCursor || "pointer" /* Pointer */;
        return new HitTestResult(this._hitTest.type(), { pointIndex: null, suggestedCursor });
      }
      return null;
    }
    const [start, end] = extendedClippedSegment;
    if (distanceToSegment(start, end, new Point(x, y)).distance <= interactionTolerance2.line) {
      const suggestedCursor = toolDefaultHoverCursor || "pointer" /* Pointer */;
      return new HitTestResult(this._hitTest.type(), { pointIndex: null, suggestedCursor });
    }
    return null;
  }
  /**
   * Helper method to draw the decorative end caps (Arrow, Circle) specified in the `LineOptions`.
   *
   * This is performed before the main line segment to ensure Z-order correctness.
   *
   * @param ctx - The CanvasRenderingContext2D.
   * @param points - The two defining points of the line.
   * @param width - The line width for sizing the end caps.
   * @param style - The line style, passed for correct arrow dashing consistency.
   * @private
   */
  _drawEnds(ctx, points, width, style) {
    const lineOptions = this._data?.line;
    if (!lineOptions) return;
    if (lineOptions.end?.left === 1 /* Arrow */) {
      drawArrowEnd(points[1], points[0], ctx, width, style);
    } else if (lineOptions.end?.left === 2 /* Circle */) {
      drawCircleEnd(points[0], ctx, width);
    }
    if (lineOptions.end?.right === 1 /* Arrow */) {
      drawArrowEnd(points[0], points[1], ctx, width, style);
    } else if (lineOptions.end?.right === 2 /* Circle */) {
      drawCircleEnd(points[1], ctx, width);
    }
  }
};
var RectangleRenderer = class {
  /**
   * Initializes the Rectangle Renderer.
   *
   * @param hitTest - An optional, pre-configured {@link HitTestResult} template that will be returned on a successful hit.
   */
  constructor(hitTest) {
    __publicField(this, "_data", null);
    __publicField(this, "_mediaSize", { width: 0, height: 0 });
    __publicField(this, "_hitTest");
    this._hitTest = hitTest || new HitTestResult(2 /* MovePoint */);
  }
  /**
   * Sets the data payload required to draw and hit-test the rectangle.
   *
   * @param data - The {@link RectangleRendererData} containing the points and styling options.
   * @returns void
   */
  setData(data) {
    this._data = data;
  }
  /**
   * Draws the rectangle onto the chart pane, handling background fill, borders, and horizontal extensions.
   *
   * This relies on the core `fillRectWithBorder` canvas helper for drawing the shape with proper pixel alignment.
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @returns void
   */
  draw(target) {
    if (!this._data || this._data.points.length < 2) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      this._mediaSize = mediaSize;
      const { border, background, extend, points } = this._data;
      const [point0, point1] = points;
      const borderWidth = border?.width || 0;
      const borderColor = border?.color;
      const backgroundColor = background?.color;
      const borderStyle = border?.style || LineStyle3.Solid;
      const borderRadius = border?.radius || 0;
      if (borderWidth <= 0 && !backgroundColor) return;
      fillRectWithBorder(
        ctx,
        point0,
        point1,
        backgroundColor,
        borderColor,
        borderWidth,
        borderStyle,
        borderRadius,
        "center",
        // Border alignment, often 'center' for rects
        !!extend?.left,
        !!extend?.right,
        mediaSize.width
      );
    });
  }
  /**
   * Performs a hit test on the four border segments and the optional background fill area of the rectangle.
   *
   * It correctly accounts for horizontal extensions when checking the top and bottom borders.
   *
   * @param x - The X coordinate for the hit test.
   * @param y - The Y coordinate for the hit test.
   * @returns A {@link HitTestResult} if the rectangle is hit, otherwise `null`.
   */
  hitTest(x, y) {
    if (!this._data || this._data.points.length < 2 || !this._mediaSize.width || !this._mediaSize.height) {
      return null;
    }
    const { extend, points, hitTestBackground, toolDefaultHoverCursor, toolDefaultDragCursor } = this._data;
    const [point0, point1] = points;
    const minX = Math.min(point0.x, point1.x);
    const maxX = Math.max(point0.x, point1.x);
    const minY = Math.min(point0.y, point1.y);
    const maxY = Math.max(point0.y, point1.y);
    const clickedPoint = new Point(x, y);
    const lineTolerance = interactionTolerance2.line;
    const topLeft = new Point(minX, minY);
    const topRight = new Point(maxX, minY);
    const bottomLeft = new Point(minX, maxY);
    const bottomRight = new Point(maxX, maxY);
    const suggestedHoverCursor = toolDefaultHoverCursor || "pointer" /* Pointer */;
    const htTopLeft = new Point(extend?.left ? 0 : minX, minY);
    const htTopRight = new Point(extend?.right ? this._mediaSize.width : maxX, minY);
    if (distanceToSegment(htTopLeft, htTopRight, clickedPoint).distance <= lineTolerance) {
      return new HitTestResult(2 /* MovePoint */, { pointIndex: null, suggestedCursor: suggestedHoverCursor });
    }
    const htBottomLeft = new Point(extend?.left ? 0 : minX, maxY);
    const htBottomRight = new Point(extend?.right ? this._mediaSize.width : maxX, maxY);
    if (distanceToSegment(htBottomLeft, htBottomRight, clickedPoint).distance <= lineTolerance) {
      return new HitTestResult(2 /* MovePoint */, { pointIndex: null, suggestedCursor: suggestedHoverCursor });
    }
    if (distanceToSegment(topLeft, bottomLeft, clickedPoint).distance <= lineTolerance) {
      return new HitTestResult(2 /* MovePoint */, { pointIndex: null, suggestedCursor: suggestedHoverCursor });
    }
    if (distanceToSegment(topRight, bottomRight, clickedPoint).distance <= lineTolerance) {
      return new HitTestResult(2 /* MovePoint */, { pointIndex: null, suggestedCursor: suggestedHoverCursor });
    }
    if (hitTestBackground && pointInBox(clickedPoint, new Box(topLeft, bottomRight))) {
      const suggestedDragCursor = toolDefaultDragCursor || "grabbing" /* Grabbing */;
      return new HitTestResult(3 /* MovePointBackground */, { pointIndex: null, suggestedCursor: suggestedDragCursor });
    }
    return null;
  }
};
var TextRenderer = class {
  // Still needed for screen dimensions
  /**
   * Initializes the Text Renderer.
   *
   * @param hitTest - An optional, pre-configured {@link HitTestResult} template.
   */
  constructor(hitTest) {
    __publicField(this, "_internalData", null);
    __publicField(this, "_polygonPoints", null);
    __publicField(this, "_linesInfo", null);
    __publicField(this, "_fontInfo", null);
    __publicField(this, "_boxSize", null);
    // _data is already present from previous implementation
    __publicField(this, "_data", null);
    __publicField(this, "_forceInvalidate", false);
    __publicField(this, "_hitTest");
    // Uses LineToolHitTestData now
    __publicField(this, "_mediaSize", { width: 0, height: 0 });
    this._hitTest = hitTest || new HitTestResult(2 /* MovePoint */);
  }
  /**
   * Forces the renderer to ignore its internal cache during the next setData call.
   */
  forceInvalidate() {
    this._forceInvalidate = true;
  }
  /**
   * Sets the data payload required to draw and hit-test the text.
   *
   * This method includes logic to invalidate internal caches only when the relevant 
   * parts of the new data differ from the old data, or if a manual invalidation 
   * has been requested via forceInvalidate().
   *
   * @param data - The {@link TextRendererData} containing the content and styling.
   * @returns void
   */
  setData(data) {
    function checkUnchanged(before, after) {
      if (null === before || null === after) {
        return before === after;
      }
      if (before.points === void 0 !== (after.points === void 0)) {
        return false;
      }
      if (before.points !== void 0 && after.points !== void 0) {
        if (before.points.length !== after.points.length) {
          return false;
        }
        for (let i = 0; i < before.points.length; ++i) {
          if (before.points[i].x !== after.points[i].x || before.points[i].y !== after.points[i].y) {
            return false;
          }
        }
      }
      return before.text?.forceCalculateMaxLineWidth === after.text?.forceCalculateMaxLineWidth && before.text?.forceTextAlign === after.text?.forceTextAlign && before.text?.wordWrapWidth === after.text?.wordWrapWidth && before.text?.padding === after.text?.padding && before.text?.value === after.text?.value && before.text?.alignment === after.text?.alignment && before.text?.font?.bold === after.text?.font?.bold && before.text?.font?.size === after.text?.font?.size && before.text?.font?.family === after.text?.font?.family && before.text?.font?.italic === after.text?.font?.italic && before.text?.box?.angle === after.text?.box?.angle && before.text?.box?.scale === after.text?.box?.scale && before.text?.box?.offset?.x === after.text?.box?.offset?.x && before.text?.box?.offset?.y === after.text?.box?.offset?.y && before.text?.box?.maxHeight === after.text?.box?.maxHeight && before.text?.box?.padding?.x === after.text?.box?.padding?.x && before.text?.box?.padding?.y === after.text?.box?.padding?.y && before.text?.box?.alignment?.vertical === after.text?.box?.alignment?.vertical && before.text?.box?.alignment?.horizontal === after.text?.box?.alignment?.horizontal && before.text?.box?.background?.inflation?.x === after.text?.box?.background?.inflation?.x && before.text?.box?.background?.inflation?.y === after.text?.box?.background?.inflation?.y && before.text?.box?.border?.highlight === after.text?.box?.border?.highlight && JSON.stringify(before.text?.box?.border?.radius) === JSON.stringify(after.text?.box?.border?.radius) && before.toolDefaultHoverCursor === after.toolDefaultHoverCursor && before.toolDefaultDragCursor === after.toolDefaultDragCursor && before.hitTestBackground === after.hitTestBackground;
    }
    if (!this._forceInvalidate && checkUnchanged(this._data, data)) {
      this._data = data;
    } else {
      this._data = data;
      this._forceInvalidate = false;
      this._polygonPoints = null;
      this._internalData = null;
      this._linesInfo = null;
      this._fontInfo = null;
      this._boxSize = null;
    }
  }
  /**
   * Performs a hit test on the text box area.
   *
   * The logic first checks if the point falls inside the rotated box polygon and then checks proximity
   * to the box's border segments. A border hit suggests moving the parent tool anchor(s), and an
   * internal hit suggests dragging the entire text box (translation).
   *
   * @param x - The X coordinate for the hit test.
   * @param y - The Y coordinate for the hit test.
   * @returns A {@link HitTestResult} if the text box is hit, otherwise `null`.
   */
  hitTest(x, y) {
    if (this._data === null || this._data.points === void 0 || this._data.points.length === 0) {
      return null;
    }
    const hitPoint = new Point(x, y);
    const { text, toolDefaultHoverCursor, toolDefaultDragCursor, hitTestBackground } = this._data;
    const polygonPoints = this._getPolygonPoints();
    const isInsidePolygon = pointInPolygon(hitPoint, polygonPoints);
    const borderWidth = text.box?.border?.width || 0;
    const borderHitTolerance = 4;
    let isNearBorder = false;
    for (let i = 0; i < polygonPoints.length; i++) {
      const p1 = polygonPoints[i];
      const p2 = polygonPoints[(i + 1) % polygonPoints.length];
      const distance = distanceToSegment(p1, p2, hitPoint).distance;
      if (distance <= borderWidth + borderHitTolerance) {
        isNearBorder = true;
        break;
      }
    }
    if (isNearBorder) {
      const suggestedCursor = toolDefaultHoverCursor || "pointer" /* Pointer */;
      return new HitTestResult(2 /* MovePoint */, { pointIndex: null, suggestedCursor });
    }
    if (isInsidePolygon && hitTestBackground) {
      const suggestedCursor = toolDefaultDragCursor || "grabbing" /* Grabbing */;
      return new HitTestResult(3 /* MovePointBackground */, { pointIndex: null, suggestedCursor });
    }
    return null;
  }
  /**
   * Calculates and retrieves the final pixel dimensions of the rendered text box.
   *
   * @returns The {@link BoxSize} (width and height) of the rendered element.
   */
  measure() {
    if (this._data === null) {
      return { width: 0, height: 0 };
    }
    return this._getBoxSize();
  }
  /**
   * Retrieves the bounding rectangle (x, y, width, height) of the text box in screen coordinates.
   *
   * This uses the cached internal data for position and size.
   *
   * @returns An object containing the top-left coordinate, width, and height of the bounding box.
   */
  rect() {
    if (this._data === null) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const internalData = this._getInternalData();
    return { x: internalData.boxLeft, y: internalData.boxTop, width: internalData.boxWidth, height: internalData.boxHeight };
  }
  /**
   * Determines if the entire text box is positioned off-screen.
   *
   * This check first uses a simple AABB comparison and then, for more robust culling of rotated boxes,
   * checks if all four corners of the rotated polygon are outside the viewport.
   *
   * @param width - The width of the visible pane area.
   * @param height - The height of the visible pane area.
   * @returns `true` if the text box is entirely off-screen, `false` otherwise.
   */
  isOutOfScreen(width, height) {
    if (null === this._data || void 0 === this._data.points || 0 === this._data.points.length) {
      return true;
    }
    const internalData = this._getInternalData();
    if (internalData.boxLeft + internalData.boxWidth < 0 || internalData.boxLeft > width) {
      const screenBox = new Box(new Point(0, 0), new Point(width, height));
      return this._getPolygonPoints().every((point) => !pointInBox(point, screenBox));
    }
    return false;
  }
  /**
   * Retrieves the cached CSS font string used for rendering and measurement (e.g., 'bold 12px sans-serif').
   *
   * @returns The computed font style string.
   */
  fontStyle() {
    return this._data === null ? "" : this._getFontInfo().fontStyle;
  }
  /**
   * Executes the word-wrapping logic for a given string, font, and maximum line width.
   *
   * This is primarily a proxy for the external `textWrap` utility function.
   *
   * @param test - The raw string content to wrap.
   * @param wrapWidth - The maximum pixel width for a single line before wrapping.
   * @param font - Optional font string to use for measurement.
   * @returns An array of strings representing the final, wrapped lines.
   */
  wordWrap(test, wrapWidth, font) {
    return textWrap(test, font || this.fontStyle(), wrapWidth);
  }
  /**
   * Draws the complete text box element onto the chart pane.
   *
   * This method:
   * 1. Saves the canvas context and applies rotation/translation transforms based on the box's configuration.
   * 2. Draws the shadow, background fill, and border.
   * 3. Draws each of the wrapped text lines.
   * 4. Restores the canvas context.
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @returns void
   */
  draw(target) {
    if (this._data === null || this._data.points === void 0 || this._data.points.length === 0) {
      return;
    }
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      this._mediaSize = mediaSize;
      const cssWidth = mediaSize.width;
      const cssHeight = mediaSize.height;
      if (this.isOutOfScreen(cssWidth, cssHeight)) {
        return;
      }
      const data = ensureNotNull(this._data);
      const textData = ensureNotNull(data.text);
      const internalData = this._getInternalData();
      const pivot = internalData.rotationPivot;
      const angleDegrees = textData.box?.angle || 0;
      const angle = -angleDegrees * Math.PI / 180;
      ctx.save();
      ctx.translate(pivot.x, pivot.y);
      ctx.rotate(angle);
      ctx.translate(-pivot.x, -pivot.y);
      const scaledBoxLeft = internalData.boxLeft;
      const scaledBoxTop = internalData.boxTop;
      const scaledBoxWidth = internalData.boxWidth;
      const scaledBoxHeight = internalData.boxHeight;
      const borderRadius = textData.box?.border?.radius || 0;
      const boxBorderStyle = textData.box?.border?.style || LineStyle3.Solid;
      let shadowApplied = false;
      if (textData.box?.shadow) {
        const shadow = textData.box.shadow;
        if (shadow.blur > 0 || !isFullyTransparent(shadow.color)) {
          ctx.shadowColor = shadow.color;
          ctx.shadowBlur = shadow.blur;
          ctx.shadowOffsetX = shadow.offset.x;
          ctx.shadowOffsetY = shadow.offset.y;
          shadowApplied = true;
        }
      }
      if (textData.box?.background?.color && !isFullyTransparent(textData.box.background.color)) {
        ctx.fillStyle = textData.box.background.color;
        drawRoundRect(ctx, scaledBoxLeft, scaledBoxTop, scaledBoxWidth, scaledBoxHeight, borderRadius, boxBorderStyle);
        ctx.fill();
      }
      if (shadowApplied) {
        ctx.shadowColor = "rgba(0, 0, 0, 0)";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      if ((textData.box?.border?.width || 0) > 0 && textData.box?.border?.color && !isFullyTransparent(textData.box.border.color)) {
        ctx.strokeStyle = textData.box.border.color;
        ctx.lineWidth = textData.box.border.width;
        drawRoundRect(ctx, scaledBoxLeft, scaledBoxTop, scaledBoxWidth, scaledBoxHeight, borderRadius, boxBorderStyle);
        ctx.stroke();
      }
      ctx.fillStyle = textData.font?.color;
      ctx.font = this._getFontInfo().fontStyle;
      const alignValue = internalData.textAlign;
      let canvasAlign;
      if (alignValue === "center" /* Center */) {
        canvasAlign = "center";
      } else if (alignValue === "end" /* End */ || alignValue === "right" /* Right */) {
        canvasAlign = "right";
      } else {
        canvasAlign = "left";
      }
      ctx.textAlign = canvasAlign;
      ctx.textBaseline = "middle";
      const { lines } = this._getLinesInfo();
      const linePadding = getScaledPadding(data);
      const scaledFontSize = getScaledFontSize(data);
      const extraSpace = 0.05 * scaledFontSize;
      let currentTextY = internalData.boxTop + internalData.textTop + extraSpace;
      for (const line2 of lines) {
        const textX = internalData.boxLeft + internalData.textStart;
        ctx.fillText(line2, textX, currentTextY);
        currentTextY += scaledFontSize + linePadding;
      }
      ctx.restore();
    });
  }
  // #region Private/Protected Helper Methods (from V3.8)
  /**
   * Calculates and caches the master internal state (`InternalData`) for positioning and drawing.
   *
   * This is a heavy calculation that:
   * 1. Determines the final position (`boxLeft`, `boxTop`) based on the tool's anchor points and text box alignment/offset.
   * 2. Determines the text alignment and start position within the box.
   * 3. Calculates the `rotationPivot`.
   *
   * @returns The cached {@link InternalData} object.
   * @private
   */
  _getInternalData() {
    if (this._internalData !== null) {
      return this._internalData;
    }
    const data = ensureNotNull(this._data);
    const paddingX = getScaledBoxPaddingX(data);
    const paddingY = getScaledBoxPaddingY(data);
    const inflationPaddingX = getScaledBackgroundInflationX(data) + paddingX;
    const inflationPaddingY = getScaledBackgroundInflationY(data) + paddingY;
    const isDegenerate = data.points && data.points.length >= 2 && equalPoints(data.points[0], data.points[1]);
    if (!data.points || data.points.length < 2 || isDegenerate) {
      const boxSize2 = this._getBoxSize();
      const boxWidth2 = boxSize2.width;
      const boxHeight2 = boxSize2.height;
      const defaultAnchor = data.points && data.points.length > 0 ? data.points[0] : new Point(0, 0);
      const paddingX2 = getScaledBoxPaddingX(data);
      const paddingY2 = getScaledBoxPaddingY(data);
      const inflationPaddingX2 = getScaledBackgroundInflationX(data) + paddingX2;
      const inflationPaddingY2 = getScaledBackgroundInflationY(data) + paddingY2;
      let refX2 = defaultAnchor.x;
      let refY2 = defaultAnchor.y;
      let textBoxFinalX2 = refX2;
      let textBoxFinalY2 = refY2;
      switch ((data.text?.box?.alignment?.horizontal || "").toLowerCase()) {
        case "left":
          textBoxFinalX2 = refX2;
          break;
        case "center":
          textBoxFinalX2 = refX2 - boxWidth2 / 2;
          break;
        case "right":
          textBoxFinalX2 = refX2 - boxWidth2;
          break;
      }
      switch ((data.text?.box?.alignment?.vertical || "").toLowerCase()) {
        case "top":
          textBoxFinalY2 = refY2 - boxHeight2;
          break;
        case "middle":
          textBoxFinalY2 = refY2 - boxHeight2 / 2;
          break;
        case "bottom":
          textBoxFinalY2 = refY2;
          break;
      }
      textBoxFinalX2 += data.text?.box?.offset?.x || 0;
      textBoxFinalY2 += data.text?.box?.offset?.y || 0;
      const rawAlignment2 = (ensureDefined(data.text?.alignment) || "start").toLowerCase().trim();
      let textStart = inflationPaddingX2;
      let textAlign2 = "start" /* Start */;
      switch (rawAlignment2) {
        case "start" /* Start */:
        case "left" /* Left */: {
          textAlign2 = "start" /* Start */;
          textStart = inflationPaddingX2;
          if (isRtl()) {
            if (data.text?.forceTextAlign) {
              textAlign2 = "start" /* Start */;
            } else {
              textStart = boxWidth2 - inflationPaddingX2;
              textAlign2 = "end" /* End */;
            }
          }
          break;
        }
        case "center" /* Center */: {
          textAlign2 = "center" /* Center */;
          textStart = boxWidth2 / 2;
          break;
        }
        case "end" /* End */:
        case "right" /* Right */: {
          textAlign2 = "end" /* End */;
          textStart = boxWidth2 - inflationPaddingX2;
          if (isRtl() && data.text?.forceTextAlign) {
            textAlign2 = "end" /* End */;
          }
          break;
        }
        default: {
          console.warn(`[TextRenderer] Unknown text alignment "${data.text?.alignment}" in fallback; defaulting to Start.`);
          textStart = inflationPaddingX2;
          textAlign2 = "start" /* Start */;
        }
      }
      const textTop = inflationPaddingY2 + getScaledFontSize(data) / 2;
      const rotationPivot2 = defaultAnchor;
      this._internalData = {
        boxLeft: textBoxFinalX2,
        boxTop: textBoxFinalY2,
        boxWidth: boxWidth2,
        boxHeight: boxHeight2,
        textAlign: textAlign2,
        textTop,
        textStart,
        rotationPivot: rotationPivot2
      };
      return this._internalData;
    }
    const [rectPointA, rectPointB] = data.points;
    const rectMinX = Math.min(rectPointA.x, rectPointB.x);
    const rectMaxX = Math.max(rectPointA.x, rectPointB.x);
    const rectMinY = Math.min(rectPointA.y, rectPointB.y);
    const rectMaxY = Math.max(rectPointA.y, rectPointB.y);
    const boxSize = this._getBoxSize();
    const boxWidth = boxSize.width;
    const boxHeight = boxSize.height;
    let refX = 0;
    let refY = 0;
    switch ((data.text?.box?.alignment?.horizontal || "").toLowerCase()) {
      case "left" /* Left */:
        refX = rectMinX;
        break;
      case "center" /* Center */:
        refX = (rectMinX + rectMaxX) / 2;
        break;
      case "right" /* Right */:
        refX = rectMaxX;
        break;
    }
    switch ((data.text?.box?.alignment?.vertical || "").toLowerCase()) {
      case "top" /* Top */:
        refY = rectMinY;
        break;
      case "middle" /* Middle */:
        refY = (rectMinY + rectMaxY) / 2;
        break;
      case "bottom" /* Bottom */:
        refY = rectMaxY;
        break;
    }
    const rotationPivot = new Point(refX, refY);
    let textBoxFinalX = refX;
    let textBoxFinalY = refY;
    switch ((data.text?.box?.alignment?.horizontal || "").toLowerCase()) {
      case "left" /* Left */:
        textBoxFinalX = refX;
        break;
      case "center" /* Center */:
        textBoxFinalX = refX - boxWidth / 2;
        break;
      case "right" /* Right */:
        textBoxFinalX = refX - boxWidth;
        break;
    }
    switch ((data.text?.box?.alignment?.vertical || "").toLowerCase()) {
      case "top" /* Top */:
        textBoxFinalY = refY - boxHeight;
        break;
      case "middle" /* Middle */:
        textBoxFinalY = refY - boxHeight / 2;
        break;
      case "bottom" /* Bottom */:
        textBoxFinalY = refY;
        break;
    }
    textBoxFinalX += data.text?.box?.offset?.x || 0;
    textBoxFinalY += data.text?.box?.offset?.y || 0;
    const rawAlignment = (ensureDefined(data.text?.alignment) || "start").toLowerCase().trim();
    let textX = inflationPaddingX;
    let textAlign = "start" /* Start */;
    switch (rawAlignment) {
      case "start":
      case "left": {
        textAlign = "start" /* Start */;
        textX = inflationPaddingX;
        if (isRtl()) {
          if (data.text?.forceTextAlign) {
            textAlign = "start" /* Start */;
          } else {
            textX = boxWidth - inflationPaddingX;
            textAlign = "end" /* End */;
          }
        }
        break;
      }
      case "center": {
        textAlign = "center" /* Center */;
        textX = boxWidth / 2;
        break;
      }
      case "end":
      case "right": {
        textAlign = "end" /* End */;
        textX = boxWidth - inflationPaddingX;
        if (isRtl() && data.text?.forceTextAlign) {
          textAlign = "end" /* End */;
        }
        break;
      }
      default: {
        console.warn(`[TextRenderer] Unknown text alignment "${data.text?.alignment}"; defaulting to Start (padded left).`);
        textX = inflationPaddingX;
      }
    }
    const textY = inflationPaddingY + getScaledFontSize(data) / 2;
    this._internalData = {
      boxLeft: textBoxFinalX,
      boxTop: textBoxFinalY,
      boxWidth,
      boxHeight,
      textAlign,
      textTop: textY,
      // Offset from box top to text middle
      textStart: textX,
      // Offset from box left to text start
      rotationPivot
    };
    return this._internalData;
  }
  /**
   * Calculates the maximum pixel width among all wrapped lines of text.
   *
   * If word wrap is configured, this uses the fixed `wordWrapWidth` instead of measuring.
   *
   * @param lines - The array of wrapped text strings.
   * @returns The maximum width in pixels.
   * @private
   */
  _getLinesMaxWidth(lines) {
    const data = ensureNotNull(this._data);
    createCacheCanvas();
    const ctx = ensureNotNull(cacheCanvas);
    ctx.font = this.fontStyle();
    if (data.text?.wordWrapWidth && !data.text?.forceCalculateMaxLineWidth) {
      return data.text.wordWrapWidth * getFontAwareScale(data);
    }
    let maxWidth = 0;
    for (const line2 of lines) {
      maxWidth = Math.max(maxWidth, ctx.measureText(line2).width);
    }
    return maxWidth;
  }
  /**
   * Calculates and caches the {@link LinesInfo} structure.
   *
   * This performs the word wrapping, checks for max height constraints (truncating lines if necessary),
   * and calculates the max line width.
   *
   * @returns The cached {@link LinesInfo} object.
   * @private
   */
  _getLinesInfo() {
    if (null === this._linesInfo) {
      const data = ensureNotNull(this._data);
      let lines = textWrap(ensureDefined(data.text?.value), this.fontStyle(), data.text?.wordWrapWidth);
      if (data.text?.box?.maxHeight !== void 0 && data.text.box.maxHeight > 0) {
        const maxHeight = ensureDefined(data.text?.box?.maxHeight);
        const scaledFontSize = getScaledFontSize(data);
        const scaledPadding = getScaledPadding(data);
        const lineHeightWithSpacing = scaledFontSize + scaledPadding;
        let maxLines;
        if (lineHeightWithSpacing > 0) {
          maxLines = Math.floor((maxHeight + scaledPadding) / lineHeightWithSpacing);
        } else {
          maxLines = Infinity;
        }
        if (lines.length > maxLines) {
          lines = lines.slice(0, maxLines);
        }
      }
      this._linesInfo = { linesMaxWidth: this._getLinesMaxWidth(lines), lines };
    }
    return this._linesInfo;
  }
  /**
   * Calculates and caches the {@link FontInfo} structure, including the final CSS font string and pixel size.
   *
   * This is used once to configure the drawing context and repeatedly for text width measurement.
   *
   * @returns The cached {@link FontInfo} object.
   * @private
   */
  _getFontInfo() {
    if (this._fontInfo === null) {
      const data = ensureNotNull(this._data);
      const fontSize = getScaledFontSize(data);
      const fontStyle = (data.text?.font?.bold ? "bold " : "") + (data.text?.font?.italic ? "italic " : "") + fontSize + "px " + ensureDefined(data.text?.font?.family);
      this._fontInfo = { fontStyle, fontSize };
    }
    return this._fontInfo;
  }
  /**
   * Calculates and caches the total pixel dimensions of the text box.
   *
   * This uses the results of `_getLinesInfo` and the configured padding/inflation options.
   *
   * @returns The cached {@link BoxSize} object.
   * @private
   */
  _getBoxSize() {
    if (null === this._boxSize) {
      const linesInfo = this._getLinesInfo();
      const data = ensureNotNull(this._data);
      this._boxSize = {
        width: getBoxWidth(data, linesInfo.linesMaxWidth),
        height: getBoxHeight(data, linesInfo.lines.length)
      };
    }
    return this._boxSize;
  }
  /**
   * Calculates and caches the four corner points of the rotated text box bounding polygon in screen coordinates.
   *
   * This polygon is the basis for accurate hit testing on the rotated element.
   *
   * @returns An array of four {@link Point} objects defining the rotated bounding box.
   * @private
   */
  _getPolygonPoints() {
    if (null !== this._polygonPoints) {
      return this._polygonPoints;
    }
    if (null === this._data) {
      return [];
    }
    const { boxLeft, boxTop, boxWidth, boxHeight } = this._getInternalData();
    const pivot = this._getRotationPoint();
    const angleDegrees = this._data.text?.box?.angle || 0;
    const angle = -angleDegrees * Math.PI / 180;
    this._polygonPoints = [
      rotatePoint(new Point(boxLeft, boxTop), pivot, angle),
      rotatePoint(new Point(boxLeft + boxWidth, boxTop), pivot, angle),
      rotatePoint(new Point(boxLeft + boxWidth, boxTop + boxHeight), pivot, angle),
      rotatePoint(new Point(boxLeft, boxTop + boxHeight), pivot, angle)
    ];
    return this._polygonPoints;
  }
  /**
   * Retrieves the pivot point in screen coordinates around which the text box is rotated.
   *
   * This point is calculated and stored in the internal data cache by `_getInternalData`.
   *
   * @returns A {@link Point} object representing the rotation pivot.
   * @private
   */
  _getRotationPoint() {
    const internalData = this._getInternalData();
    return internalData.rotationPivot;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/rendering/composite-renderer.ts
var CompositeRenderer = class {
  constructor() {
    __publicField(this, "_renderers", []);
  }
  /**
   * Appends a renderer to the composite.
   *
   * Renderers are drawn in the order they are appended, from first to last.
   *
   * @param renderer - The {@link IPaneRenderer} to add.
   * @returns void
   */
  append(renderer) {
    this._renderers.push(renderer);
  }
  /**
   * Clears all contained renderers from the composite.
   *
   * This is typically used by views when updating, to rebuild the set of renderers
   * needed for the current tool state.
   *
   * @returns void
   */
  clear() {
    this._renderers.length = 0;
  }
  /**
   * Checks if the composite contains any renderers.
   * @returns `true` if no renderers are present, `false` otherwise.
   */
  isEmpty() {
    return this._renderers.length === 0;
  }
  /**
   * Draws all contained renderers in sequence using the provided rendering target.
   *
   * @param target - The {@link CanvasRenderingTarget2D} provided by Lightweight Charts.
   * @returns void
   */
  draw(target) {
    if (this.isEmpty()) {
      return;
    }
    this._renderers.forEach((renderer) => {
      renderer.draw(target);
    });
  }
  /**
   * Performs a hit test by querying all contained renderers in reverse order (topmost first).
   *
   * This simulates the Z-order stack. If multiple renderers are hit, the result from the
   * one closest to the top of the stack will be returned.
   *
   * @param x - The X coordinate for the hit test.
   * @param y - The Y coordinate for the hit test.
   * @returns The {@link HitTestResult} of the topmost hit renderer, or `null` if nothing is hit.
   */
  hitTest(x, y) {
    for (let i = this._renderers.length - 1; i >= 0; i--) {
      const renderer = this._renderers[i];
      if (renderer.hitTest) {
        const hitResult = renderer.hitTest(x, y);
        if (hitResult !== null) {
          return hitResult;
        }
      }
    }
    return null;
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/views/line-tool-pane-view.ts
var LineToolPaneView = class {
  /**
   * Initializes the Pane View.
   * 
   * @param tool - The specific line tool model.
   * @param chart - The chart API instance.
   * @param series - The series API instance.
   */
  constructor(tool, chart, series) {
    /**
     * Reference to the specific line tool model instance this view represents.
     * Provides access to the tool's options, points, and state.
     * @protected
     */
    __publicField(this, "_tool");
    /**
     * Reference to the Lightweight Charts API instance.
     * Used for coordinate conversions and accessing chart options.
     * @protected
     */
    __publicField(this, "_chart");
    /**
     * Reference to the series API instance the tool is attached to.
     * Used for price-to-coordinate conversions.
     * @protected
     */
    __publicField(this, "_series");
    /**
     * Internal cache of the tool's points converted to screen coordinates (pixels).
     * These are recalculated whenever `_updatePoints` is called.
     * @protected
     */
    __publicField(this, "_points", []);
    // Screen coordinates of the tool's defining points
    /**
     * Dirty flag indicating if the view's data is out of sync with the model.
     * If `true`, `_updateImpl` will be called during the next render cycle.
     * @protected
     */
    __publicField(this, "_invalidated", true);
    // Flag to indicate if the view needs updating
    /**
     * Collection of renderers responsible for drawing the interactive anchor points (handles).
     * These are reused to avoid unnecessary object creation.
     * @protected
     */
    __publicField(this, "_lineAnchorRenderers", []);
    // Renderers for the tool's anchor points
    /**
     * The main composite renderer for this view.
     * It aggregates all specific renderers (shape, text, anchors) into a single draw call.
     * @protected
     */
    __publicField(this, "_renderer");
    /**
     * A reusable renderer instance for drawing rectangular shapes or backgrounds.
     * @protected
     */
    __publicField(this, "_rectangleRenderer");
    /**
     * A reusable renderer instance for drawing text labels.
     * @protected
     */
    __publicField(this, "_labelRenderer");
    this._tool = tool;
    this._chart = chart;
    this._series = series;
    this._renderer = new CompositeRenderer();
    this._rectangleRenderer = new RectangleRenderer();
    this._labelRenderer = new TextRenderer();
  }
  /**
   * Updates the series reference used for price-to-coordinate conversions.
   * 
   * This is called by the `BaseLineTool` when it is attached/re-attached to a series.
   * It is critical for multi-pane setups where series instances might be swapped.
   * 
   * @param series - The fresh ISeriesApi instance.
   */
  updateSeries(series) {
    this._series = series;
    this._invalidated = true;
  }
  /**
   * Signals that the view's data or options have changed.
   * 
   * Sets the `_invalidated` flag to `true`, forcing a recalculation of geometry
   * and render data during the next paint cycle.
   * 
   * @param updateType - The type of update (e.g., 'data', 'options').
   */
  update(updateType) {
    this._invalidated = true;
    if (updateType === "options") {
      this._labelRenderer.forceInvalidate();
    }
  }
  /**
  * Retrieves the renderer for the current frame.
  * 
  * This override optimizes performance by utilizing the tool's micro-cached 
  * dimensions instead of hitting the DOM directly during the update cycle.
  * 
  * @returns The {@link IPaneRenderer} to be drawn, or `null` if nothing should be rendered.
  * @override
  */
  renderer() {
    if (this._tool._isDestroying) {
      return null;
    }
    if (this._invalidated) {
      const height = this._tool.getChartDrawingHeight();
      const width = this._tool.getChartDrawingWidth();
      if (height <= 0 || width <= 0) {
        this._renderer.clear();
        return null;
      }
      this._updateImpl(height, width);
      this._invalidated = false;
    }
    return this._renderer;
  }
  /**
   * Converts the tool's logical points (Time/Price) into screen coordinates (Pixels).
   * 
   * This method accesses the chart's time scale and the series' price scale to perform
   * the conversion. It populates the `_points` array.
   * 
   * @returns `true` if all points were successfully converted, `false` if scale data is missing.
   * @protected
   */
  _updatePoints() {
    const timeScaleApi = this._chart.timeScale();
    const priceScale = this._tool.priceScale();
    if (timeScaleApi.getVisibleLogicalRange() === null || !priceScale) {
      return false;
    }
    this._points = [];
    const sourcePoints = this._tool.points();
    for (let i = 0; i < sourcePoints.length; i++) {
      const point = this._tool.pointToScreenPoint(sourcePoints[i]);
      if (!point) {
        return false;
      }
      point.data = i;
      this._points.push(point);
    }
    return true;
  }
  /**
   * The core update logic for the view.
   * 
   * This method is called when the view is invalidated. It is responsible for:
   * 1. Clearing the composite renderer.
   * 2. Updating point coordinates via `_updatePoints`.
   * 3. Constructing the specific renderers (lines, shapes) required for the tool's current state.
   * 4. Adding interaction anchors if applicable.
   * 
   * @param height - The current height of the pane in pixels.
   * @param width - The current width of the pane in pixels.
   * @protected
   */
  _updateImpl(height, width) {
    this._renderer.clear();
    if (!this._tool.options().visible) {
      return;
    }
    if (this._updatePoints()) {
      if (this.areAnchorsVisible() && this._points.length > 0) {
        this._addAnchors(this._renderer);
      }
    }
  }
  /**
   * Determines if the tool's interaction anchors (resize handles) should be visible.
   * 
   * Anchors are typically shown when the tool is selected, hovered, being edited,
   * or currently being drawn (not finished).
   * 
   * @returns `true` if anchors should be drawn.
   * @protected
   */
  areAnchorsVisible() {
    return this._tool.isHovered() || this._tool.isSelected() || this._tool.isEditing() || !this._tool.isFinished();
  }
  /**
   * Adds anchor renderers to the composite renderer.
   * 
   * This method is intended to be overridden or used by subclasses to place
   * resize handles at specific points (e.g., corners of a rectangle, ends of a line).
   * 
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   */
  _addAnchors(renderer) {
  }
  /**
   * Factory method to create or recycle a `LineAnchorRenderer`.
   * 
   * It configures the anchor with standard styling (colors, hit test logic) and
   * specific interaction data (index, cursor type).
   * 
   * @param data - Configuration data for the anchor (points, cursors).
   * @param index - The index in the internal renderer array (for recycling).
   * @returns A configured {@link LineAnchorRenderer}.
   * @protected
   */
  createLineAnchor(data, index) {
    let renderer = this._lineAnchorRenderers[index];
    if (!renderer) {
      renderer = new LineAnchorRenderer(this._chart);
      this._lineAnchorRenderers.push(renderer);
    }
    const toolOptions = this._tool.options();
    renderer.setData({
      ...data,
      radius: 4,
      // Compact terminal-style resize handle
      strokeWidth: 1,
      // Default stroke width
      color: "#1E53E5",
      // Default color (blue)
      hoveredStrokeWidth: 4,
      // Default hovered stroke width
      selected: this._tool.isSelected(),
      visible: this.areAnchorsVisible(),
      currentPoint: this._tool.currentPoint(),
      // Mouse position
      backgroundColors: this._lineAnchorColors(data.points),
      // Colors for anchors' backgrounds
      editedPointIndex: this._tool.isEditing() ? this._tool.editedPointIndex() : null,
      hitTestType: 4 /* ChangePoint */
      // Default hit test type for anchors
    });
    return renderer;
  }
  /**
   * Helper to determine the background color for anchor points.
   * 
   * By default, it attempts to match the chart's background color to make hollow
   * anchors look transparent or blend in. Subclasses can override this for custom styling.
   * 
   * @param points - The list of anchor points.
   * @returns An array of color strings corresponding to each point.
   * @protected
   */
  _lineAnchorColors(points) {
    const chartOptions = this._chart.options();
    const backgroundColor = chartOptions.layout.background;
    const defaultAnchorColor = backgroundColor.type === "solid" ? backgroundColor.color : "rgba(0, 0, 0, 0)";
    return points.map((point) => defaultAnchorColor);
  }
};

// vendor/difurious/lightweight-charts-line-tools-core/src/index.ts
function createLineToolsPlugin(chart, series) {
  try {
    if (!chart || typeof chart.timeScale !== "function") {
      throw new Error("A valid Lightweight Charts chart instance must be provided.");
    }
    if (!series || typeof series.priceScale !== "function") {
      throw new Error("A valid Lightweight Charts series instance must be provided.");
    }
    console.log("Initializing Line Tools Core Plugin...");
    const horzScaleBehavior = chart.horzBehaviour();
    const plugin = new LineToolsCorePlugin(chart, series, horzScaleBehavior);
    return plugin;
  } catch (error) {
    console.error("Failed to initialize Line Tools Core Plugin:", error.message);
    return createDummyPluginApi();
  }
}

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolTrendLine.ts
import {
  LineStyle as LineStyle4
} from "lightweight-charts";

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolTrendLinePaneView.ts
var LineToolTrendLinePaneView = class extends LineToolPaneView {
  /**
   * Initializes the Trend Line View.
   *
   * @param source - The specific Trend Line model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    __publicField(this, "_segmentRenderer", new SegmentRenderer());
    __publicField(this, "_textRenderer", new TextRenderer());
  }
  /**
   * Retrieves the internal `SegmentRenderer` instance used to draw the main line.
   *
   * This can be useful for derived classes (like `LineToolArrowPaneView`) if they need
   * to inspect or modify the renderer's state directly, though usually configuration is done via options.
   *
   * @returns The active {@link SegmentRenderer}.
   */
  getSegmentRenderer() {
    return this._segmentRenderer;
  }
  /**
   * Retrieves the final `CompositeRenderer` for the current render cycle.
   *
   * **Architecture Note:**
   * This override ensures that `_updateImpl` is called if the view is marked as invalidated.
   * This "lazy update" pattern ensures that expensive geometry calculations (like text rotation
   * or culling) only happen once per frame, just before drawing.
   *
   * @returns The fully configured {@link IPrimitivePaneRenderer}, or `null` if nothing should be drawn.
   * @override
   */
  renderer() {
    if (this._invalidated) {
      this._updateImpl(0, 0);
    }
    return this._renderer;
  }
  /**
   * The core update logic for the Trend Line View.
   *
   * This method is responsible for translating the tool's data model into visual renderers.
   * It performs visibility checks (culling), coordinates conversion, and configures
   * the sub-renderers (Segment and Text) based on the current options.
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const options = this._tool.options();
    if (!options.visible) {
      return;
    }
    if (this._tool.points().length < this._tool.pointsCount) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints) {
      return;
    }
    const [point0, point1] = this._points;
    const segmentPoints = [point0, point1];
    const lineOptions = deepCopy(options.line);
    lineOptions.join = lineOptions.join || "miter" /* Miter */;
    lineOptions.cap = lineOptions.cap || "butt" /* Butt */;
    this._segmentRenderer.setData({
      points: segmentPoints,
      line: lineOptions,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    });
    this._renderer.append(this._segmentRenderer);
    if (options.text.value) {
      const [point02, point12] = this._points;
      let textLocationPoint;
      const horizontalAlignment = (options.text.box?.alignment?.horizontal || "").toLowerCase();
      if (horizontalAlignment === "left" /* Left */.toLowerCase()) {
        textLocationPoint = point02;
      } else if (horizontalAlignment === "right" /* Right */.toLowerCase()) {
        textLocationPoint = point12;
      } else {
        const lineMidpointX = (point02.x + point12.x) / 2;
        const lineMidpointY = (point02.y + point12.y) / 2;
        textLocationPoint = new AnchorPoint(lineMidpointX, lineMidpointY, 0);
      }
      const textAttachmentPoint = textLocationPoint;
      const dx = point12.x - point02.x;
      const dy = point12.y - point02.y;
      const angleRadians = Math.atan2(dy, dx);
      const finalAngleRadians = -angleRadians;
      const lineSlopeAngleDegrees = finalAngleRadians * (180 / Math.PI);
      const userAngleOffsetDegrees = options.text.box?.angle || 0;
      const finalCumulativeAngleDegrees = lineSlopeAngleDegrees + userAngleOffsetDegrees;
      const textOptions = deepCopy(options.text);
      textOptions.box = { ...textOptions.box, angle: finalCumulativeAngleDegrees };
      const textRendererData = {
        // Text box dimensions are defined by the area between these two points.
        // For text attached to a point, we use two identical points.
        points: [textAttachmentPoint, textAttachmentPoint],
        text: textOptions,
        // Set up hit testing for the text box area
        hitTestBackground: true,
        toolDefaultHoverCursor: options.defaultHoverCursor,
        toolDefaultDragCursor: options.defaultDragCursor
      };
      this._textRenderer.setData(textRendererData);
      this._renderer.append(this._textRenderer);
    }
    this._addAnchors(this._renderer);
  }
  /**
   * Adds the interactive anchor points (handles) to the renderer.
   *
   * For a Trend Line, this places two handles:
   * - One at the Start Point (P0).
   * - One at the End Point (P1).
   *
   * It assigns the `DiagonalNwSeResize` cursor to both, indicating to the user that
   * these points can be dragged freely in 2D space.
   *
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 2) return;
    const [point0, point1] = this._points;
    const anchorData = {
      points: [point0, point1],
      pointsCursorType: ["nwse-resize" /* DiagonalNwSeResize */, "nwse-resize" /* DiagonalNwSeResize */]
    };
    renderer.append(this.createLineAnchor(anchorData, 0));
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolTrendLine.ts
var TrendLineOptionDefaults = {
  visible: true,
  editable: true,
  defaultHoverCursor: "pointer" /* Pointer */,
  defaultDragCursor: "grabbing" /* Grabbing */,
  defaultAnchorHoverCursor: "pointer" /* Pointer */,
  defaultAnchorDragCursor: "grabbing" /* Grabbing */,
  notEditableCursor: "not-allowed" /* NotAllowed */,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  // Specific Options for TrendLineToolOptions
  line: {
    width: 1,
    color: "#2962ff",
    // default blue
    style: LineStyle4.Solid,
    extend: { left: false, right: false },
    end: { left: 0 /* Normal */, right: 0 /* Normal */ }
  },
  text: {
    value: "",
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false,
    alignment: "center" /* Center */,
    font: { family: "sans-serif", color: "#2962ff", size: 12, bold: false, italic: false },
    box: {
      scale: 1,
      angle: 0,
      alignment: { vertical: "middle" /* Middle */, horizontal: "center" /* Center */ }
      // Default box and shadow options
    }
  }
  // Ensure the structure of TextOptions is complete if TextToolOptions requires it
};
var LineToolTrendLine = class extends BaseLineTool {
  /**
   * Initializes the Trend Line tool.
   *
   * **Tutorial Note on Logic:**
   * 1. It starts with the `TrendLineOptionDefaults`.
   * 2. It merges any user-provided `options` on top.
   * 3. It instantiates the specific `LineToolTrendLinePaneView`, which handles the actual canvas rendering.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior for time conversion.
   * @param options - Configuration overrides.
   * @param points - Initial points (if restoring state).
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      "TrendLine",
      2,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('TrendLine').
     *
     * @override
     */
    __publicField(this, "toolType", "TrendLine");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Trend Line always consists of exactly **2 points** (Start and End).
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolTrendLinePaneView(this, this._chart, this._series)]);
  }
  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * Since `pointsCount` is 2, the valid indices are 0 and 1. Therefore, the maximum index is 1.
   * The `InteractionManager` uses this to ensure it tracks drag gestures for both ends of the line.
   *
   * @override
   * @returns `1`
   */
  maxAnchorIndex() {
    return 1;
  }
  /**
   * Confirms that this tool can be created via the "Click-Click" method.
   *
   * **Interaction Flow:**
   * 1. User clicks once to set the Start Point (P1).
   * 2. User moves the mouse (ghost line follows).
   * 3. User clicks again to set the End Point (P2).
   *
   * @override
   * @returns `true`
   */
  supportsClickClickCreation() {
    return true;
  }
  /**
   * Confirms that this tool can be created via the "Click-Drag" method.
   *
   * **Interaction Flow:**
   * 1. User presses mouse down to set the Start Point (P1).
   * 2. User drags the mouse while holding the button.
   * 3. User releases the mouse button to set the End Point (P2).
   *
   * @override
   * @returns `true`
   */
  supportsClickDragCreation() {
    return true;
  }
  /**
   * Enables geometric constraints (Shift key) during "Click-Click" creation.
   *
   * If `true`, holding Shift while hovering to place the second point will lock the line
   * to specific angles (e.g., horizontal, vertical, or 45-degree increments).
   *
   * @override
   * @returns `true`
   */
  supportsShiftClickClickConstraint() {
    return true;
  }
  /**
   * Enables geometric constraints (Shift key) during "Click-Drag" creation.
   *
   * If `true`, holding Shift while dragging to place the second point will lock the line
   * to specific angles.
   *
   * @override
   * @returns `true`
   */
  supportsShiftClickDragConstraint() {
    return true;
  }
  /**
   * Implements the specific geometric constraint logic when the user holds the Shift key while drawing or editing.
   *
   * **Tutorial Note:**
   * For a standard Trend Line, holding Shift triggers a **Price Lock** (Horizontal Lock).
   * 1. It identifies the "Anchor Point" (the point *not* being moved).
   * 2. It takes the Y-coordinate (Price) of that anchor.
   * 3. It forces the point being moved to align with that Y-coordinate.
   *
   * This allows users to easily draw perfectly horizontal lines by holding Shift.
   *
   * @param pointIndex - The index of the point being moved (0 or 1).
   * @param rawScreenPoint - The actual mouse position on screen.
   * @param phase - Whether we are creating the tool or editing an existing one.
   * @param originalLogicalPoint - The logical position of the point being moved before the drag started.
   * @param allOriginalLogicalPoints - The state of all points before the drag started.
   * @returns A result containing the constrained screen point and a hint ('price') that we snapped to a specific price level.
   * @override
   */
  getShiftConstrainedPoint(pointIndex, rawScreenPoint, phase, originalLogicalPoint, allOriginalLogicalPoints) {
    let constraintSourceLogicalPoint = null;
    if (phase === "creation" /* Creation */) {
      constraintSourceLogicalPoint = originalLogicalPoint;
    } else {
      const otherPointIndex = pointIndex === 0 ? 1 : 0;
      constraintSourceLogicalPoint = allOriginalLogicalPoints[otherPointIndex];
    }
    if (!constraintSourceLogicalPoint) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    const constraintSourceScreenPoint = this.pointToScreenPoint(constraintSourceLogicalPoint);
    if (!constraintSourceScreenPoint) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    const constrainedY = constraintSourceScreenPoint.y;
    return {
      point: new Point(rawScreenPoint.x, constrainedY),
      snapAxis: "price"
    };
  }
  /**
   * Updates the logical coordinates of a specific anchor point.
   *
   * While this implementation currently delegates directly to the base class, overriding it here
   * allows the Trend Line to intercept point updates if custom validation logic were needed in the future.
   *
   * @param index - The index of the point to update (0 or 1).
   * @param point - The new logical coordinates.
   * @override
   */
  setPoint(index, point) {
    super.setPoint(index, point);
  }
  /**
   * Performs the hit test to see if the mouse is hovering over this tool.
   *
   * **Architecture Note:**
   * The **Model** (this class) knows *data* (time/price), but it doesn't know *pixels* (where lines are drawn).
   * The **View** (`LineToolTrendLinePaneView`) knows pixels.
   *
   * Therefore, this method retrieves the active Pane View and asks its **Composite Renderer**
   * to perform the hit test. This ensures that what the user *sees* is exactly what they *click*.
   *
   * @param x - X coordinate in pixels.
   * @param y - Y coordinate in pixels.
   * @returns A hit result if the mouse is over the line or an anchor, otherwise `null`.
   * @override
   */
  _internalHitTest(x, y) {
    if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
      return null;
    }
    const paneView = this._paneViews[0];
    const compositeRenderer = paneView.renderer();
    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null;
    }
    const hitResult = compositeRenderer.hitTest(x, y);
    return hitResult;
  }
  /**
  	 * Calculates the Trend Line's visibility based on its geometric points and potential extensions.
  	 * 
  	 * ### Tutorial Note on Trend Line Culling
  	 * A Trend Line can be a simple finite segment, a Ray (infinite in one direction), or 
  	 * an Extended Line (infinite in both directions). 
  	 * 
  	 * Because these tools can exist "on-screen" even when their anchor points are "off-screen" 
  	 * (e.g., a Ray passing through the viewport from a distance), we cannot use a simple 
  	 * bounding box check.
  	 * 
  	 * This method passes the `options.line.extend` flags to the core culling engine. 
  	 * This instructs the engine to use robust parametric clipping math (Slab-Clipping) 
  
  	 * to determine if any part of the infinite line projection intersects the current viewport.
  	 * 
  	 * @protected
  	 * @override
  	 */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    const cullingState = getToolCullingState(
      points,
      this,
      options.line.extend
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolExtendedLinePaneView.ts
var LineToolExtendedLinePaneView = class extends LineToolTrendLinePaneView {
  /**
   * Initializes the Extended Line View.
   *
   * @param source - The specific Extended Line model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
  }
  // NOTE: No need to override the renderer() or _updateImpl() if the parent correctly
  // reads and uses the tool's options() which now contains the 'extend: { left: true, right: true }' property.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolExtendedLine.ts
var ExtendedLineSpecificOverrides = {
  line: {
    extend: { left: true, right: true }
  }
};
var LineToolExtendedLine = class extends LineToolTrendLine {
  // Still a 2-point tool
  /**
   * Initializes the Extended Line tool.
   *
   * **Tutorial Note on Option Merging:**
   * 1. **Base Defaults:** Start with `TrendLineOptionDefaults`.
   * 2. **Subclass Overrides:** Merge `ExtendedLineSpecificOverrides` to force `extend: { left: true, right: true }`.
   * 3. **User Options:** Merge the `options` passed by the user.
   *
   * This setup ensures the line extends infinitely by default, but still allows the user to
   * customize other aspects like color, width, or text.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(ExtendedLineSpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('ExtendedLine').
     *
     * @override
     */
    __publicField(this, "toolType", "ExtendedLine");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * An Extended Line requires exactly **2 points** to define the slope and position of the infinite line.
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolExtendedLinePaneView(this, this._chart, this._series)]);
    console.log(`ExtendedLine Tool created with ID: ${this.id()}`);
  }
  // NOTE: All core logic (hitTest, shift constraints, normalize) is inherited from LineToolTrendLine.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolArrowPaneView.ts
var LineToolArrowPaneView = class extends LineToolTrendLinePaneView {
  /**
   * Initializes the Arrow Pane View.
   *
   * @param source - The specific Arrow model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
  }
  // NOTE: No need to override the renderer() or _updateImpl() as the parent's logic is fully reusable.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolArrow.ts
var ArrowSpecificOverrides = {
  line: {
    end: { right: 1 /* Arrow */ }
    // Key change: Arrow end on the right side
  }
};
var LineToolArrow = class extends LineToolTrendLine {
  // Still a 2-point tool
  /**
   * Initializes the Arrow tool.
   *
   * **Tutorial Note on Option Merging:**
   * This constructor demonstrates the correct hierarchy for applying options in a derived tool:
   * 1. **Base Defaults:** Start with `TrendLineOptionDefaults` to get standard line/text settings.
   * 2. **Subclass Overrides:** Merge `ArrowSpecificOverrides` (which sets `line.end.right = LineEnd.Arrow`).
   * 3. **User Options:** Merge the `options` passed by the user.
   *
   * This order ensures that the Arrow always looks like an arrow by default, but the user
   * still has the final say (e.g., they could theoretically turn off the arrow tip via options).
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(ArrowSpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('Arrow').
     *
     * @override
     */
    __publicField(this, "toolType", "Arrow");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * Like its parent Trend Line, an Arrow is defined by exactly **2 points** (Tail and Head).
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolArrowPaneView(this, this._chart, this._series)]);
    console.log(`Arrow Tool created with ID: ${this.id()}`);
  }
  // NOTE: All core logic (hitTest, shift constraints, normalize) is inherited from LineToolTrendLine.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolRayPaneView.ts
var LineToolRayPaneView = class extends LineToolTrendLinePaneView {
  /**
   * Initializes the Ray View.
   *
   * @param source - The specific Ray model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
  }
  // NOTE: No need to override the renderer() or _updateImpl() as the parent's logic is fully reusable.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolRay.ts
var RaySpecificOverrides = {
  line: {
    extend: { right: true }
    // Key change: Extended to the right
  }
};
var LineToolRay = class extends LineToolTrendLine {
  // Still a 2-point tool
  /**
   * Initializes the Ray tool.
   *
   * **Tutorial Note on Construction:**
   * 1. **Base Defaults:** Start with `TrendLineOptionDefaults`.
   * 2. **Subclass Overrides:** Merge `RaySpecificOverrides` (forcing `extend.right = true`).
   * 3. **User Options:** Merge the `options` passed by the user.
   *
   * **View Assignment:**
   * It assigns the `LineToolRayPaneView`. While this view currently acts just like a TrendLine view,
   * using a specific class allows future customization of how the Ray is rendered (e.g., adding
   * a specific end-cap only to the infinite end) without breaking the standard Trend Line.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(RaySpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('Ray').
     *
     * @override
     */
    __publicField(this, "toolType", "Ray");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * Like the Trend Line, a Ray is defined by exactly **2 points** (Origin and Direction).
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolRayPaneView(this, this._chart, this._series)]);
    console.log(`Ray Tool created with ID: ${this.id()}`);
  }
  // NOTE: All core logic (hitTest, shift constraints, normalize) is inherited from LineToolTrendLine.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolHorizontalLinePaneView.ts
var LineToolHorizontalLinePaneView = class extends LineToolPaneView {
  /**
   * Internal renderer for the optional text label.
   * @protected
   */
  //testing removal
  //protected _textRenderer: TextRenderer<HorzScaleItem> = new TextRenderer();
  /**
   * Initializes the Horizontal Line View.
   *
   * @param source - The specific Horizontal Line model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    /**
     * Internal renderer for the main horizontal line segment.
     * @protected
     */
    __publicField(this, "_lineRenderer", new SegmentRenderer());
  }
  /**
   * The core update logic for the Horizontal Line View.
   *
   * It translates the single logical anchor point into a horizontal segment.
   * To prevent directional flipping in the buffer zone, we provide a stable 
   * 1-pixel vector and utilize the renderer's internal extension engine.
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const options = this._tool.options();
    if (!options.visible) {
      return;
    }
    const points = this._tool.points();
    if (points.length === 0) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints) {
      return;
    }
    const [anchorPoint] = this._points;
    const anchorX = anchorPoint.x;
    const lineY = anchorPoint.y;
    const paneDrawingWidth = this._tool.getChartDrawingWidth();
    const { left: extendLeft, right: extendRight } = options.line.extend;
    const startX = extendLeft ? 0 : anchorX;
    const endX = extendRight ? paneDrawingWidth : anchorX;
    const finalStartX = startX;
    const finalEndX = Math.max(endX, startX + 1);
    const leftPoint = new AnchorPoint(finalStartX, lineY, 0);
    const rightPoint = new AnchorPoint(finalEndX, lineY, 1);
    const lineOptions = deepCopy(options.line);
    lineOptions.join = lineOptions.join || "miter" /* Miter */;
    lineOptions.cap = lineOptions.cap || "butt" /* Butt */;
    this._lineRenderer.setData({
      points: [leftPoint, rightPoint],
      line: lineOptions,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    });
    this._renderer.append(this._lineRenderer);
    if (options.text.value) {
      const horizontalAlignment = (options.text.box?.alignment?.horizontal || "").toLowerCase();
      const paneDrawingWidth2 = this._tool.getChartDrawingWidth();
      const { left: extendLeft2, right: extendRight2 } = options.line.extend;
      const visualStartX = extendLeft2 ? 0 : anchorX;
      const visualEndX = extendRight2 ? paneDrawingWidth2 : anchorX;
      const minXBound = Math.min(visualStartX, visualEndX);
      const maxXBound = Math.max(visualStartX, visualEndX);
      const segmentWidth = maxXBound - minXBound;
      let textPivotX;
      switch (horizontalAlignment) {
        case "left" /* Left */.toLowerCase():
          textPivotX = minXBound;
          break;
        case "right" /* Right */.toLowerCase():
          textPivotX = maxXBound;
          break;
        case "center" /* Center */.toLowerCase():
        default:
          textPivotX = minXBound + segmentWidth / 2;
          break;
      }
      const textPivot = new AnchorPoint(textPivotX, anchorPoint.y, 0);
      const textRendererData = {
        points: [textPivot, textPivot],
        text: options.text,
        hitTestBackground: true,
        toolDefaultHoverCursor: options.defaultHoverCursor,
        toolDefaultDragCursor: options.defaultDragCursor
      };
      this._labelRenderer.setData(textRendererData);
      this._renderer.append(this._labelRenderer);
    }
    this._addAnchors(this._renderer);
  }
  /**
   * Adds the single interactive anchor point.
   *
   * We use the `VerticalResize` cursor because a Horizontal Line is typically fixed in Time
   * and only moves up/down in Price.
   *
   * @param renderer - The composite renderer to append the anchor to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 1) return;
    const [anchorPoint] = this._points;
    const anchorData = {
      points: [anchorPoint],
      pointsCursorType: ["n-resize" /* VerticalResize */]
      // Vertical resize as it only moves in Price
    };
    renderer.append(this.createLineAnchor(anchorData, 0));
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolHorizontalLine.ts
var HorizontalLineSpecificOverrides = {
  // The key difference: It is a full-span line by default
  line: {
    extend: { left: true, right: true }
  },
  // Set default price axis label visibility for horizontal lines
  showPriceAxisLabels: true,
  priceAxisLabelAlwaysVisible: true
};
var LineToolHorizontalLine = class extends BaseLineTool {
  // Defining feature of this new base
  // Inherit most logic from BaseLineTool
  /**
   * Initializes the Horizontal Line tool.
   *
   * **Tutorial Note on Construction:**
   * 1. **Base Defaults:** We borrow `TrendLineOptionDefaults` to get standard styling (colors, widths, text settings).
   * 2. **Overrides:** We apply `HorizontalLineSpecificOverrides` to force infinite left/right extension and enable price labels.
   * 3. **View:** We assign `LineToolHorizontalLinePaneView`. This view is smart enough to take a single point
   *    and draw a line spanning the full calculated width of the chart pane.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(HorizontalLineSpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      "HorizontalLine",
      1,
      // 1-point tool
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('HorizontalLine').
     *
     * @override
     */
    __publicField(this, "toolType", "HorizontalLine");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Horizontal Line is defined by exactly **1 point**. The time component (X) of this point
     * places the anchor handle, but the line itself is drawn across all time.
     *
     * @override
     */
    __publicField(this, "pointsCount", 1);
    this._setPaneViews([new LineToolHorizontalLinePaneView(this, this._chart, this._series)]);
  }
  /**
   * Performs the hit test for the Horizontal Line.
   *
   * **Architecture Note:**
   * Since the line extends infinitely, we cannot simply check if the mouse is near the anchor point.
   * We must check if the mouse is near the *visible line segment* on screen.
   *
   * The `LineToolHorizontalLinePaneView` calculates the specific start (0) and end (paneWidth)
   * pixel coordinates for the current viewport. By delegating to the View's renderer, we ensure
   * accurate hit detection across the entire width of the chart.
   *
   * @param x - X coordinate in pixels.
   * @param y - Y coordinate in pixels.
   * @returns A hit result if the mouse is over the line or the anchor.
   * @override
   */
  _internalHitTest(x, y) {
    if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
      return null;
    }
    const paneView = this._paneViews[0];
    paneView.renderer();
    const compositeRenderer = paneView.renderer();
    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null;
    }
    return compositeRenderer.hitTest(x, y);
  }
  /**
   * Updates the coordinates of the single anchor point.
   *
   * **Tutorial Note on 1-Point Logic:**
   * Even though a Horizontal Line is conceptually invariant in Time (it exists at all times),
   * the *Anchor Point* (the handle the user drags) exists at a specific Time.
   *
   * Therefore, we update **both** the `timestamp` (X) and `price` (Y). This allows the user
   * to drag the handle left and right along the line (visual preference) while moving the line
   * up and down (functional change).
   *
   * @param index - The index of the point (always 0).
   * @param point - The new logical coordinates.
   * @override
   */
  setPoint(index, point) {
    if (index === 0) {
      this._points[0] = point;
      this._triggerChartUpdate();
    }
  }
  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * Since `pointsCount` is 1, the only valid index is 0.
   *
   * @override
   * @returns `0`
   */
  maxAnchorIndex() {
    return 0;
  }
  /**
   * Calculates the horizontal line's visibility based on its price level and extension settings.
   * 
   * ### Tutorial Note on Horizontal Culling
   * A Horizontal Line is conceptually infinite in the time (X) dimension. 
   * 
   * To cull this efficiently, we inform the engine that this single anchor point 
   * represents a horizontal orientation. This tells the engine:
   * 1. If 'extend.left' and 'extend.right' are both true, only hide the tool if 
   *    the Price (Y) is off-screen.
   * 2. If it's a Ray (e.g., HorizontalRay), the engine also checks if the 
   *    viewport has scrolled past the anchor's start time.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    const orientation = {
      horizontal: true,
      vertical: false
    };
    const cullingState = getToolCullingState(
      points,
      this,
      options.line.extend,
      orientation
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolHorizontalRayPaneView.ts
var LineToolHorizontalRayPaneView = class extends LineToolHorizontalLinePaneView {
  /**
   * Initializes the Horizontal Ray View.
   *
   * @param source - The specific Horizontal Ray model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
  }
  // NOTE: No methods are overridden as the inherited logic is fully reusable.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolHorizontalRay.ts
var HorizontalRaySpecificOverrides = {
  line: {
    extend: { left: false, right: true }
    // Key change: Extends only to the right
  },
  // Ensure the base tool's price and time axis label visibility is maintained
  showPriceAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  showTimeAxisLabels: true
  // Time axis label is redundant for horizontal lines/rays
};
var LineToolHorizontalRay = class extends LineToolHorizontalLine {
  // It is a single-point tool
  /**
   * Initializes the Horizontal Ray tool.
   *
   * **Tutorial Note on Option Merging:**
   * 1. **Base:** Starts with `TrendLineOptionDefaults` (for font/color structure).
   * 2. **Override:** Merges `HorizontalRaySpecificOverrides` to set `extend.right = true` and `extend.left = false`.
   * 3. **User:** Merges user `options`.
   *
   * **View Construction:**
   * It specifically instantiates `LineToolHorizontalRayPaneView`. Even though the logic is similar
   * to the Horizontal Line view, using a distinct view class allows for cleaner separation if
   * Ray-specific rendering logic is added in the future.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(HorizontalRaySpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('HorizontalRay').
     *
     * @override
     */
    __publicField(this, "toolType", "HorizontalRay");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * Like the Horizontal Line, the Ray is defined by exactly **1 point** (the start of the ray).
     *
     * @override
     */
    __publicField(this, "pointsCount", 1);
    this._setPaneViews([new LineToolHorizontalRayPaneView(this, this._chart, this._series)]);
    console.log(`HorizontalRay Tool created with ID: ${this.id()}`);
  }
  // NOTE: All core logic is inherited from LineToolHorizontalLine.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolVerticalLinePaneView.ts
var LineToolVerticalLinePaneView = class extends LineToolPaneView {
  /**
   * Internal renderer for the optional text label.
   * @protected
   */
  //protected _textRenderer: TextRenderer<HorzScaleItem> = new TextRenderer();
  /**
   * Initializes the Vertical Line View.
   *
   * @param source - The specific Vertical Line model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    /**
     * Internal renderer for the main vertical line segment.
     * @protected
     */
    __publicField(this, "_lineRenderer", new SegmentRenderer());
  }
  /**
   * The core update logic.
   *
   * It translates the single logical anchor point into a vertical segment 
   * spanning the full height of the chart pane using a stable 1-pixel vector.
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const options = this._tool.options();
    if (!options.visible) {
      return;
    }
    const points = this._tool.points();
    if (points.length < 1) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints) {
      return;
    }
    const [anchorPoint] = this._points;
    const lineX = anchorPoint.x;
    const paneDrawingHeight = this._tool.getChartDrawingHeight();
    const pBottom = new AnchorPoint(lineX, paneDrawingHeight, 0);
    const pTop = new AnchorPoint(lineX, 0, 0);
    const compositeRenderer = new CompositeRenderer();
    const lineOptions = deepCopy(options.line);
    lineOptions.join = lineOptions.join || "miter" /* Miter */;
    lineOptions.cap = lineOptions.cap || "butt" /* Butt */;
    lineOptions.extend = { left: false, right: false };
    this._lineRenderer.setData({
      points: [pBottom, pTop],
      line: lineOptions,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    });
    compositeRenderer.append(this._lineRenderer);
    if (options.text.value) {
      const paneDrawingHeight2 = this._tool.getChartDrawingHeight();
      const userAngle = options.text.box?.angle || 0;
      const textOptions = deepCopy(options.text);
      textOptions.box = { ...textOptions.box, angle: userAngle + 90 };
      const horizontalAlignment = (options.text.box?.alignment?.horizontal || "").toLowerCase();
      let textPivotY;
      switch (horizontalAlignment) {
        case "right" /* Right */.toLowerCase():
          textPivotY = 0;
          break;
        case "left" /* Left */.toLowerCase():
          textPivotY = paneDrawingHeight2;
          break;
        case "center" /* Center */.toLowerCase():
        default:
          textPivotY = paneDrawingHeight2 / 2;
          break;
      }
      const textAttachmentPoint = new AnchorPoint(lineX, textPivotY, 0);
      const textRendererData = {
        points: [textAttachmentPoint],
        text: textOptions,
        hitTestBackground: true,
        toolDefaultHoverCursor: options.defaultHoverCursor,
        toolDefaultDragCursor: options.defaultDragCursor
      };
      this._labelRenderer.setData(textRendererData);
      compositeRenderer.append(this._labelRenderer);
    }
    this._addAnchors(compositeRenderer);
    this._renderer = compositeRenderer;
  }
  /**
   * Adds the single interactive anchor point.
   *
   * We use the `HorizontalResize` cursor because a Vertical Line is fixed in Price (conceptually)
   * and only moves Left/Right in Time.
   *
   * @param renderer - The composite renderer to append the anchor to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 1) return;
    const [anchorPoint] = this._points;
    const anchorData = {
      points: [anchorPoint],
      pointsCursorType: ["e-resize" /* HorizontalResize */]
      // Suggest horizontal resize (ew-resize)
    };
    renderer.append(this.createLineAnchor(anchorData, 0));
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolVerticalLine.ts
var VerticalLineSpecificOverrides = {
  // Line options fixed to draw a full-height vertical line segment
  line: {
    extend: { left: true, right: true }
    // No extension on this segment (full height is handled by view)
  },
  // Price Axis Label is irrelevant and should be hidden
  showPriceAxisLabels: false,
  priceAxisLabelAlwaysVisible: false,
  // Time Axis Label is the primary identification for this tool
  showTimeAxisLabels: true,
  timeAxisLabelAlwaysVisible: true
};
var LineToolVerticalLine = class extends BaseLineTool {
  // Defining feature: 1 point
  /**
   * Initializes the Vertical Line tool.
   *
   * **Tutorial Note on Construction:**
   * 1. **Base Defaults:** We use `TrendLineOptionDefaults` to establish common styling (color, width).
   * 2. **Overrides:** We apply `VerticalLineSpecificOverrides` to configure the axis labels correctly.
   * 3. **View:** We assign `LineToolVerticalLinePaneView`. This view is responsible for taking the
   *    single point and manufacturing a vertical segment that spans from Y=0 to Y=PaneHeight.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(VerticalLineSpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      "VerticalLine",
      1,
      // 1-point tool
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('VerticalLine').
     *
     * @override
     */
    __publicField(this, "toolType", "VerticalLine");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Vertical Line is defined by exactly **1 point** (the position on the time scale).
     *
     * @override
     */
    __publicField(this, "pointsCount", 1);
    this._setPaneViews([new LineToolVerticalLinePaneView(this, this._chart, this._series)]);
    console.log(`VerticalLine Tool created with ID: ${this.id()}`);
  }
  /**
   * Calculates the vertical line's visibility based on its time coordinate.
   * 
   * Because a vertical line is conceptually infinite in the price (Y) dimension, 
   * this override informs the culling engine to only hide the tool if its 
   * timestamp (X) is completely outside the visible horizontal range.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    const cullingState = getToolCullingState(
      points,
      this,
      options.line.extend,
      { horizontal: false, vertical: true }
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
  /**
   * Performs the hit test for the Vertical Line.
   *
   * **Architecture Note:**
   * Because the line extends infinitely vertically, a simple point-to-point distance check on the
   * Model's anchor point is insufficient (the user might click at the very top of the screen while
   * the anchor is in the middle).
   *
   * We delegate this to the `LineToolVerticalLinePaneView`, which knows the exact pixel height
   * of the pane and draws the full vertical segment used for hit detection.
   *
   * @param x - X coordinate in pixels.
   * @param y - Y coordinate in pixels.
   * @returns A hit result if the mouse is over the vertical line or the anchor.
   * @override
   */
  _internalHitTest(x, y) {
    if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
      return null;
    }
    const paneView = this._paneViews[0];
    const compositeRenderer = paneView.renderer();
    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null;
    }
    return compositeRenderer.hitTest(x, y);
  }
  /**
   * Updates the coordinates of the single anchor point.
   *
   * **Tutorial Note on Constraints:**
   * A Vertical Line is strictly bound to the **Time Axis**.
   * When the user drags the tool, we update the `timestamp` (X).
   *
   * While the `price` (Y) component technically doesn't affect the *line's* position,
   * we still update it so the anchor handle follows the user's mouse vertically,
   * providing better visual feedback during the drag.
   *
   * @param index - The index of the point (always 0).
   * @param point - The new logical coordinates.
   * @override
   */
  setPoint(index, point) {
    if (index === 0) {
      this._points[0].timestamp = point.timestamp;
      this._points[0].price = point.price;
      this._triggerChartUpdate();
    }
  }
  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * Since `pointsCount` is 1, the only valid index is 0.
   *
   * @override
   * @returns `0`
   */
  maxAnchorIndex() {
    return 0;
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolCrossLine.ts
import {
  LineStyle as LineStyle5
} from "lightweight-charts";

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolCrossLinePaneView.ts
var LineToolCrossLinePaneView = class extends LineToolPaneView {
  /**
   * Initializes the Cross Line View.
   *
   * @param source - The specific Cross Line model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    // Need two separate renderers for the two distinct segments
    __publicField(this, "_horizontalRenderer", new SegmentRenderer());
    __publicField(this, "_verticalRenderer", new SegmentRenderer());
  }
  /**
   * The core update logic.
   *
   * It translates the single logical anchor point into two full-screen segments
   * (Horizontal and Vertical) using stable 1-pixel vectors to prevent 
   * directional flipping in the buffer zones.
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const options = this._tool.options();
    if (!options.visible) {
      return;
    }
    const points = this._tool.points();
    if (points.length < 1) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints) {
      return;
    }
    const [anchorPoint] = this._points;
    const lineX = anchorPoint.x;
    const lineY = anchorPoint.y;
    const paneDrawingHeight = this._tool.getChartDrawingHeight();
    const paneDrawingWidth = this._tool.getChartDrawingWidth();
    const compositeRenderer = new CompositeRenderer();
    const lineOptions = deepCopy(options.line);
    lineOptions.join = lineOptions.join || "miter" /* Miter */;
    lineOptions.cap = lineOptions.cap || "butt" /* Butt */;
    lineOptions.extend = { left: false, right: false };
    const commonSegmentOptions = lineOptions;
    const commonCursorOptions = {
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    };
    const vP0 = new AnchorPoint(lineX, paneDrawingHeight, 0);
    const vP1 = new AnchorPoint(lineX, 0, 0);
    this._verticalRenderer.setData({
      points: [vP0, vP1],
      line: commonSegmentOptions,
      ...commonCursorOptions
    });
    compositeRenderer.append(this._verticalRenderer);
    const hP0 = new AnchorPoint(0, lineY, 0);
    const hP1 = new AnchorPoint(paneDrawingWidth, lineY, 0);
    this._horizontalRenderer.setData({
      points: [hP0, hP1],
      line: commonSegmentOptions,
      ...commonCursorOptions
    });
    compositeRenderer.append(this._horizontalRenderer);
    this._addAnchors(compositeRenderer);
    this._renderer = compositeRenderer;
  }
  /**
   * Adds the single interactive anchor point at the intersection.
   *
   * We use the `Crosshair` cursor to indicate that this point moves freely in 2D space.
   *
   * @param renderer - The composite renderer to append the anchor to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 1) return;
    const [anchorPoint] = this._points;
    const anchorData = {
      points: [anchorPoint],
      pointsCursorType: ["crosshair" /* Crosshair */]
      // Suggest crosshair/move
    };
    renderer.append(this.createLineAnchor(anchorData, 0));
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolCrossLine.ts
var CrossLineDefaultOptions = {
  visible: true,
  editable: true,
  defaultHoverCursor: "crosshair" /* Crosshair */,
  defaultDragCursor: "crosshair" /* Crosshair */,
  defaultAnchorHoverCursor: "crosshair" /* Crosshair */,
  defaultAnchorDragCursor: "crosshair" /* Crosshair */,
  notEditableCursor: "crosshair" /* Crosshair */,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: true,
  timeAxisLabelAlwaysVisible: true,
  // Specific Line Options (Inherited from the simplified V3.8 CrossLine options)
  line: {
    width: 1,
    color: "#2962ff",
    // Default blue
    style: LineStyle5.Solid,
    // We keep extend/end properties to give flexibility, but the view will handle the infinite span
    extend: { left: true, right: true },
    // The view will interpret this as full infinite span
    end: { left: 0 /* Normal */, right: 0 /* Normal */ }
  }
};
var LineToolCrossLine = class extends BaseLineTool {
  // Defining feature: 1 point
  /**
   * Initializes the Cross Line tool.
   *
   * **Tutorial Note:**
   * 1. It merges `CrossLineDefaultOptions` with user options.
   * 2. It sets `pointsCount` to 1 in the `super()` call.
   * 3. It assigns the specialized `LineToolCrossLinePaneView`, which is responsible
   *    for taking that single point and drawing the two intersecting infinite lines.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(CrossLineDefaultOptions);
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      "CrossLine",
      1,
      // 1-point tool
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('CrossLine').
     *
     * @override
     */
    __publicField(this, "toolType", "CrossLine");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Cross Line is defined by exactly **1 point** (the center of the cross).
     *
     * @override
     */
    __publicField(this, "pointsCount", 1);
    this._setPaneViews([new LineToolCrossLinePaneView(this, this._chart, this._series)]);
    console.log(`CrossLine Tool created with ID: ${this.id()}`);
  }
  /**
   * Performs the hit test for the Cross Line.
   *
   * **Architecture Note:**
   * Even though the Model only holds one point, the View renders lines spanning the whole screen.
   * Therefore, we cannot do simple math here. We **must** delegate to the View's `CompositeRenderer`.
   * The View knows exactly where those infinite lines are drawn on the pixel canvas, ensuring
   * that clicking anywhere on the crosshair lines registers as a hit.
   *
   * @param x - X coordinate in pixels.
   * @param y - Y coordinate in pixels.
   * @returns A hit result if the mouse is over the horizontal or vertical line, or the center anchor.
   * @override
   */
  _internalHitTest(x, y) {
    if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
      return null;
    }
    const paneView = this._paneViews[0];
    paneView.renderer();
    const compositeRenderer = paneView.renderer();
    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null;
    }
    return compositeRenderer.hitTest(x, y);
  }
  /**
   * Updates the coordinates of the single anchor point (Intersection).
   *
   * **Tutorial Note on Constraints:**
   * Unlike a `VerticalLine` (which locks Time) or `HorizontalLine` (which locks Price),
   * a Cross Line moves freely in both dimensions. Therefore, this method updates
   * both the `timestamp` (X) and `price` (Y) of point 0 whenever the user drags it.
   *
   * @param index - The index of the point (always 0).
   * @param point - The new logical coordinates.
   * @override
   */
  setPoint(index, point) {
    if (index === 0) {
      this._points[0].timestamp = point.timestamp;
      this._points[0].price = point.price;
      this._triggerChartUpdate();
    }
  }
  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * Since `pointsCount` is 1, the only valid index is 0.
   *
   * @override
   * @returns `0`
   */
  maxAnchorIndex() {
    return 0;
  }
  /**
   * Calculates the Cross Line's visibility based on its intersection point.
   * 
   * ### Tutorial Note on Cross Line Culling
   * A Cross Line is infinite in both the horizontal (Time) and vertical (Price) 
   * dimensions. 
   * 
   * To handle this, we pass a dual orientation `{ horizontal: true, vertical: true }`. 
   * This instructs the culling engine that the tool is only "Off-Screen" if its 
   * anchor point is outside the viewport in BOTH dimensions (e.g., if the point 
   * is both to the left of the time scale AND above the price scale).
   * 
   * As long as the crosshair lines intersect the visible area of the chart 
   * at any point, the tool remains unculled.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    const orientation = {
      horizontal: true,
      vertical: true
    };
    const cullingState = getToolCullingState(
      points,
      this,
      options.line.extend,
      orientation
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/views/LineToolCalloutPaneView.ts
var LineToolCalloutPaneView = class extends LineToolPaneView {
  /**
   * Initializes the Callout View.
   *
   * @param source - The specific Callout model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    __publicField(this, "_segmentRenderer", new SegmentRenderer());
    __publicField(this, "_textRenderer", new TextRenderer());
  }
  /**
   * Orchestrates the rendering of the line stem and the text box.
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const options = this._tool.options();
    if (!options.visible) {
      return;
    }
    if (this._tool.points().length < 2) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints) {
      return;
    }
    const [point0, point1] = this._points;
    const textPivot = point1;
    const textOptions = deepCopy(options.text);
    const textRendererData = {
      points: [textPivot],
      text: textOptions,
      hitTestBackground: true,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    };
    this._textRenderer.setData(textRendererData);
    const boxDimensions = this._textRenderer.measure();
    const lineOptions = deepCopy(options.line);
    lineOptions.join = lineOptions.join || "miter" /* Miter */;
    lineOptions.cap = lineOptions.cap || "butt" /* Butt */;
    this._segmentRenderer.setData({
      points: [point0, point1],
      // P0 to P1
      line: lineOptions,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    });
    this._renderer.clear();
    const compositeRenderer = new CompositeRenderer();
    compositeRenderer.append(this._segmentRenderer);
    compositeRenderer.append(this._textRenderer);
    if (this.areAnchorsVisible()) {
      this._addAnchors(compositeRenderer);
    }
    this._renderer = compositeRenderer;
  }
  /**
   * Adds the two interactive anchor points.
   *
   * - **P0:** The "Target" point (where the callout points to).
   * - **P1:** The "Text" point (where the annotation sits).
   *
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 2) return;
    const [point0, point1] = this._points;
    const anchorData = {
      points: [point0, point1],
      pointsCursorType: ["pointer" /* Pointer */, "pointer" /* Pointer */]
    };
    renderer.append(this.createLineAnchor(anchorData, 0));
  }
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/model/LineToolCallout.ts
var CalloutSpecificOverrides = {
  defaultHoverCursor: "pointer" /* Pointer */,
  defaultDragCursor: "grabbing" /* Grabbing */,
  defaultAnchorHoverCursor: "pointer" /* Pointer */,
  defaultAnchorDragCursor: "grabbing" /* Grabbing */,
  notEditableCursor: "not-allowed" /* NotAllowed */,
  showPriceAxisLabels: false,
  showTimeAxisLabels: false,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  line: {
    end: { left: 0 /* Normal */, right: 0 /* Normal */ },
    // Default to Normal ends
    extend: { left: false, right: false }
    // Callout is always a segment (the stem)
  },
  text: {
    value: "this is some text",
    padding: 0,
    wordWrapWidth: 150,
    font: {
      color: "rgba(255,255,255,1)",
      size: 14,
      bold: false,
      italic: false
    },
    // Default to a visible text box background for clarity/design
    box: {
      shadow: {
        blur: 0,
        color: "rgba(255,255,255,1)",
        offset: {
          x: 0,
          y: 0
        }
      },
      border: {
        color: "rgba(74,144,226,1)",
        width: 1,
        radius: 20,
        highlight: false,
        style: 0
      },
      background: {
        color: "rgba(19,73,133,1)",
        inflation: {
          x: 10,
          y: 10
        }
      },
      padding: { x: 5, y: 5 },
      alignment: { vertical: "middle", horizontal: "center" },
      maxHeight: 500
    }
  }
};
var LineToolCallout = class extends LineToolTrendLine {
  // Inherits 2-point behavior
  /**
   * Initializes the Callout tool.
   *
   * **Tutorial Note on Construction:**
   * 1. We start with `TrendLineOptionDefaults` as a base.
   * 2. We apply `CalloutSpecificOverrides` to turn off axis labels and set up the text box styling.
   * 3. We apply user `options` last.
   * 4. Crucially, we assign `LineToolCalloutPaneView` instead of the standard Trend Line view.
   *    This swap is what actually makes the tool look like a Callout on the canvas.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(TrendLineOptionDefaults);
    merge(finalOptions, deepCopy(CalloutSpecificOverrides));
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('Callout').
     *
     * @override
     */
    __publicField(this, "toolType", "Callout");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Callout requires exactly **2 points**:
     * 1. The target point (where the arrow/line points to).
     * 2. The text box anchor point (where the label sits).
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolCalloutPaneView(this, this._chart, this._series)]);
    console.log(`Callout Tool created with ID: ${this.id()}`);
  }
  /**
   * Calculates the Callout's visibility based on its Stem line (P0 to P1).
   * 
   * ### Tutorial Note on Callout Culling
   * Even though a Callout involves a complex text box, its geometric visibility 
   * is primarily determined by the "Stem"—the line segment connecting the 
   * pointer (P0) to the text anchor (P1).
   * 
   * This method uses the core culling engine to perform a segment intersection 
   * check. If any part of the Stem or the anchor points are within the viewport, 
   * the tool is marked as visible. 
   * 
   * Since Callouts do not typically extend infinitely, the engine uses 
   * standard Axis-Aligned Bounding Box (AABB) logic here.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    const cullingState = getToolCullingState(
      points,
      this,
      options.line.extend
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
  // NOTE: All core logic (hitTest, shift constraints, normalize, etc.) is inherited from LineToolTrendLine.
};

// vendor/difurious/lightweight-charts-line-tools-lines/src/index.ts
var TREND_LINE_NAME = "TrendLine";
var EXTENDED_LINE_NAME = "ExtendedLine";
var ARROW_LINE_NAME = "Arrow";
var RAY_LINE_NAME = "Ray";
var HORIZONTAL_LINE_NAME = "HorizontalLine";
var HORIZONTAL_RAY_NAME = "HorizontalRay";
var VERTICAL_LINE_NAME = "VerticalLine";
var CROSS_LINE_NAME = "CrossLine";
var CALLOUT_LINE_NAME = "Callout";
function registerLinesPlugin(corePlugin) {
  corePlugin.registerLineTool(TREND_LINE_NAME, LineToolTrendLine);
  corePlugin.registerLineTool(EXTENDED_LINE_NAME, LineToolExtendedLine);
  corePlugin.registerLineTool(ARROW_LINE_NAME, LineToolArrow);
  corePlugin.registerLineTool(RAY_LINE_NAME, LineToolRay);
  corePlugin.registerLineTool(HORIZONTAL_LINE_NAME, LineToolHorizontalLine);
  corePlugin.registerLineTool(HORIZONTAL_RAY_NAME, LineToolHorizontalRay);
  corePlugin.registerLineTool(VERTICAL_LINE_NAME, LineToolVerticalLine);
  corePlugin.registerLineTool(CROSS_LINE_NAME, LineToolCrossLine);
  corePlugin.registerLineTool(CALLOUT_LINE_NAME, LineToolCallout);
  console.log(`Registered Line Tool: ${TREND_LINE_NAME}`);
  console.log(`Registered Line Tool: ${EXTENDED_LINE_NAME}`);
  console.log(`Registered Line Tool: ${ARROW_LINE_NAME}`);
  console.log(`Registered Line Tool: ${RAY_LINE_NAME}`);
  console.log(`Registered Line Tool: ${HORIZONTAL_LINE_NAME}`);
  console.log(`Registered Line Tool: ${HORIZONTAL_RAY_NAME}`);
  console.log(`Registered Line Tool: ${VERTICAL_LINE_NAME}`);
  console.log(`Registered Line Tool: ${CROSS_LINE_NAME}`);
  console.log(`Registered Line Tool: ${CALLOUT_LINE_NAME}`);
}

// vendor/difurious/lightweight-charts-line-tools-rectangle/src/model/LineToolRectangle.ts
import {
  LineStyle as LineStyle6
} from "lightweight-charts";

// vendor/difurious/lightweight-charts-line-tools-rectangle/src/views/LineToolRectanglePaneView.ts
var LineToolRectanglePaneView = class extends LineToolPaneView {
  // Rectangle and Text renderers are now declared and initialized in the BaseLineToolPaneView
  // protected _rectangleRenderer: RectangleRenderer; // No longer need to declare here if initialized in base
  // protected _labelRenderer: TextRenderer; // No longer need to declare here if initialized in base
  /**
      * Initializes the View instance.
      * 
      * **Tutorial Note:**
      * The constructor receives the specific `LineToolRectangle` instance. 
      * By passing this specific type (instead of the generic `BaseLineTool`), we gain type safety 
      * when accessing rectangle-specific options (like `options.rectangle.extend`) later in the render loop.
      * 
      * We pass these references up to the `super()` constructor, which initializes the shared 
      * `CompositeRenderer`, `RectangleRenderer`, and `TextRenderer` instances automatically.
      * 
      * @param source - The concrete Model instance for this rectangle.
      * @param chart - The LWC Chart API (used for coordinate conversion).
      * @param series - The LWC Series API (used for price conversion).
      */
  constructor(source, chart, series) {
    super(source, chart, series);
  }
  /**
      * The main rendering loop for this tool.
      * 
      * **Tutorial Note:**
      * This method is called by the Core whenever the chart needs to paint (e.g., on scroll, zoom, or mouse move),
      * *but only if* `update()` has been called to mark the view as "invalidated".
      * 
      * **The Render Lifecycle:**
      * 1. **Clear:** We wipe the `_renderer` clean. It's a fresh frame.
      * 2. **Check Visibility:** If the tool is hidden via options, we abort.
      * 3. **Update Points:** We call `_updatePoints()` (from Base) to convert Time/Price -> x/y pixels.
      * 4. **Culling:** We determine if the tool is actually visible in the viewport.
      * 5. **Populate:** If visible, we configure the `RectangleRenderer` and `TextRenderer` with the new 
      *    coordinates and styles, then `append()` them to the `CompositeRenderer`.
      * 6. **Anchors:** We calculate and add the interaction handles.
      * 
      * @override
      */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const options = this._tool.options();
    if (!options.visible) {
      console.log("[RectanglePaneView] Update stopped: Tool is not visible.");
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasUpdatedPoints = this._updatePoints();
    if (!hasUpdatedPoints) {
      console.log("[RectanglePaneView] Update stopped: Point conversion failed.");
      return;
    }
    if (this._points.length > 0) {
    }
    if (this._points.length !== this._tool.pointsCount) {
      return;
    }
    const rectanglePoints = [this._points[0], this._points[1]];
    const rectangleRendererData = {
      ...deepCopy(options.rectangle),
      points: rectanglePoints,
      hitTestBackground: false,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    };
    this._rectangleRenderer.setData(rectangleRendererData);
    this._renderer.append(this._rectangleRenderer);
    if (options.text.value) {
      const textRendererData = {
        text: deepCopy(options.text),
        points: rectanglePoints,
        toolDefaultHoverCursor: options.defaultHoverCursor,
        toolDefaultDragCursor: options.defaultDragCursor,
        hitTestBackground: true
      };
      this._labelRenderer.setData(textRendererData);
      this._renderer.append(this._labelRenderer);
    }
    this._addAnchors(this._renderer);
  }
  /**
   * Calculates and renders the interactive resize handles (anchors) for the rectangle.
   * 
   * **Tutorial Note - Custom Anchor Logic:**
   * We override this method because a Rectangle has complex anchor requirements that the default logic doesn't handle:
   * 1. **8 Handles:** Corners (resize both dimensions) + Midpoints (resize width OR height).
   * 2. **Dynamic Cursors:** The cursor for the top-left corner depends on the rectangle's orientation. 
   *    If the user dragged "up and left" vs "down and right", the diagonal resize direction flips (NWSE vs NESW).
   * 
   * This method calculates the geometry for all 8 points, determines the correct cursor for the corners 
   * based on sign of width/height, and registers them.
   * 
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 2) return;
    const [point0, point1] = this._points;
    const minX = Math.min(point0.x, point1.x);
    const maxX = Math.max(point0.x, point1.x);
    const minY = Math.min(point0.y, point1.y);
    const maxY = Math.max(point0.y, point1.y);
    const xDiff = point0.x - point1.x;
    const yDiff = point0.y - point1.y;
    const sign = Math.sign(xDiff * yDiff);
    const diag1Cursor = sign < 0 ? "nesw-resize" /* DiagonalNeSwResize */ : "nwse-resize" /* DiagonalNwSeResize */;
    const diag2Cursor = sign < 0 ? "nwse-resize" /* DiagonalNwSeResize */ : "nesw-resize" /* DiagonalNeSwResize */;
    const topLeft = new AnchorPoint(minX, minY, 0, false, diag1Cursor);
    const topCenter = new AnchorPoint((minX + maxX) / 2, minY, 6, true, "n-resize" /* VerticalResize */);
    const topRight = new AnchorPoint(maxX, minY, 3, false, diag2Cursor);
    const middleRight = new AnchorPoint(maxX, (minY + maxY) / 2, 5, true, "e-resize" /* HorizontalResize */);
    const bottomRight = new AnchorPoint(maxX, maxY, 1, false, diag1Cursor);
    const bottomCenter = new AnchorPoint((minX + maxX) / 2, maxY, 7, true, "n-resize" /* VerticalResize */);
    const bottomLeft = new AnchorPoint(minX, maxY, 2, false, diag2Cursor);
    const middleLeft = new AnchorPoint(minX, (minY + maxY) / 2, 4, true, "e-resize" /* HorizontalResize */);
    const anchorData = {
      // ** NEW: Array is ordered according to the canonical sequence: 0, 6, 3, 5, 1, 7, 2, 4 **
      points: [
        topLeft,
        topCenter,
        topRight,
        middleRight,
        bottomRight,
        bottomCenter,
        bottomLeft,
        middleLeft
      ]
    };
    const toolOptions = this._tool.options();
    renderer.append(this.createLineAnchor({
      ...anchorData,
      defaultAnchorHoverCursor: toolOptions.defaultAnchorHoverCursor,
      defaultAnchorDragCursor: toolOptions.defaultAnchorDragCursor
    }, 0));
  }
};

// vendor/difurious/lightweight-charts-line-tools-rectangle/src/model/LineToolRectangle.ts
var RectangleOptionDefaults = {
  visible: true,
  editable: true,
  defaultHoverCursor: "pointer" /* Pointer */,
  defaultDragCursor: "grabbing" /* Grabbing */,
  defaultAnchorHoverCursor: "pointer" /* Pointer */,
  defaultAnchorDragCursor: "grabbing" /* Grabbing */,
  notEditableCursor: "not-allowed" /* NotAllowed */,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  rectangle: {
    extend: { left: false, right: false },
    background: { color: "rgba(156,39,176,0.2)" },
    // default semi-transparent purple
    border: { radius: 0, width: 1, style: LineStyle6.Solid, color: "#9c27b0" }
    // default purple border
  },
  text: {
    // Text options are part of the default
    value: "",
    // Default empty text
    alignment: "center" /* Center */,
    font: {
      color: "#FFFFFF",
      size: 12,
      bold: false,
      italic: false,
      family: "sans-serif"
    },
    box: {
      alignment: { vertical: "middle" /* Middle */, horizontal: "center" /* Center */ },
      angle: 0,
      scale: 1,
      padding: { x: 0, y: 0 },
      maxHeight: 0,
      // Placeholder
      shadow: { blur: 0, color: "rgba(0,0,0,0)", offset: { x: 0, y: 0 } },
      border: { color: "rgba(0,0,0,0)", width: 0, radius: 0, highlight: false, style: LineStyle6.Solid },
      background: { color: "rgba(0,0,0,0)", inflation: { x: 0, y: 0 } }
    },
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false
  }
};
var LineToolRectangle = class extends BaseLineTool {
  /**
      * Initializes the Rectangle Tool instance.
      * 
      * **Tutorial Note - The "Options Dance":**
      * One of the most critical steps in a custom tool's constructor is handling configuration options correctly.
      * 
      * 1. **Deep Copy Defaults:** We use `deepCopy(RectangleOptionDefaults)` instead of using the constant directly.
      *    *Why?* In JavaScript, objects are passed by reference. If we didn't copy, changing the color of 
      *    *this* rectangle would change the default color for *all future* rectangles.
      * 
      * 2. **Merge User Options:** We apply `merge()` to overlay the user's specific settings (passed in `options`)
      *    onto our fresh copy of the defaults.
      * 
      * 3. **Super Call:** We pass the finalized options to `super()`. The Base class stores them and handles 
      *    standard interactions (like selection state).
      * 
      * 4. **Set Pane Views:** Finally, we instantiate `LineToolRectanglePaneView`. This links the "Model" (this class)
      *    to the "View" (the renderer), telling the Core how to visually represent this data on the chart.
      * 
      * @param coreApi - Reference to the plugin core.
      * @param chart - The Lightweight Charts instance.
      * @param series - The series this tool is attached to.
      * @param horzScaleBehavior - Utilities for time scale conversion.
      * @param options - Partial configuration provided by the user.
      * @param points - Initial data points (if restoring from state).
      * @param priceAxisLabelStackingManager - Core utility for managing label overlap.
      */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(RectangleOptionDefaults);
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      // <-- Pass the final merged and deep-copied options
      points,
      "Rectangle",
      2,
      priceAxisLabelStackingManager
    );
    /**
        * The unique string identifier for this tool type.
        * 
        * **Tutorial Note:** 
        * This string must match the key used when registering the tool with the 
        * ('LineToolsCorePlugin.registerLineTool') method. The Core uses this ID to 
        * lookup the correct class constructor when importing data or handling user interactions.
        * 
        * @override
        */
    __publicField(this, "toolType", "Rectangle");
    /**
        * The number of logical data points required to define this tool.
        * 
        * **Tutorial Note:** 
        * A Rectangle is geometrically defined by exactly **2 diagonal points** (Top-Left and Bottom-Right, 
        * or any diagonal pair). Even though the user sees 8 resize handles (corners and sides), 
        * the underlying data structure only persists these 2 points.
        * 
        * - Use a positive integer (e.g., `2`) for bounded tools.
        * - Use `-1` for unbounded tools (like a Brush or Polyline) that grow as the user draws.
        * 
        * @override
        */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolRectanglePaneView(this, this._chart, this._series)]);
  }
  // Rectangles are defined by two diagonal points
  /**
      * Defines the maximum index of interactive resize handles (anchors) supported by this tool.
      * 
      * **Tutorial Note - Why Override?**
      * By default, `BaseLineTool` assumes the number of anchors equals `pointsCount`. 
      * 
      * However, a Rectangle needs more handles than it has data points:
      * - **Data:** 2 Points (Indices 0, 1).
      * - **Visual:** 8 Anchors (4 Corners + 4 Side Midpoints).
      * 
      * By returning `7` (Indices 0 to 7), we tell the `InteractionManager` to hit-test and 
      * listen for drag events on indices 2 through 7, even though they don't exist in the 
      * permanent `_points` array. We will then handle the logic for these "virtual" anchors 
      * in `getPoint` and `setPoint`.
      * 
      * @returns The maximum zero-based index (7 for 8 anchors).
      * @override
      */
  maxAnchorIndex() {
    return 7;
  }
  /**
      * Indicates whether this tool can be created via a sequence of discrete clicks.
      * 
      * **Tutorial Note:**
      * Returning `true` enables the "Click-Move-Click" interaction pattern:
      * 1. User clicks once to set the first point (Top-Left).
      * 2. User moves the mouse (without holding the button) to visualize the "ghost" rectangle.
      * 3. User clicks again to set the second point (Bottom-Right) and finish creation.
      * 
      * This mode is often preferred for precision placement as it separates positioning from the mechanics of holding a mouse button.
      * 
      * @returns `true` to enable discrete click creation.
      * @override
      */
  supportsClickClickCreation() {
    return true;
  }
  /**
      * Indicates whether this tool can be created via a single drag gesture.
      * 
      * **Tutorial Note:**
      * Returning `true` enables the standard "Drag-to-Draw" pattern:
      * 1. User presses the mouse button to set the first point.
      * 2. User drags the mouse to resize the "ghost" rectangle.
      * 3. User releases the mouse button to set the second point and finish creation.
      * 
      * Most geometric shape tools (Rectangles, Circles) should support both creation modes
      * to accommodate different user preferences.
      * 
      * @returns `true` to enable drag creation.
      * @override
      */
  supportsClickDragCreation() {
    return true;
  }
  /**
      * Determines if holding the Shift key should apply geometric constraints during "Click-Move-Click" creation.
      * 
      * **Tutorial Note:**
      * If this returns `true`, the `InteractionManager` will call `getShiftConstrainedPoint()` 
      * whenever the mouse moves while the Shift key is held.
      * 
      * For a Rectangle, this allows the user to force specific alignments (e.g., locking the 
      * height or width to the start point) before placing the final corner.
      * 
      * @returns `true` to enable constraints during ghosting.
      * @override
      */
  supportsShiftClickClickConstraint() {
    return true;
  }
  /**
      * Determines if holding the Shift key should apply geometric constraints during "Drag-to-Draw" creation.
      * 
      * **Tutorial Note:**
      * Similar to the click-click variant, this enables `getShiftConstrainedPoint()` during the drag operation.
      * 
      * **Why separate flags?**
      * Some tools might behave differently depending on the input method. For example, a "Brush" tool 
      * might treat a Shift-Drag as a straight line constraint, but a Shift-Click as a selection modifier. 
      * Separating these flags gives you fine-grained control over the UX.
      * 
      * @returns `true` to enable constraints during dragging.
      * @override
      */
  supportsShiftClickDragConstraint() {
    return true;
  }
  /**
      * Standardizes the internal point order to ensure a consistent "Top-Left" to "Bottom-Right" orientation.
      * 
      * **Tutorial Note:**
      * Users can draw a rectangle in any direction (e.g., starting at Bottom-Right and dragging up to Top-Left).
      * However, simpler rendering and hit-testing math often relies on knowing that:
      * - Point 0 is always the Top-Left (Min Time, Max Price).
      * - Point 1 is always the Bottom-Right (Max Time, Min Price).
      * 
      * This method rearranges the internal `_points` array to match this standard. It is called automatically
      * by the `InteractionManager` after creation or editing completes.
      * 
      * **Anchor Index Map:**
      * Once normalized, the 8 interactive handles map to indices as follows:
      * 
      *        (6) Top-Center
      *           |
      * (0) TL *--*--* TR (3)
      *        |     |
      * (4) ML *     * MR (5)
      *        |     |
      * (2) BL *--*--* BR (1)
      *           |
      *        (7) Bottom-Center
      * 
      * @override
      */
  normalize() {
    if (this._points.length < 2) {
      return;
    }
    const [p0, p1] = this._points;
    const minTime = Math.min(p0.timestamp, p1.timestamp);
    const maxTime = Math.max(p0.timestamp, p1.timestamp);
    const minPrice = Math.min(p0.price, p1.price);
    const maxPrice = Math.max(p0.price, p1.price);
    this._points[0] = { timestamp: minTime, price: maxPrice };
    this._points[1] = { timestamp: maxTime, price: minPrice };
  }
  /**
      * Calculates the corrected coordinate when a user drags an anchor while holding the Shift key.
      * 
      * **Tutorial Note:**
      * This method is the brain behind "geometric constraints." It overrides the raw mouse position
      * to enforce specific movement rules based on *which* handle is being dragged.
      * 
      * **Logic implemented here:**
      * 1. **Creation Phase:** We largely ignore constraints here to let the user draw freely, or we could 
      *    enforce a perfect square. Currently, it returns the raw point.
      * 
      * 2. **Editing Phase (Corner Anchors 0-3):** 
      *    We enforce a "Price Axis Lock". The Y-coordinate is locked to the anchor's original position,
      *    forcing the user to resize width-wise only if they hold Shift.
      * 
      * 3. **Editing Phase (Side Anchors 4-7):** 
      *    - **Middle-Left/Right (4, 5):** Lock Y (Height). Allow only Width changes.
      *    - **Top/Bottom-Center (6, 7):** Lock X (Time). Allow only Height changes.
      * 
      * @param pointIndex - The index of the handle being dragged (0-7).
      * @param rawScreenPoint - The current mouse position in pixels.
      * @param phase - Whether we are creating a new tool or editing an existing one.
      * @param originalLogicalPoint - The logical position of the anchor *before* the drag started.
      * @param allOriginalLogicalPoints - Snapshot of all points before the drag started.
      * @returns A `ConstraintResult` containing the new pixel coordinates and a "snap hint" (time/price/none).
      * @override
      */
  getShiftConstrainedPoint(pointIndex, rawScreenPoint, phase, originalLogicalPoint, allOriginalLogicalPoints) {
    const originalScreenPoint = this.pointToScreenPoint(originalLogicalPoint);
    if (!originalScreenPoint) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    if (phase === "creation" /* Creation */) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    if (pointIndex >= 0 && pointIndex <= 3) {
      const constrainedY = originalScreenPoint.y;
      return {
        point: new Point(rawScreenPoint.x, constrainedY),
        snapAxis: "price"
      };
    }
    if (pointIndex >= 4 && pointIndex <= 7) {
      if (pointIndex === 4 || pointIndex === 5) {
        return {
          point: new Point(rawScreenPoint.x, originalScreenPoint.y),
          snapAxis: "price"
        };
      }
      if (pointIndex === 6 || pointIndex === 7) {
        return {
          point: new Point(originalScreenPoint.x, rawScreenPoint.y),
          snapAxis: "price"
        };
      }
    }
    return { point: rawScreenPoint, snapAxis: "none" };
  }
  /**
      * The primary entry point for detecting mouse interactions with this tool.
      * 
      * **Tutorial Note - The Delegation Pattern:**
      * `BaseLineTool` does not know what a "Rectangle" looks like or where its borders are. 
      * Instead of duplicating geometric math here in the Model, we delegate the question to the **View**.
      * 
      * 1. Access the `LineToolRectanglePaneView` associated with this tool.
      * 2. Retrieve its underlying `CompositeRenderer`.
      * 3. Ask the renderer: "Is the point (x,y) touching any of your primitives (borders, background, or anchors)?"
      * 
      * This ensures that what the user *sees* (the rendered pixels) matches exactly what they can *click*.
      * 
      * @param x - Mouse X coordinate (pixels).
      * @param y - Mouse Y coordinate (pixels).
      * @returns A result object indicating if a hit occurred, what part was hit (body/anchor), and the cursor style.
      * @override
      */
  _internalHitTest(x, y) {
    if (this._paneViews.length === 0) {
      return null;
    }
    const paneView = this._paneViews[0];
    const renderer = paneView.renderer();
    if (renderer && renderer.hitTest) {
      return renderer.hitTest(x, y);
    }
    return null;
  }
  /**
      * Retrieves the logical position (Time/Price) for a specific anchor handle index.
      * 
      * **Tutorial Note - "Virtual Anchors":**
      * This is a critical concept for complex tools.
      * - **Real Data:** The tool actually stores only 2 points: Top-Left (Index 0) and Bottom-Right (Index 1).
      * - **Virtual UI:** The user expects to see and grab 8 handles (corners + midpoints).
      * 
      * This method acts as a translator.
      * - If `index` is 0 or 1, it returns the actual stored data.
      * - If `index` is 2-7, it calls `_getAnchorPointForIndex` to calculate where that handle *should* be 
      *   geometrically (e.g., the midpoint between Top-Left and Top-Right).
      * 
      * This allows the `InteractionManager` to treat virtual handles exactly like real data points.
      * 
      * @param index - The 0-7 index of the requested handle.
      * @returns The calculated logical point.
      * @override
      */
  getPoint(index) {
    if (index < 2) {
      return super.getPoint(index);
    }
    return this._getAnchorPointForIndex(index);
  }
  /**
      * Updates the tool's geometry based on the movement of a specific anchor handle.
      * 
      * **Tutorial Note - "Reverse Mapping":**
      * This is the counterpart to `getPoint`. When the user drags a "Virtual Anchor" (like the Top-Center handle),
      * we cannot just "save" that point because it doesn't exist in our 2-point data structure.
      * 
      * Instead, we must translate that movement into updates for the 2 real points (P0 and P1).
      * 
      * **Example:**
      * If the user drags **Top-Center (Index 6)** upwards:
      * 1. We read the new Y price.
      * 2. We update **P0's price** (Top) to match.
      * 3. We ignore the X movement (because Top-Center shouldn't change the width in this logic).
      * 
      * This ensures the rectangle resizes intuitively while maintaining its data integrity.
      * 
      * @param index - The index of the handle being moved (0-7).
      * @param point - The new logical position of that handle.
      * @override
      */
  setPoint(index, point) {
    if (index < 2) {
      super.setPoint(index, point);
      return;
    }
    switch (index) {
      case 2:
        this._points[1].price = point.price;
        this._points[0].timestamp = point.timestamp;
        break;
      case 3:
        this._points[0].price = point.price;
        this._points[1].timestamp = point.timestamp;
        break;
      case 4:
        this._points[0].timestamp = point.timestamp;
        break;
      case 5:
        this._points[1].timestamp = point.timestamp;
        break;
      case 6:
        this._points[0].price = point.price;
        break;
      case 7:
        this._points[1].price = point.price;
        break;
    }
  }
  /**
   * Calculates the Rectangle's visibility based on its 2D area.
   * 
   * ### Tutorial Note on Rectangle Culling
   * A Rectangle represents a solid block of space. To prevent the background 
   * color from "popping" out when the borders leave the viewport, we use 
   * the core's Area-Based culling mode.
   * 
   * By passing `isAreaBased: true`, we instruct the engine to perform a 
   * 2D bounding box intersection test. This test accounts for infinite 
   * horizontal extensions, ensuring that as long as the user is looking 
   * at any part of the rectangle's 'Zone of Influence', the tool stays active.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    if (this.getPermanentPointsCount() < this.pointsCount || this.isCreating() || this.isEditing()) {
      this._setIsCulled(false);
      return;
    }
    const cullingState = getToolCullingState(
      points,
      this,
      options.rectangle.extend,
      void 0,
      void 0,
      true
      // isAreaBased: true
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
  /**
      * Calculates the geometric position for any of the 8 resize handles based on the 2 primary points.
      * 
      * **Tutorial Note:**
      * This helper function is the math engine for the "Virtual Anchor" concept. 
      * It uses the normalized bounds (Min/Max Time and Price) to determine where the side and 
      * center handles should sit in logical space.
      * 
      * **Logic Table:**
      * - **Top-Left (0):** (Min Time, Max Price)
      * - **Top-Center (6):** (Mid Time, Max Price)
      * - **Top-Right (3):** (Max Time, Max Price)
      * - **Middle-Right (5):** (Max Time, Mid Price)
      * - **Bottom-Right (1):** (Max Time, Min Price)
      * - **Bottom-Center (7):** (Mid Time, Min Price)
      * - **Bottom-Left (2):** (Min Time, Min Price)
      * - **Middle-Left (4):** (Min Time, Mid Price)
      * 
      * @param index - The index of the anchor to calculate (0-7).
      * @returns The calculated `LineToolPoint`, or `null` if the tool is not fully formed.
      */
  _getAnchorPointForIndex(index) {
    if (this._points.length < 2) return null;
    const [start, end] = this._points;
    const minPrice = Math.min(start.price, end.price);
    const maxPrice = Math.max(start.price, end.price);
    const minTime = Math.min(start.timestamp, end.timestamp);
    const maxTime = Math.max(start.timestamp, end.timestamp);
    const midPrice = (minPrice + maxPrice) / 2;
    const midTime = (minTime + maxTime) / 2;
    switch (index) {
      // NOTE: Indices 0 (TL) and 1 (BR) are handled by the calling `getPoint` method's `super.getPoint(index)`
      // which means _points[0] should be (minTime, maxPrice) and _points[1] should be (maxTime, minPrice)
      // 6: Top-Center (TC) -> (MidTime, MaxPrice)
      case 6:
        return { price: maxPrice, timestamp: midTime };
      // 3: Top-Right (TR) -> (MaxTime, MaxPrice)
      case 3:
        return { price: maxPrice, timestamp: maxTime };
      // 5: Middle-Right (MR) -> (MaxTime, MidPrice)
      case 5:
        return { price: midPrice, timestamp: maxTime };
      // 7: Bottom-Center (BC) -> (MidTime, MinPrice)
      case 7:
        return { price: minPrice, timestamp: midTime };
      // 2: Bottom-Left (BL) -> (MinTime, MinPrice)
      case 2:
        return { price: minPrice, timestamp: minTime };
      // 4: Middle-Left (ML) -> (MinTime, MidPrice)
      case 4:
        return { price: midPrice, timestamp: minTime };
      default:
        return null;
    }
  }
};

// vendor/difurious/lightweight-charts-line-tools-fib-retracement/src/model/LineToolFibRetracement.ts
import {
  LineStyle as LineStyle8
} from "lightweight-charts";

// vendor/difurious/lightweight-charts-line-tools-fib-retracement/src/views/LineToolFibRetracementPaneView.ts
import {
  LineStyle as LineStyle7
} from "lightweight-charts";
var LineToolFibRetracementPaneView = class extends LineToolPaneView {
  /**
   * Initializes the Fibonacci View and pre-allocates renderer sets for the 
   * levels configured in the tool options.
   *
   * @param source - The specific Fibonacci model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    /**
     * An array of pooled renderer sets. Each entry contains the line, rectangle, 
     * and label renderers for a specific Fibonacci level.
     * @protected
     */
    __publicField(this, "_levelRenderers", []);
    /**
     * Renderer for the primary trend line (P0 to P1) that defines the Fib range.
     * @protected
     */
    __publicField(this, "_primaryLineRenderer", new SegmentRenderer(new HitTestResult(2 /* MovePoint */)));
    const maxLevels = source.options().levels.length;
    for (let i = 0; i < maxLevels; i++) {
      this._levelRenderers.push({
        line: new SegmentRenderer(new HitTestResult(2 /* MovePoint */)),
        rectangle: new RectangleRenderer(),
        label: new TextRenderer()
      });
    }
  }
  /**
   * Calculates the price difference between the current level and a user-specified 
   * target coefficient.
   * 
   * **Tutorial Note:**
   * This feature allows traders to see exactly how many price units exist between 
   * two specific Fib levels (e.g., "Distance from 0.618 to 0.5").
   *
   * @param config - The configuration for the current level.
   * @param levelPrice - The calculated price of the current level.
   * @param levelsConfig - The full list of level configurations.
   * @param levelsData - The pre-calculated coordinates and prices for all levels.
   * @returns A formatted string like "(Diff: 10.50 from 0.5 line)" or an empty string.
   * @private
   */
  _calculateDistanceText(config, levelPrice, levelsConfig, levelsData) {
    if (!config.distanceFromCoeffEnabled) {
      return "";
    }
    const targetIndex = levelsConfig.findIndex((level) => level.coeff === config.distanceFromCoeff);
    if (targetIndex === -1) {
      return "";
    }
    const targetPrice = levelsData[targetIndex].price;
    const priceDifference = Math.abs(levelPrice - targetPrice);
    if (priceDifference === 0) {
      return "";
    }
    const priceFormatter = this._series.priceFormatter();
    const formattedPriceDifference = priceFormatter.format(priceDifference);
    return ` (Diff: ${formattedPriceDifference} from ${config.distanceFromCoeff} line)`;
  }
  /**
   * Helper to generate a translucent RGBA color string from a hex or rgb input.
   * 
   * **Why use this?**
   * To create the "faded" background effect between Fib levels, we must apply 
   * the user-defined `opacity` to the level's primary `color`. This method parses 
   * various CSS color formats and injects the correct alpha value.
   *
   * @param color - The base color string (Hex or RGB).
   * @param opacity - The alpha value (0 to 1).
   * @returns A valid `rgba(...)` CSS string.
   * @private
   */
  _getFadedColor(color, opacity) {
    let r = 0, g = 0, b = 0;
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    } else if (color.startsWith("rgb")) {
      const matches = color.match(/(\d+(\.\d+)?)/g);
      if (matches && matches.length >= 3) {
        r = parseFloat(matches[0]);
        g = parseFloat(matches[1]);
        b = parseFloat(matches[2]);
      } else {
        return color;
      }
    } else {
      return `rgba(120, 123, 134, ${opacity})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  /**
   * Orchestrates the multi-stage rendering pass for the Fibonacci Retracement.
   * 
   * This method performs the following steps:
   * 1. **Culling Check:** Queries the Model to see if the tool is off-screen.
   * 2. **Data Sync:** Retrieves sorted segment data from the Model.
   * 3. **Pixel Mapping:** Converts logical prices to screen Y-coordinates for all levels.
   * 4. **Render Loop:** Iterates through configured levels to set up lines, fills, and labels.
   *
   * @param height - The height of the pane in pixels.
   * @param width - The width of the pane in pixels.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const model = this._tool;
    const options = model.options();
    const points = model.points();
    if (!options.visible || points.length < model.pointsCount) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const segmentData = model.getLineSegmentPoints().sort((a, b) => b.coeff - a.coeff);
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints) {
      return;
    }
    const [screenP0, screenP1] = this._points;
    const minScreenX = Math.min(screenP0.x, screenP1.x);
    const maxScreenX = Math.max(screenP0.x, screenP1.x);
    const allDerivedLevelCoordinates = segmentData.map((segment) => {
      const price = segment.price;
      const coordinate = this._series.priceToCoordinate(price);
      return { price, coordinate };
    });
    const paneDrawingWidth = this._tool.getChartDrawingWidth();
    const levelsConfig = options.levels.slice().sort((a, b) => b.coeff - a.coeff);
    const lineOptions = {
      ...deepCopy(options.line),
      extend: options.extend,
      join: "miter" /* Miter */,
      cap: "butt" /* Butt */
    };
    const commonCursorOptions = {
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    };
    for (let i = 0; i < levelsConfig.length; i++) {
      const config = levelsConfig[i];
      const levelData = allDerivedLevelCoordinates[i];
      const levelPrice = levelData.price;
      const levelCoord = levelData.coordinate;
      if (levelCoord === null || !isFinite(levelCoord)) continue;
      if (!this._levelRenderers[i]) {
        this._levelRenderers[i] = {
          line: new SegmentRenderer(new HitTestResult(2 /* MovePoint */)),
          rectangle: new RectangleRenderer(),
          label: new TextRenderer()
        };
      }
      const levelRendererSet = this._levelRenderers[i];
      const priceFormatter = this._series.priceFormatter();
      const distanceText = this._calculateDistanceText(config, levelPrice, levelsConfig, allDerivedLevelCoordinates);
      const labelText = `${config.coeff} (${priceFormatter.format(levelPrice)})${distanceText}`;
      const P_TextLeftAnchor = new AnchorPoint(0, levelCoord, i);
      const P_TextRightAnchor = new AnchorPoint(minScreenX, levelCoord, i);
      const finalTextOptions = {
        value: labelText,
        padding: 0,
        wordWrapWidth: 0,
        forceTextAlign: false,
        forceCalculateMaxLineWidth: false,
        alignment: "right" /* Right */,
        font: {
          family: "sans-serif",
          size: 12,
          bold: false,
          italic: false,
          color: config.color
        },
        box: {
          alignment: { horizontal: "right" /* Right */, vertical: "middle" /* Middle */ },
          padding: { x: 5, y: 3 }
        }
      };
      levelRendererSet.label.setData({
        points: [P_TextLeftAnchor, P_TextRightAnchor],
        text: finalTextOptions,
        hitTestBackground: true
      });
      const lineStart = new AnchorPoint(
        options.extend.left ? 0 : minScreenX,
        levelCoord,
        i
      );
      const lineEnd = new AnchorPoint(
        options.extend.right ? paneDrawingWidth : maxScreenX,
        levelCoord,
        i
      );
      levelRendererSet.line.setData({
        points: [lineStart, lineEnd],
        line: { ...lineOptions, color: config.color },
        ...commonCursorOptions
      });
      let hasRectangle = false;
      if (i > 0) {
        const prevConfig = levelsConfig[i - 1];
        const prevLevelCoord = allDerivedLevelCoordinates[i - 1].coordinate;
        const rectMinY = Math.min(levelCoord, prevLevelCoord);
        const rectMaxY = Math.max(levelCoord, prevLevelCoord);
        if (prevConfig.opacity > 0) {
          const fillColor = this._getFadedColor(prevConfig.color, prevConfig.opacity);
          const rectPoint1 = new AnchorPoint(minScreenX, rectMinY, 0);
          const rectPoint2 = new AnchorPoint(maxScreenX, rectMaxY, 1);
          levelRendererSet.rectangle.setData({
            points: [rectPoint1, rectPoint2],
            background: { color: fillColor },
            border: { width: 0, style: LineStyle7.Solid, radius: 0 },
            extend: options.extend,
            hitTestBackground: false
          });
          hasRectangle = true;
        }
      }
      if (hasRectangle) {
        this._renderer.append(levelRendererSet.rectangle);
      }
      this._renderer.append(levelRendererSet.line);
      this._renderer.append(levelRendererSet.label);
    }
    this._addAnchors(this._renderer);
  }
  /**
   * Adds the two primary interactive anchor points (P0 and P1).
   *
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    this._points.forEach((point, index) => {
      const anchor = this.createLineAnchor({
        points: [point]
      }, index);
      renderer.append(anchor);
    });
  }
};

// vendor/difurious/lightweight-charts-line-tools-fib-retracement/src/model/LineToolFibRetracement.ts
var FibRetracementOptionDefaults = {
  visible: true,
  editable: true,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  line: {
    width: 1,
    style: LineStyle8.Solid
  },
  // Global Extension - sets extension for all lines
  extend: { left: false, right: false },
  levels: [
    { color: "#787b86", coeff: 0, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#f23645", coeff: 0.236, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#81c784", coeff: 0.382, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#4caf50", coeff: 0.5, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#089981", coeff: 0.618, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#64b5f6", coeff: 0.786, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#787b86", coeff: 1, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#2962ff", coeff: 1.618, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#f23645", coeff: 2.618, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#9c27b0", coeff: 3.618, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
    { color: "#e91e63", coeff: 4.236, opacity: 0, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 }
  ],
  tradeStrategy: {
    enabled: false,
    longOrShort: "",
    fibBracketOrders: [
      {
        uniqueId: null,
        conditionLevelCoeff: null,
        conditionLevelPrice: 0,
        entryLevelCoeff: null,
        entryLevelPrice: 0,
        stopMethod: "fib",
        stopLevelCoeff: null,
        stopPriceInput: null,
        stopPointsInput: null,
        finalStopPrice: 0,
        ptMethod: "fib",
        ptLevelCoeff: null,
        ptPriceInput: null,
        ptPointsInput: null,
        finalPtPrice: 0,
        isMoveStopToEnabled: false,
        moveStopToMethod: "fib",
        moveStopToLevelCoeff: null,
        moveStopToPriceInput: null,
        moveStopToPointsInput: null,
        finalMoveStopToPrice: 0,
        triggerBracketUniqueId: null
      }
    ]
  }
};
var LineToolFibRetracement = class extends BaseLineTool {
  /**
   * Initializes the Fibonacci Retracement tool.
   *
   * **Tutorial Note on Construction:**
   * 1. **Deep Copy:** It performs a `deepCopy` of the `FibRetracementOptionDefaults` to ensure
   *    this tool instance has its own unique levels array that won't affect other instances.
   * 2. **Merge:** It merges the user's `options` to allow custom level colors or visibility.
   * 3. **View:** It assigns the `LineToolFibRetracementPaneView`, which handles the heavy lifting
   *    of iterating through levels and drawing lines and fills.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(FibRetracementOptionDefaults);
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      "FibRetracement",
      2,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('FibRetracement').
     *
     * @override
     */
    __publicField(this, "toolType", "FibRetracement");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Fib Retracement requires exactly **2 points** to define the range.
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolFibRetracementPaneView(this, this._chart, this._series)]);
  }
  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * Since the tool is defined by 2 points, the valid handles are at index 0 and 1.
   *
   * @override
   * @returns `1`
   */
  maxAnchorIndex() {
    return 1;
  }
  /**
   * Confirms that this tool can be created via discrete mouse clicks.
   *
   * @override
   * @returns `true`
   */
  supportsClickClickCreation() {
    return true;
  }
  /**
   * Confirms that this tool can be created via a click-and-drag gesture.
   *
   * @override
   * @returns `true`
   */
  supportsClickDragCreation() {
    return true;
  }
  /**
   * Enables geometric constraints (Shift key) during click-based creation.
   *
   * @override
   * @returns `true`
   */
  supportsShiftClickClickConstraint() {
    return true;
  }
  /**
   * Enables geometric constraints (Shift key) during drag-based creation or editing.
   *
   * @override
   * @returns `true`
   */
  supportsShiftClickDragConstraint() {
    return true;
  }
  /**
   * Calculates the exact logical coordinates (Time and Price) for every configured Fibonacci level.
   *
   * **Tutorial Note on the Math:**
   * 1. It calculates the vertical range (Price Difference) between the two defining points (P0 and P1).
   * 2. For each coefficient (e.g., 0.618), it calculates the resulting price: `Price = P1 - (Range * Coefficient)`.
   * 3. It generates two logical points per level, spanning horizontally between the min/max time of the anchors.
   *
   * This method serves as the "Calculated Data Source" for both the rendering logic and the culling engine.
   *
   * @returns An array of level data, including the start/end logical points, the raw price, and the coefficient.
   */
  getLineSegmentPoints() {
    const points = this.points();
    if (points.length < 2) return [];
    const [p0, p1] = points;
    const options = this.options();
    const priceDiff = p1.price - p0.price;
    const tMin = Math.min(p0.timestamp, p1.timestamp);
    const tMax = Math.max(p0.timestamp, p1.timestamp);
    const segmentPoints = [];
    for (const level of options.levels) {
      const rawPrice = p1.price - priceDiff * level.coeff;
      const price = rawPrice;
      const startPoint = { timestamp: tMin, price };
      const endPoint = { timestamp: tMax, price };
      segmentPoints.push({
        start: startPoint,
        end: endPoint,
        price,
        coeff: level.coeff
      });
    }
    return segmentPoints;
  }
  /**
   * Flattens all calculated Fibonacci levels into a single array of logical points for the culling engine.
   *
   * **Why is this needed?**
   * The culling engine requires a flat list of points to perform its geometric intersection tests. 
   * Since a Fib Retracement isn't just one line but a collection of many, this helper ensures 
   * every level is accounted for when determining if the tool should be rendered.
   *
   * @returns A flat array of `LineToolPoint` objects representing every level.
   */
  getAllLogicalPointsForCulling() {
    const segments = this.getLineSegmentPoints();
    const allLogicalPoints = [];
    for (const segment of segments) {
      allLogicalPoints.push(segment.start);
      allLogicalPoints.push(segment.end);
    }
    return allLogicalPoints;
  }
  /**
   * Intentionally empty override to prevent automatic point sorting.
   *
   * **Tutorial Note:**
   * In many tools, sorting points by time (Left-to-Right) is helpful. However, in a Fibonacci 
   * Retracement, the **direction** of the draw (High-to-Low vs. Low-to-High) defines whether 
   * the tool measures a "Retracement" or an "Extension". 
   * 
   * By disabling normalization, we preserve the user's intended directionality.
   *
   * @override
   */
  normalize() {
  }
  /**
   * Implements a horizontal lock (Price Lock) constraint when the Shift key is held during editing.
   *
   * **Logic Details:**
   * When dragging an anchor point while holding Shift, the tool locks the movement to the 
   * anchor's **original Price level**. This allows the user to slide the Fibonacci tool 
   * left or right across the timeline to align with different bars without accidentally 
   * shifting the vertical price range.
   *
   * @param pointIndex - The index of the anchor being dragged.
   * @param rawScreenPoint - The current mouse position.
   * @param phase - The interaction phase (Creation or Editing).
   * @param originalLogicalPoint - The snapshot of the point's logical state before the drag began.
   * @param allOriginalLogicalPoints - The full state of all points before the drag began.
   * @returns The constrained result locking the Y-axis to the original price.
   * @override
   */
  getShiftConstrainedPoint(pointIndex, rawScreenPoint, phase, originalLogicalPoint, allOriginalLogicalPoints) {
    let referenceLogicalPoint = null;
    if (phase === "creation" /* Creation */) {
    } else {
      referenceLogicalPoint = originalLogicalPoint;
    }
    if (!referenceLogicalPoint) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    const referenceScreenPoint = this.pointToScreenPoint(referenceLogicalPoint);
    if (!referenceScreenPoint) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    return {
      point: new Point(rawScreenPoint.x, referenceScreenPoint.y),
      snapAxis: "price"
    };
  }
  /**
   * Performs a hit test for the Fibonacci tool by delegating to its associated Pane View.
   *
   * **Architecture Note:**
   * Because this tool renders many independent segments (lines) and areas (fills), 
   * the logic for "What did the user click?" is most accurately handled by the View's 
   * `CompositeRenderer`. 
   * 
   * Calling `renderer()` on the view ensures the visual state is up-to-date before the 
   * hit-test is performed.
   *
   * @param x - X coordinate in pixels.
   * @param y - Y coordinate in pixels.
   * @returns A hit result if the mouse is over any line, fill, or handle, otherwise `null`.
   * @override
   */
  _internalHitTest(x, y) {
    if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
      return null;
    }
    const paneView = this._paneViews[0];
    paneView.renderer();
    const compositeRenderer = paneView.renderer();
    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null;
    }
    return compositeRenderer.hitTest(x, y);
  }
  /**
   * Calculates the Fibonacci tool's visibility using an Area-Based Zone strategy.
   * 
   * ### Tutorial Note on Fibonacci Area Culling
   * Fibonacci tools represent a "Zone of Interest" on the chart. To prevent 
   * background fills from "popping" out when the user zooms in between levels, 
   * we treat the entire tool as a solid 2D area.
   * 
   * 1. We identify the Price extremes (the highest and lowest level prices).
   * 2. We identify the Time extremes (earliest and latest anchor point).
   * 3. We pass this bounding area to the core with the 'isAreaBased' flag.
   * 
   * This instructs the culling engine to perform a 2D intersection check. 
   * It also automatically handles infinite extensions by expanding this 
   * zone to the horizon, ensuring visibility even when the anchors 
   * are far off-screen.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const options = this.options();
    const points = this.points();
    if (points.length < this.pointsCount || this.isCreating() || this.isEditing()) {
      this._setIsCulled(false);
      return;
    }
    const segmentData = this.getLineSegmentPoints();
    if (segmentData.length === 0) {
      this._setIsCulled(false);
      return;
    }
    let minP = Infinity;
    let maxP = -Infinity;
    for (const segment of segmentData) {
      minP = Math.min(minP, segment.price);
      maxP = Math.max(maxP, segment.price);
    }
    const minT = Math.min(points[0].timestamp, points[1].timestamp);
    const maxT = Math.max(points[0].timestamp, points[1].timestamp);
    const zonePoints = [
      { timestamp: minT, price: minP },
      { timestamp: maxT, price: maxP }
    ];
    const cullingState = getToolCullingState(
      zonePoints,
      this,
      options.extend,
      void 0,
      void 0,
      true
      // isAreaBased: true
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
};

// vendor/difurious/lightweight-charts-line-tools-fib-retracement/src/index.ts
var FIB_RETRACEMENT_NAME = "FibRetracement";
function registerFibRetracementPlugin(corePlugin) {
  corePlugin.registerLineTool(FIB_RETRACEMENT_NAME, LineToolFibRetracement);
  console.log(`Registered Line Tool: ${FIB_RETRACEMENT_NAME}`);
}

// vendor/difurious/lightweight-charts-line-tools-price-range/src/model/LineToolPriceRange.ts
import {
  LineStyle as LineStyle10
} from "lightweight-charts";

// vendor/difurious/lightweight-charts-line-tools-price-range/src/views/LineToolPriceRangePaneView.ts
import {
  LineStyle as LineStyle9
} from "lightweight-charts";
var LineToolPriceRangePaneView = class extends LineToolPaneView {
  /**
   * Initializes the Price Range View.
   *
   * @param source - The specific Price Range model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  constructor(source, chart, series) {
    super(source, chart, series);
    // Two segment renderers for the two center lines
    /**
     * Internal renderer for the horizontal center line (crosshair).
     * @protected
     */
    __publicField(this, "_horizontalLineRenderer", new SegmentRenderer());
    /**
     * Internal renderer for the vertical center line (crosshair).
     * @protected
     */
    __publicField(this, "_verticalLineRenderer", new SegmentRenderer());
    // A second text renderer for the dynamic price difference label (the forced text)
    /**
     * Internal renderer specifically for the dynamic price difference label (e.g., "+50.00").
     * @protected
     */
    __publicField(this, "_priceDifferenceLabelRenderer", new TextRenderer());
  }
  /**
   * The core update logic.
   *
   * It calculates the screen coordinates for the corners, performs a sub-segment culling check
   * (checking edges vs viewport), and then systematically configures and appends the
   * Rectangle, Line, and Text renderers to the composite.
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  _updateImpl(height, width) {
    this._invalidated = false;
    this._renderer.clear();
    const tool = this._tool;
    const options = tool.options();
    if (!options.visible) {
      return;
    }
    if (this._tool.isCulled()) {
      return;
    }
    const hasScreenPoints = this._updatePoints();
    if (!hasScreenPoints || this._points.length < tool.pointsCount) {
      return;
    }
    const compositeRenderer = this._renderer;
    const P0 = this._points[0];
    const P1 = this._points[1];
    const minX = Math.min(P0.x, P1.x);
    const maxX = Math.max(P0.x, P1.x);
    const minY = Math.min(P0.y, P1.y);
    const maxY = Math.max(P0.y, P1.y);
    const topLeftScreen = new AnchorPoint(minX, minY, 0);
    const bottomRightScreen = new AnchorPoint(maxX, maxY, 1);
    const rectBodyPoints = [topLeftScreen, bottomRightScreen];
    this._rectangleRenderer.setData({
      ...deepCopy(options.priceRange.rectangle),
      points: rectBodyPoints,
      hitTestBackground: false,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor
    });
    compositeRenderer.append(this._rectangleRenderer);
    if (options.priceRange.showCenterHorizontalLine) {
      const midY = (minY + maxY) / 2;
      const horizontalLinePoints = [
        new AnchorPoint(minX, midY, 0),
        new AnchorPoint(maxX, midY, 1)
      ];
      this._horizontalLineRenderer.setData({
        points: horizontalLinePoints,
        line: {
          ...options.priceRange.horizontalLine,
          // Ensure horizontal line is drawn full width or extended
          extend: options.priceRange.rectangle.extend,
          join: "miter",
          cap: "butt"
        }
      });
      compositeRenderer.append(this._horizontalLineRenderer);
    }
    if (options.priceRange.showCenterVerticalLine) {
      const midX = (minX + maxX) / 2;
      const verticalLinePoints = [
        new AnchorPoint(midX, minY, 0),
        new AnchorPoint(midX, maxY, 1)
      ];
      this._verticalLineRenderer.setData({
        points: verticalLinePoints,
        line: {
          ...options.priceRange.verticalLine,
          extend: { left: false, right: false },
          // Vertical line does not extend horizontally
          join: "miter",
          cap: "butt"
        }
      });
      compositeRenderer.append(this._verticalLineRenderer);
    }
    if (options.text.value) {
      const alignment = options.text.box.alignment;
      let pivotX;
      let pivotY;
      switch (alignment.vertical) {
        case "top" /* Top */:
          pivotY = minY;
          break;
        case "bottom" /* Bottom */:
          pivotY = maxY;
          break;
        case "middle" /* Middle */:
        default:
          pivotY = (minY + maxY) / 2;
          break;
      }
      switch (alignment.horizontal) {
        case "left" /* Left */:
          pivotX = minX;
          break;
        case "right" /* Right */:
          pivotX = maxX;
          break;
        case "center" /* Center */:
        default:
          pivotX = (minX + maxX) / 2;
          break;
      }
      const pivot = new AnchorPoint(pivotX, pivotY, 0);
      const textRendererData = {
        points: [topLeftScreen, bottomRightScreen],
        text: deepCopy(options.text),
        hitTestBackground: true
      };
      this._labelRenderer.setData(textRendererData);
      compositeRenderer.append(this._labelRenderer);
    }
    const activePoints = tool.points();
    if (activePoints.length >= 2) {
      this._addPriceDifferenceLabel(compositeRenderer, tool, P0, P1, topLeftScreen, bottomRightScreen);
    }
    this._addAnchors(compositeRenderer);
  }
  /**
   * Calculates and draws the dynamic price difference label.
   *
   * **Logic:**
   * 1. **Direction:** Determines if price went Up or Down to set color/position (Top vs Bottom).
   * 2. **Formatting:** Uses the Series formatter to get the exact string representation of prices.
   * 3. **Positioning:** Calculates the geometric center of the specific edge (Top or Bottom) to anchor the text.
   *
   * @param renderer - The composite renderer to append to.
   * @param tool - The tool model.
   * @param P0 - Screen point start.
   * @param P1 - Screen point end.
   * @param topLeftScreen - Normalized Top-Left.
   * @param bottomRightScreen - Normalized Bottom-Right.
   */
  _addPriceDifferenceLabel(renderer, tool, P0, P1, topLeftScreen, bottomRightScreen) {
    const options = tool.options();
    const series = this._tool.getSeries();
    const priceRangeOptions = options.priceRange;
    const allActivePoints = tool.points();
    if (allActivePoints.length < 2) return;
    const price0Raw = allActivePoints[0];
    const price1Raw = allActivePoints[1];
    const isUpward = price1Raw.price >= price0Raw.price;
    const showLabel = isUpward ? priceRangeOptions.showTopPrice : priceRangeOptions.showBottomPrice;
    if (!showLabel) {
      return;
    }
    const priceFormatter = series.priceFormatter();
    const P0_price_value = parseFloat(priceFormatter.format(price0Raw.price));
    const P1_price_value = parseFloat(priceFormatter.format(price1Raw.price));
    const signedPriceDifference = P1_price_value - P0_price_value;
    const priceDifferenceMagnitude = Math.abs(signedPriceDifference);
    const sign = isUpward ? "+" : "-";
    const priceMagnitudeText = priceFormatter.format(priceDifferenceMagnitude);
    const percentChange = P0_price_value === 0 ? 0 : signedPriceDifference / P0_price_value * 100;
    const tickCount = Math.round(priceDifferenceMagnitude / 0.25);
    const startLogical = this._chart.timeScale().coordinateToLogical(P0.x);
    const endLogical = this._chart.timeScale().coordinateToLogical(P1.x);
    const barCount = startLogical === null || endLogical === null ? 0 : Math.max(1, Math.round(Math.abs(Number(endLogical) - Number(startLogical))));
    const elapsedSeconds = Math.abs(Number(price1Raw.timestamp) - Number(price0Raw.timestamp));
    const elapsedText = elapsedSeconds < 3600 ? `${Math.max(1, Math.round(elapsedSeconds / 60))}m` : elapsedSeconds < 86400 ? `${Math.floor(elapsedSeconds / 3600)}h ${Math.round(elapsedSeconds % 3600 / 60)}m` : `${Math.floor(elapsedSeconds / 86400)}d ${Math.round(elapsedSeconds % 86400 / 3600)}h`;
    const priceText = `${sign}${priceMagnitudeText} (${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}%)
${tickCount.toLocaleString()} ticks \xB7 ${barCount} bars
${elapsedText}`;
    const minX = Math.min(P0.x, P1.x);
    const maxX = Math.max(P0.x, P1.x);
    const minY = Math.min(P0.y, P1.y);
    const maxY = Math.max(P0.y, P1.y);
    const geometricCenterX = (minX + maxX) / 2;
    const geometricCenterY = isUpward ? minY : maxY;
    const centerEdgePivot = new AnchorPoint(geometricCenterX, geometricCenterY, 0);
    const finalLabelOptions = deepCopy(options.text);
    finalLabelOptions.value = priceText;
    const placementVerticalAlignment = isUpward ? "top" /* Top */ : "bottom" /* Bottom */;
    finalLabelOptions.box.alignment.horizontal = "center" /* Center */;
    finalLabelOptions.box.alignment.vertical = placementVerticalAlignment;
    finalLabelOptions.alignment = "center" /* Center */;
    finalLabelOptions.font.size = 11;
    finalLabelOptions.font.bold = true;
    finalLabelOptions.font.family = "ui-monospace, SFMono-Regular, Menlo, monospace";
    finalLabelOptions.box.padding = { x: 9, y: 6 };
    finalLabelOptions.box.border = { color: "rgba(125,165,255,0.95)", width: 1, radius: 5, highlight: false, style: LineStyle9.Solid };
    finalLabelOptions.box.background = { color: "rgba(41,98,255,0.94)", inflation: { x: 0, y: 0 } };
    finalLabelOptions.box.shadow = { blur: 8, color: "rgba(0,0,0,0.35)", offset: { x: 0, y: 2 } };
    finalLabelOptions.box.offset = { x: 0, y: isUpward ? -12 : 12 };
    const textRendererData = {
      points: [centerEdgePivot],
      text: finalLabelOptions,
      hitTestBackground: true
    };
    this._priceDifferenceLabelRenderer.setData(textRendererData);
    renderer.append(this._priceDifferenceLabelRenderer);
  }
  /**
   * Creates and adds the 8 interactive anchor points.
   *
   * **Tutorial Note on Anchor Generation:**
   * Unlike simple tools, we don't just loop through points. We manually manufacture 8 specific anchors:
   * - **0-3 (Corners):** Combinations of Min/Max X and Y.
   * - **4-7 (Edges):** Averages of X or Y to find midpoints.
   *
   * We assign specific cursors (e.g., `VerticalResize` for top/bottom edges) to give the user
   * visual feedback on how that specific handle will behave.
   *
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   * @override
   */
  _addAnchors(renderer) {
    if (this._points.length < 2) return;
    const P0 = this._points[0];
    const P1 = this._points[1];
    const anchor0 = new AnchorPoint(P0.x, P0.y, 0, false, this._getAnchorCursor(0));
    const anchor1 = new AnchorPoint(P1.x, P1.y, 1, false, this._getAnchorCursor(1));
    const anchor2 = new AnchorPoint(P0.x, P1.y, 2, false, this._getAnchorCursor(2));
    const anchor3 = new AnchorPoint(P1.x, P0.y, 3, false, this._getAnchorCursor(3));
    const midX = (P0.x + P1.x) / 2;
    const midY = (P0.y + P1.y) / 2;
    const anchor4 = new AnchorPoint(P0.x, midY, 4, true, "e-resize" /* HorizontalResize */);
    const anchor5 = new AnchorPoint(P1.x, midY, 5, true, "e-resize" /* HorizontalResize */);
    const anchor6 = new AnchorPoint(midX, P0.y, 6, true, "n-resize" /* VerticalResize */);
    const anchor7 = new AnchorPoint(midX, P1.y, 7, true, "n-resize" /* VerticalResize */);
    const anchorData = {
      // The order here doesn't matter for logic, only drawing order
      points: [
        anchor0,
        anchor1,
        anchor2,
        anchor3,
        anchor4,
        anchor5,
        anchor6,
        anchor7
      ]
    };
    const toolOptions = this._tool.options();
    renderer.append(this.createLineAnchor({
      ...anchorData,
      defaultAnchorHoverCursor: toolOptions.defaultAnchorHoverCursor,
      defaultAnchorDragCursor: toolOptions.defaultAnchorDragCursor
    }, 0));
  }
  /**
   * Determines the specific CSS cursor for an anchor based on its position and the box orientation.
   *
   * **Complexity:**
   * If the user inverts the box (drags P1 above/left of P0), the "Top Left" visual corner might
   * actually be the P1 logical point. This method checks the `isRight` / `isDown` geometry to
   * ensure that the resizing cursors (NW-SE vs NE-SW) always match the visual diagonal.
   *
   * @param index - The anchor index.
   * @returns The appropriate {@link PaneCursorType}.
   * @private
   */
  _getAnchorCursor(index) {
    const P0 = this._points[0];
    const P1 = this._points[1];
    const isRight = P1.x >= P0.x;
    const isDown = P1.y >= P0.y;
    const nwSe = "nwse-resize" /* DiagonalNwSeResize */;
    const neSw = "nesw-resize" /* DiagonalNeSwResize */;
    switch (index) {
      case 0:
        return isRight === isDown ? nwSe : neSw;
      case 1:
        return isRight === isDown ? nwSe : neSw;
      case 2:
        return isRight === isDown ? neSw : nwSe;
      case 3:
        return isRight === isDown ? neSw : nwSe;
      case 4:
        return "e-resize" /* HorizontalResize */;
      case 5:
        return "e-resize" /* HorizontalResize */;
      case 6:
        return "n-resize" /* VerticalResize */;
      case 7:
        return "n-resize" /* VerticalResize */;
      default:
        return "move" /* Move */;
    }
  }
};

// vendor/difurious/lightweight-charts-line-tools-price-range/src/model/LineToolPriceRange.ts
var PriceRangeOptionDefaults = {
  visible: true,
  editable: true,
  defaultHoverCursor: "pointer" /* Pointer */,
  defaultDragCursor: "grabbing" /* Grabbing */,
  defaultAnchorHoverCursor: "pointer" /* Pointer */,
  defaultAnchorDragCursor: "grabbing" /* Grabbing */,
  notEditableCursor: "not-allowed" /* NotAllowed */,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  // --- 1. Top-level 'text' property (common to Rectangle/TrendLine pattern) ---
  text: {
    value: "",
    // Default value
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false,
    alignment: "center" /* Center */,
    font: {
      color: "rgba(255, 255, 255, 1)",
      size: 12,
      bold: false,
      italic: false,
      family: "sans-serif"
    },
    box: {
      alignment: { vertical: "middle" /* Middle */, horizontal: "center" /* Center */ },
      angle: 0,
      scale: 1,
      padding: { x: 0, y: 0 },
      maxHeight: 0,
      // Placeholder
      shadow: { blur: 0, color: "rgba(0,0,0,0)", offset: { x: 0, y: 0 } },
      border: { color: "rgba(0,0,0,0)", width: 0, radius: 0, highlight: false, style: LineStyle10.Solid },
      background: { color: "rgba(0,0,0,0)", inflation: { x: 0, y: 0 } }
    }
  },
  // Casting is fine here
  // --- 2. Required NESTING: Top-level 'priceRange' property holding the structural options ---
  priceRange: {
    // <--- THIS IS THE MISSING PROPERTY
    rectangle: {
      extend: { left: false, right: false },
      background: { color: "rgba(41,98,255,0.10)" },
      border: { width: 1, style: LineStyle10.Dashed, color: "rgba(108,156,255,0.72)", radius: 0 }
    },
    verticalLine: {
      width: 1,
      color: "#9c27b0",
      style: LineStyle10.Solid,
      join: "miter",
      cap: "butt",
      end: { left: 0 /* Normal */, right: 0 /* Normal */ },
      extend: { left: false, right: false }
    },
    // Casting is necessary
    horizontalLine: {
      width: 1,
      color: "#9c27b0",
      style: LineStyle10.Dashed,
      join: "miter",
      cap: "butt",
      end: { left: 0 /* Normal */, right: 0 /* Normal */ },
      extend: { left: false, right: false }
    },
    showCenterHorizontalLine: false,
    showCenterVerticalLine: false,
    showTopPrice: true,
    showBottomPrice: true
  }
};
var LineToolPriceRange = class extends BaseLineTool {
  /**
   * Initializes the Price Range tool.
   *
   * **Tutorial Note on Construction:**
   * 1. **Base Defaults:** Uses `PriceRangeOptionDefaults` which includes the nested `priceRange` config.
   * 2. **User Options:** Merges user provided settings.
   * 3. **View:** Assigns `LineToolPriceRangePaneView`, which handles the rendering of the multi-part visual
   *    (rectangle, crosshairs, dynamic labels).
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  constructor(coreApi, chart, series, horzScaleBehavior, options = {}, points = [], priceAxisLabelStackingManager) {
    const finalOptions = deepCopy(PriceRangeOptionDefaults);
    merge(finalOptions, options);
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      "PriceRange",
      2,
      priceAxisLabelStackingManager
    );
    /**
     * The unique identifier for this tool type ('PriceRange').
     *
     * @override
     */
    __publicField(this, "toolType", "PriceRange");
    /**
     * Defines the number of anchor points required to draw this tool.
     *
     * A Price Range is defined by exactly **2 points** (Start Corner and End Corner).
     *
     * @override
     */
    __publicField(this, "pointsCount", 2);
    this._setPaneViews([new LineToolPriceRangePaneView(this, this._chart, this._series)]);
  }
  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * The Price Range tool supports 8 distinct handles:
   * - **0-1:** The actual corners (P0, P1).
   * - **2-3:** The virtual corners (Top-Right / Bottom-Left).
   * - **4-7:** The edge midpoints (Top, Bottom, Left, Right).
   *
   * Returning `7` ensures the Interaction Manager tracks drag events for all of them.
   *
   * @override
   * @returns `7`
   */
  maxAnchorIndex() {
    return 7;
  }
  /**
   * Confirms that this tool can be created via the "Click-Click" method.
   *
   * @override
   * @returns `true`
   */
  supportsClickClickCreation() {
    return true;
  }
  /**
   * Confirms that this tool can be created via the "Click-Drag" method.
   *
   * @override
   * @returns `true`
   */
  supportsClickDragCreation() {
    return true;
  }
  /**
   * Enables geometric constraints (Shift key) during "Click-Click" creation.
   *
   * @override
   * @returns `true`
   */
  supportsShiftClickClickConstraint() {
    return true;
  }
  /**
   * Enables geometric constraints (Shift key) during "Click-Drag" creation.
   *
   * @override
   * @returns `true`
   */
  supportsShiftClickDragConstraint() {
    return true;
  }
  /**
   * Handles complex resize logic for the 8 specific anchor points.
   *
   * **Tutorial Note on Virtual Anchors:**
   * When a user drags a virtual anchor (like the "Top Edge"), we don't just move a point.
   * We act as if the user is resizing the bounding box in a specific direction.
   *
   * - **Indices 0-1:** Standard update of P0/P1.
   * - **Indices 2-3 (Virtual Corners):** We update a mix of P0 and P1 coordinates (e.g., drag TR updates P0.y and P1.x).
   * - **Indices 4-7 (Edges):** We constrain the update to a single axis (e.g., drag Top Edge only updates P0.y).
   *
   * @param index - The index of the anchor being dragged (0-7).
   * @param point - The new logical position.
   * @override
   */
  setPoint(index, point) {
    if (index < 2) {
      super.setPoint(index, point);
      return;
    }
    const P0 = this._points[0];
    const P1 = this._points[1];
    switch (index) {
      // --- Corner Anchors (Invert freely) ---
      case 2:
        P0.timestamp = point.timestamp;
        P1.price = point.price;
        break;
      case 3:
        P0.price = point.price;
        P1.timestamp = point.timestamp;
        break;
      // --- Side Anchors (Single-Axis Movement) ---
      case 4:
        P0.timestamp = point.timestamp;
        break;
      case 5:
        P1.timestamp = point.timestamp;
        break;
      case 6:
        P0.price = point.price;
        break;
      case 7:
        P1.price = point.price;
        break;
    }
    this._triggerChartUpdate();
  }
  /**
   * Calculates the logical position for any of the 8 anchors.
   *
   * **Logic:**
   * - **0-1:** Returns the stored points P0, P1.
   * - **2-3:** Returns synthesized corners (e.g., { P0.x, P1.y }).
   * - **4-7:** Returns synthesized edge midpoints (e.g., Average(P0.x, P1.x), P0.y).
   *
   * This allows the `LineAnchorRenderer` to draw handles at locations that don't technically exist
   * in the `_points` array.
   *
   * @param index - The anchor index.
   * @returns The calculated {@link LineToolPoint}, or `null`.
   * @override
   */
  getPoint(index) {
    if (this._points.length < 2) {
      return super.getPoint(index);
    }
    const P0 = this._points[0];
    const P1 = this._points[1];
    const midPrice = (P0.price + P1.price) / 2;
    const midTime = (P0.timestamp + P1.timestamp) / 2;
    switch (index) {
      // Primary Anchors
      case 0:
        return P0;
      // Start
      case 1:
        return P1;
      // End
      // Corner Anchors (Topology: X from one, Y from the other)
      case 2:
        return { price: P1.price, timestamp: P0.timestamp };
      // P0 Time, P1 Price
      case 3:
        return { price: P0.price, timestamp: P1.timestamp };
      // P1 Time, P0 Price
      // Side Anchors (Topology: One fixed axis, one Midpoint)
      case 4:
        return { price: midPrice, timestamp: P0.timestamp };
      // Left/Right (P0 Time)
      case 5:
        return { price: midPrice, timestamp: P1.timestamp };
      // Left/Right (P1 Time)
      case 6:
        return { price: P0.price, timestamp: midTime };
      // Top/Bottom (P0 Price)
      case 7:
        return { price: P1.price, timestamp: midTime };
      // Top/Bottom (P1 Price)
      default:
        return null;
    }
  }
  /**
   * Intentionally empty override.
   *
   * **Why?**
   * The Price Range tool relies on the specific relationship between P0 and P1 to determine direction (Up/Down).
   * Normalizing (sorting by time/price) could flip P0 and P1, inverting the calculated "direction"
   * (Positive/Negative price change) and confusing the anchor drag logic implemented in `setPoint`.
   *
   * @override
   */
  normalize() {
  }
  /**
   * Implements granular Shift constraint logic for the 8 different anchor types.
   *
   * **Tutorial Note:**
   * The behavior of "Shift" depends on *what* you are dragging:
   * 1. **Creation:** Standard lock (Force Horizontal/Vertical relative to start).
   * 2. **Edge Anchors (4-7):** Already locked to one axis by definition, so Shift might force a specific coordinate alignment.
   * 3. **Corner Anchors (0-3):** Compares the delta X vs delta Y from the *opposing* corner.
   *    - If dragging more Horizontal, lock Price (Horizontal Line).
   *    - If dragging more Vertical, lock Time (Vertical Line).
   *
   * @param pointIndex - The anchor index.
   * @param rawScreenPoint - Mouse position.
   * @param phase - Creation or Editing.
   * @param originalLogicalPoint - Starting position of the drag.
   * @param allOriginalLogicalPoints - Snapshot of all points.
   * @returns The constrained result.
   * @override
   */
  /*
  	public override getShiftConstrainedPoint(
  		pointIndex: number,
  		rawScreenPoint: Point,
  		phase: InteractionPhase,
  		originalLogicalPoint: LineToolPoint,
  		allOriginalLogicalPoints: LineToolPoint[]
  	): ConstraintResult {
  		// 1. Get the screen coordinate of the anchor being dragged BEFORE it moved.
  		const originalScreenPoint = this.pointToScreenPoint(originalLogicalPoint);
  
  		if (!originalScreenPoint) {
  			return { point: rawScreenPoint, snapAxis: 'none' };
  		}
  
  		// --- Creation Phase ---
  		if (phase === InteractionPhase.Creation) {
  			// Standard: Lock to produce a straight horizontal line
  			const P0_logical = allOriginalLogicalPoints[0];
  			const P0_screen = this.pointToScreenPoint(P0_logical)!;
  
  			return {
  				point: new Point(rawScreenPoint.x, P0_screen.y),
  				snapAxis: 'price', 
  			};
  		}
  
  		// --- Editing Phase ---
  		
  		// 1. Side Resizers (4, 5, 6, 7)
  		// These should effectively ignore Shift (or always apply it), 
  		// because a side anchor only has one degree of freedom anyway.
  		if (pointIndex === 4 || pointIndex === 5) { // Vertical Lines (Move Horizontal)
  			return {
  				point: new Point(rawScreenPoint.x, originalScreenPoint.y),
  				snapAxis: 'price', // Snap Price (Keep Y constant)
  			};
  		}
  		if (pointIndex === 6 || pointIndex === 7) { // Horizontal Lines (Move Vertical)
  			return {
  				point: new Point(originalScreenPoint.x, rawScreenPoint.y),
  				snapAxis: 'time', // Snap Time (Keep X constant)
  			};
  		}
  
  		// 2. Corner Resizers (0, 1, 2, 3)
  		// When holding Shift on a corner, usually we want to lock to EITHER vertical OR horizontal
  		// relative to the opposing anchor.
  		
  		// Find the opposing anchor index to determine the pivot point
  		// 0(Start) <-> 1(End)
  		// 2(P0x,P1y) <-> 3(P1x,P0y)
  		let opposingIndex = -1;
  		if (pointIndex === 0) opposingIndex = 1;
  		else if (pointIndex === 1) opposingIndex = 0;
  		else if (pointIndex === 2) opposingIndex = 3;
  		else if (pointIndex === 3) opposingIndex = 2;
  
  		const opposingLogical = allOriginalLogicalPoints[opposingIndex];
  		const opposingScreen = this.pointToScreenPoint(opposingLogical);
  
  		if (opposingScreen) {
  			// Calculate delta from the pivot (opposing corner)
  			const dx = Math.abs(rawScreenPoint.x - opposingScreen.x);
  			const dy = Math.abs(rawScreenPoint.y - opposingScreen.y);
  
  			// If X delta is bigger, lock Y (Horizontal Move). If Y delta bigger, lock X (Vertical Move).
  			if (dx > dy) {
  				return {
  					point: new Point(rawScreenPoint.x, originalScreenPoint.y),
  					snapAxis: 'price',
  				};
  			} else {
  				return {
  					point: new Point(originalScreenPoint.x, rawScreenPoint.y),
  					snapAxis: 'time',
  				};
  			}
  		}
  
  		// Fallback: Just lock Y if we can't calculate opposing (matches previous logic)
  		return {
  			point: new Point(rawScreenPoint.x, originalScreenPoint.y),
  			snapAxis: 'price',
  		};
  	}
  	*/
  /**
   * Implements a Price-based Shift constraint specifically for the editing (resizing) phase.
   * 
   * When a user holds Shift while dragging any of the 8 anchors, the anchor is locked 
   * to its initial price level. This allows for precise horizontal adjustments of 
   * the range boundaries without accidental vertical movement.
   *
   * @param pointIndex - The index of the anchor handle being dragged.
   * @param rawScreenPoint - The current screen coordinates of the mouse.
   * @param phase - The current interaction phase (Creation, Editing, or Move).
   * @param originalLogicalPoint - The logical point snapshot from the start of the drag.
   * @param allOriginalLogicalPoints - Snapshot of all tool points at the start of the drag.
   * @returns A result containing the price-locked screen point and the 'price' axis hint.
   * @override
   */
  getShiftConstrainedPoint(pointIndex, rawScreenPoint, phase, originalLogicalPoint, allOriginalLogicalPoints) {
    if (phase !== "editing" /* Editing */) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    const originalScreenPoint = this.pointToScreenPoint(originalLogicalPoint);
    if (!originalScreenPoint) {
      return { point: rawScreenPoint, snapAxis: "none" };
    }
    return {
      point: new Point(rawScreenPoint.x, originalScreenPoint.y),
      snapAxis: "price"
    };
  }
  /**
   * Performs the hit test for the Price Range tool.
   *
   * **Architecture Note:**
   * Delegates to the `LineToolPriceRangePaneView`. The view uses a `CompositeRenderer` containing:
   * 1. `RectangleRenderer` (Body/Borders).
   * 2. `SegmentRenderer` (Center lines).
   * 3. `TextRenderer` (Labels).
   *
   * Delegating ensures that hitting *any* of these visual components registers as selecting the tool.
   *
   * @param x - X coordinate.
   * @param y - Y coordinate.
   * @returns A hit result, or `null`.
   * @override
   */
  _internalHitTest(x, y) {
    if (!this._paneViews || this._paneViews.length === 0) {
      return null;
    }
    const paneView = this._paneViews[0];
    const compositeRenderer = paneView.renderer();
    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null;
    }
    return compositeRenderer.hitTest(x, y);
  }
  /**
   * Calculates the Price Range tool's visibility based on its 2D area.
   * 
   * ### Tutorial Note on Price Range Area Culling
   * A Price Range tool consists of a background fill and several lines. 
   * To prevent the visual components from disappearing when the user 
   * zooms into the middle of the range (where the top and bottom borders 
   * are off-screen), we use the core's Area-Based culling mode.
   * 
   * 1. We provide the 2 logical anchor points (P0 and P1).
   * 2. We provide the 'extend' options found in the nested rectangle configuration.
   * 3. We set 'isAreaBased' to true.
   * 
   * This instructs the culling engine to treat the tool as a solid zone. 
   * As long as the viewport overlaps any part of the rectangle (including 
   * the infinite horizontal extensions), the tool remains visible.
   * 
   * @protected
   * @override
   */
  updateCullingState() {
    const points = this.points();
    const options = this.options();
    if (points.length < this.pointsCount || this.isCreating() || this.isEditing()) {
      this._setIsCulled(false);
      return;
    }
    const cullingState = getToolCullingState(
      points,
      this,
      options.priceRange.rectangle.extend,
      void 0,
      void 0,
      true
      // isAreaBased: true
    );
    this._setIsCulled(cullingState !== "visible" /* Visible */);
  }
};

// vendor/difurious/lightweight-charts-line-tools-price-range/src/index.ts
var PRICE_RANGE_LINE_NAME = "PriceRange";
function registerPriceRangePlugin(corePlugin) {
  corePlugin.registerLineTool(PRICE_RANGE_LINE_NAME, LineToolPriceRange);
  console.log(`Registered Line Tool: ${PRICE_RANGE_LINE_NAME}`);
}
export {
  LineToolArrow,
  LineToolFibRetracement,
  LineToolHorizontalLine,
  LineToolPriceRange,
  LineToolRectangle,
  LineToolTrendLine,
  createLineToolsPlugin,
  registerFibRetracementPlugin,
  registerLinesPlugin,
  registerPriceRangePlugin
};
