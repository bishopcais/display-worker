
export function setError(params: {[key: string]: unknown}, message: string) {
  params.status = 'error';
  params.message = message;
  return params;
}

export function padZero(str: string, len?: number): string {
  len = len || 2;
  const zeros = new Array(len).join('0');
  return (zeros + str).slice(-len);
}

export function invertColor(hex: string): string {
  if (hex.indexOf('#') === 0) {
    hex = hex.slice(1);
  }
  // convert 3-digit hex to 6-digits.
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    throw new Error('Invalid HEX color.');
  }
  // invert color components
  const r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
    g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
    b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
    // pad each with zeros and return
  return '#' + padZero(r) + padZero(g) + padZero(b);
}

// converts em to pixels
export function toPixels(body: HTMLElement, options: any): void {
  const ems = parseFloat(getComputedStyle(body, "").fontSize);

  try {
    if (typeof (options) == "string") {
      if (options.indexOf("em") > -1) {
        options = Math.round(ems * parseFloat(options)) + "px";
      }
    }
    else if (typeof (options) == "object") {
      if (!options.position) {
        if (options.top && options.top.indexOf("em") > -1) {
          options.top = Math.round(ems * parseFloat(options.top)) + "px";
        }

        if (options.left && options.left.indexOf("em") > -1) {
          options.left = Math.round(ems * parseFloat(options.left)) + "px";
        }
      }

      if (options.width) {
        if (typeof (options.width) == "string" && options.width.indexOf("em") > -1) {
          options.width = Math.round(ems * parseFloat(options.width)) + 'px';
        }
        else if (typeof (options.width) == "number") {
          options.width = Math.round(options.width) + 'px';
        }
        else {
          options.width = Math.round(parseFloat(options.width)) + 'px';
        }
      }
      if (options.height) {
        if (typeof (options.height) == "string" && options.height.indexOf("em") > -1) {
          options.height = Math.round(ems * parseFloat(options.height)) + 'px';
        }
        else if (typeof (options.height) == "number") {
          options.height = Math.round(options.height) + 'px';
        }
        else {
          options.height = Math.round(parseFloat(options.height)) + 'px';
        }
      }
    }
  }
  catch (e) {
    console.log(e, options);
  }
}
