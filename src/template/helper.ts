import { ipcRenderer, WebviewTag } from 'electron';
import io from '@cisl/io';
import { invertColor, toPixels } from '../util';

interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
  rw: number;
  rh: number;
}

interface GridSize {
  rows: number;
  cols: number;
}

interface ClosestGridCell {
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  distance: number;
}

const previousValue = new Map();
const uniformGridCellSize = { height: 0, width: 0, padding: 0 };
const dragTimer = new Map();
let grid: {
  center: GridCell;
  fullscreen: GridCell;
  [key: string]: GridCell;
} | null = null;

const gridSize: GridSize = {
  rows: 0,
  cols: 0
};
let displayContextName = '';

// set displayContext for this BrowserWindow
function setDisplayContext(ctx: string): void { // eslint-disable-line @typescript-eslint/no-unused-vars
  displayContextName = ctx;
}

// gets the closest grid for a point
function getClosestGrid(x: number, y: number): false | {label: string; distance: number} {
  if (!grid) {
    return false;
  }

  let min_dist = Number.MAX_VALUE;
  let temp_label = '';

  for (const k in grid) {
    // skip "fullscreen" and "center" and other non-grid positions
    if (!k.includes('|')) {
      continue;
    }
    const diff_x = grid[k].rx - x;
    const diff_y = grid[k].ry - y;
    // no need to do sqrt to save time
    const cur_dist = Math.pow(diff_x, 2) + Math.pow(diff_y, 2);
    if (cur_dist < min_dist) {
      min_dist = cur_dist;
      temp_label = k;
    }
  }

  if (temp_label === '') {
    return false;
  }
  else {
    return {
      label: temp_label,
      distance: Math.sqrt(min_dist)
    };
  }
}

// resize and move view objects
function setBounds(webviewContainer: HTMLElement, destBounds: any, animateCallback?: () => void): boolean | JQuery {
  if (!webviewContainer) {
    return false;
  }

  const content = document.getElementById('content');
  if (destBounds.bringToFront) {
    content!.removeChild(webviewContainer);
    content!.appendChild(webviewContainer);
  }
  else if (destBounds.sendToBack) {
    content!.removeChild(webviewContainer);
    content!.prepend(webviewContainer);
  }

  toPixels(document.body, destBounds);

  const animationProperties: {
    left?: number;
    top?: number;
    height?: number;
    width?: number;
  } = {};
  const animationOptions = {duration: 800, fill: 'forwards', easing: 'ease-in-out'};
  if (destBounds.left) {
    animationProperties.left = destBounds.left;
  }
  if (destBounds.top) {
    animationProperties.top = destBounds.top;
  }
  if (destBounds.height) {
    animationProperties.height = destBounds.height;
  }
  if (destBounds.width) {
    animationProperties.width = destBounds.width;
  }

  if (Object.keys(animationProperties).length === 0) {
    return false;
  }
  else {
    return $(webviewContainer).animate(
      animationProperties,
      destBounds.animationOptions ? destBounds.animationOptions : animationOptions,
      animateCallback
    );
  }
}

/**
 * Helper function to get webview from document and return it as Electron.WebviewTag type
 *
 * @param viewId id of webview element
 */
function getWebviewById(viewId: string): WebviewTag | null {
  return document.getElementById(viewId) as WebviewTag;
}
function isHtmlElement(element: Element): element is HTMLElement {
  return (element as HTMLElement).offsetLeft !== undefined;
}

// selects elements if its top and left fall within a rectangle
function rectangleSelect(selector: string, x1: number, y1: number, x2: number, y2: number): HTMLElement[] {
  const elements: HTMLElement[] = [];
  document.querySelectorAll(selector).forEach((elem) => {
    if (isHtmlElement(elem)) {
      const x = elem.offsetLeft;
      const y = elem.offsetTop;

      if (x >= x1 && y >= y1 && x <= x2 && y <= y2) {
        // this element fits inside the selection rectangle
        elements.push(elem);
      }
    }

  });
  return elements;
}

// creates a uniform grid
function createGrid(rows: number, cols: number, rowHeight?: number[], colWidth?: number[], padding?: number): void {
  gridSize.rows = rows;
  gridSize.cols = cols;
  const w = parseInt(getComputedStyle(document.body, '').width!);
  const h = parseInt(getComputedStyle(document.body, '').height!);

  if (!padding) {
    padding = 2;
  }

  if (!rowHeight) {
    rowHeight = [];
    for (let x = 0; x < rows; x++) {
      rowHeight[x] = Math.ceil(h / rows);
    }
  }
  else {
    for (let x = 0; x < rows; x++) {
      rowHeight[x] = Math.ceil(rowHeight[x] * h);
    }
  }

  if (!colWidth) {
    colWidth = [];
    for (let y = 0; y < cols; y++) {
      colWidth[y] = Math.ceil(w / cols);
    }
  }
  else {
    for (let y = 0; y < cols; y++) {
      colWidth[y] = Math.ceil(colWidth[y] * w);
    }
  }
  uniformGridCellSize.padding = 0;
  if (padding) {
    uniformGridCellSize.padding = padding;
  }

  uniformGridCellSize.width = 0;
  for (let x = 0; x < colWidth.length; x++) {
    uniformGridCellSize.width += colWidth[x];
  }
  uniformGridCellSize.width /= colWidth.length;

  uniformGridCellSize.height = 0;
  for (let x = 0; x < rowHeight.length; x++) {
    uniformGridCellSize.height += rowHeight[x];
  }
  uniformGridCellSize.height /= rowHeight.length;

  grid = {
    center: {
      rx: Math.round(w / 4),
      ry: Math.round(h / 4),
      rw: Math.round(w / 2),
      rh: Math.round(h / 2),
      x: Math.round(w / 4) + padding,
      y: Math.round(h / 4) + padding,
      width: Math.round(w / 2) - 2 * padding,
      height: Math.round(h / 2) - 2 * padding
    },
    fullscreen: {
      rx: 0,
      ry: 0,
      rw: w,
      rh: h,
      x: padding,
      y: padding,
      width: w - 2 * padding,
      height: h - 2 * padding
    }
  };

  let rr = 0;
  for (let r = 1; r <= rows; r++) {
    let cc = 0;
    for (let c = 1; c <= cols; c++) {
      const key = r + '|' + c;

      grid[key] = {
        x: cc + padding,
        y: rr + padding,
        width: colWidth[c - 1] - 2 * padding,
        height: rowHeight[r - 1] - 2 * padding,
        rx: cc,
        ry: rr,
        rw: colWidth[c - 1],
        rh: rowHeight[r - 1]
      };
      cc += colWidth[c - 1];
    }
    rr += rowHeight[r - 1];
  }
}

/*

   destBounds =  {
        "left" : "100px",
        "top" : "100px",
        "height" : "300px",
        "width" : "400px",
        "animationOptions" : {
            duration : 1000,
            fill : 'forwards',
            easing : 'linear'
         }
      }
*/
// slides content
function slideContents(options: any): void {
  const max_row_index = gridSize.rows;
  const max_col_index = gridSize.cols;
  const cur_row_index = options.position.gridTop;
  const cur_col_index = options.position.gridLeft;
  let x1: number;
  let x2: number;
  let y1: number;
  let y2: number;

  if (options.slide.cascade) {
    if (options.slide.direction == "down") {
      //console.log("down")
      for (let i = (max_row_index - 1); i >= cur_row_index; i--) {
        x1 = grid[i + "|" + cur_col_index].rx;
        y1 = grid[i + "|" + cur_col_index].ry;
        x2 = grid[i + "|" + cur_col_index].rx + grid[i + "|" + cur_col_index].rw;
        y2 = grid[i + "|" + cur_col_index].ry + grid[i + "|" + cur_col_index].rh;
        const eles = rectangleSelect("webview", x1, y1, x2, y2);
        //console.log("eles.length="+eles.length);
        if (eles.length > 0) {
          const next_grid_index = (i + 1) + "|" + cur_col_index;
          const destBounds = {
            "left": grid[next_grid_index].x + "px",
            "top": grid[next_grid_index].y + "px",
            "animationOptions": {
              duration: 800,
              fill: 'forwards',
              easing: 'linear'
            }
          };
          //console.log("destBounds "+destBounds.left+" "+destBounds.top);
          let index = 0;

          while (index < eles.length) {
            setBounds(eles[index], destBounds);
            index++;
          }
        }
      }
    }
    else if (options.slide.direction == "right") {
      //console.log("right")

      for (let i = (max_col_index - 1); i >= cur_col_index; i--) {
        x1 = grid[cur_row_index + "|" + i].rx;
        y1 = grid[cur_row_index + "|" + i].ry;
        x2 = grid[cur_row_index + "|" + i].rx + grid[cur_row_index + "|" + i].rw;
        y2 = grid[cur_row_index + "|" + i].ry + grid[cur_row_index + "|" + i].rh;
        const eles = rectangleSelect("webview", x1, y1, x2, y2);
        //console.log("eles.length="+eles.length);
        if (eles.length > 0) {
          const next_grid_index = cur_row_index + "|" + (i + 1);
          const destBounds = {
            "left": grid[next_grid_index].x + "px",
            "top": grid[next_grid_index].y + "px",
            "animationOptions": {
              duration: 800,
              fill: 'forwards',
              easing: 'linear'
            }
          };
          //console.log("destBounds "+destBounds.left+" "+destBounds.top);
          let index = 0;

          while (index < eles.length) {
            setBounds(eles[index], destBounds);
            index++;
          }
        }
      }
    }
    else if (options.slide.direction == "left") {

      //console.log("left")

      for (let i = 2; i <= cur_col_index; i++) {
        x1 = grid[cur_row_index + "|" + i].rx;
        y1 = grid[cur_row_index + "|" + i].ry;
        x2 = grid[cur_row_index + "|" + i].rx + grid[cur_row_index + "|" + i].rw;
        y2 = grid[cur_row_index + "|" + i].ry + grid[cur_row_index + "|" + i].rh;
        const eles = rectangleSelect("webview", x1, y1, x2, y2);
        //console.log("eles.length="+eles.length);
        if (eles.length > 0) {
          const next_grid_index = cur_row_index + "|" + (i - 1);
          const destBounds = {
            "left": grid[next_grid_index].x + "px",
            "top": grid[next_grid_index].y + "px",
            "animationOptions": {
              duration: 800,
              fill: 'forwards',
              easing: 'linear'
            }
          };
          //console.log("destBounds "+destBounds.left+" "+destBounds.top);
          let index = 0;

          while (index < eles.length) {
            setBounds(eles[index], destBounds);
            index++;
          }
        }
      }

    }
    else {//up

      for (let i = 2; i <= cur_row_index; i++) {
        x1 = grid[i + "|" + cur_col_index].rx;
        y1 = grid[i + "|" + cur_col_index].ry;
        x2 = grid[i + "|" + cur_col_index].rx + grid[i + "|" + cur_col_index].rw;
        y2 = grid[i + "|" + cur_col_index].ry + grid[i + "|" + cur_col_index].rh;
        const eles = rectangleSelect("webview", x1, y1, x2, y2);
        //console.log("eles.length="+eles.length);
        if (eles.length > 0) {
          const next_grid_index = (i - 1) + "|" + cur_col_index;
          const destBounds = {
            "left": grid[next_grid_index].x + "px",
            "top": grid[next_grid_index].y + "px",
            "animationOptions": {
              duration: 800,
              fill: 'forwards',
              easing: 'linear'
            }
          };
          //console.log("destBounds "+destBounds.left+" "+destBounds.top);
          let index = 0;

          while (index < eles.length) {
            setBounds(eles[index], destBounds);
            index++;
          }
        }
      }
    }
  }
}

/**
 * Executes a string-encoded JSON payload coming from DisplayWorker.executeInDisplayWindow.
 *
 * So as to avoid potential encoding issues of the payload breaking the calling scope in DisplayWindow,
 * it gets encoded to a string first that we have to decode here. The return of this function however
 * can be a regular JSON object
 * @param opts JSON object encoding as string with details on what to execute
 */
function execute(opts: string): any { // eslint-disable-line @typescript-eslint/no-unused-vars
  const options = JSON.parse(opts);
  console.log('Executed command : ', options.command, options);
  try {
    if (options.command === 'create-grid') {
      const contentGrid = options.contentGrid;

      if (contentGrid.rows && contentGrid.cols) {
        createGrid(contentGrid.rows, contentGrid.cols, contentGrid.rowHeight, contentGrid.colWidth, contentGrid.padding);
      }

      return {
        displayName: options.displayName,
        displayContextName: options.displayContextName,
        windowName: options.windowName,
        x: options.x,
        y: options.y,
        width: options.width,
        height: options.height
      };
    }
    else if (options.command === "get-grid") {
      return grid;
    }
    else if (options.command === "uniform-grid-cell-size") {
      return uniformGridCellSize;
    }
    else if (options.command === "clear-grid") {
      grid = null;
      return { command: "clear-grid", "status": "success" };
    }
    else if (options.command === "clear-contents") {
      return { "status": "success", command: "clear-contents" };
    }
    else if (options.command === "create-view-object") {
      if (options.slide && options.position) {
        slideContents(options);
      }

      if (options.position) {
        if (!grid) {
          return {
            status: "error",
            message: "grid not being used, do not use gridTop or gridLeft",
            viewId: options.id,
            displayName: options.displayName,
            displayContextName: options.displayContextName
          };
        }

        let pos = options.position;
        if (typeof pos == "object") {
          if (pos.gridTop && pos.gridLeft) {
            pos = pos.gridTop + "|" + pos.gridLeft;
          }
          else {
            return {
              status: "error",
              message: "missing gridTop or gridLeft parameter",
              viewId: options.id,
              "displayName": options.displayName,
              "windowName": options.windowName,
              displayContextName: options.displayContextName
            };
          }
        }
        const box = grid[pos];
        if (box) {
          console.log("box=" + JSON.stringify(box));
          options.left = box.x;
          options.top = box.y;
          options.width = options.width ? options.width : box.width;
          options.height = options.height ? options.height : box.height;
        }
        else {
          return {
            status: "error",
            message: "invalid value for position",
            viewId: options.id,
            displayName: options.displayName,
            windowName: options.windowName,
            displayContextName: options.displayContextName
          };
        }
      }

      toPixels(document.body, options);

      const wvContainer = document.createElement('div');
      wvContainer.id = 'container-' + options.viewId;
      wvContainer.classList.add('webview-container');
      wvContainer.classList.add('ui-widget-content');
      wvContainer.style.top = options.top;
      wvContainer.style.left = options.left;
      wvContainer.style.width = options.width;
      wvContainer.style.height = options.height;

      const dragCover = document.createElement("webview-drag");
      dragCover.classList.add("webview-drag");
      dragCover.id = 'drag-' + options.viewId;
      wvContainer.append(dragCover);

      const wv = document.createElement("webview");
      wvContainer.appendChild(wv);
      wv.id = options.viewId;

      wv.addEventListener('console-message', (e) => {
        console.log('webview message: ', e.message);
      });
      wv.preload = './preload.js';
      wv.src = options.url;

      wv.addEventListener("dom-ready", () => {
        const params = {
          webviewId: wv.id,
          liaison_worker_url: ''
        };
        if (io.config.display.liaison_worker_url) {
          params.liaison_worker_url = io.config.display.liaison_worker_url.replace(/\/$/, '');
        }
        wv.send('dom-ready', params);
        if (options.deviceEmulation) {
          wv.getWebContents().enableDeviceEmulation(options.deviceEmulation);
        }
      });

      let closebtn: HTMLDivElement;
      if (options.uiClosable) {
        closebtn = document.createElement("div");
        closebtn.className = "closebtn";
        closebtn.id = wv.id + "-closehint";
        closebtn.innerHTML = "x";
        closebtn.addEventListener("mousedown", () => {
          document.getElementById('content')!.removeChild(wvContainer);
          ipcRenderer.send('view-object-event', {
            type: "viewObjectClosed",
            displayContextName: displayContextName,
            details: {
              viewId: wv.id
            }
          });
        });
        if (options.url !== 'https://google.com') {
          wvContainer.append(closebtn);
        }
      }

      if (options.uiDraggable) {
        wvContainer.addEventListener("mouseenter", () => {
          if (wvContainer.dataset.canDrag !== 'true') {
            let pointingDiv = (document.getElementById(wvContainer.id + "-draghint") as HTMLImageElement);

            if (!pointingDiv) {
              pointingDiv = document.createElement("img");
              pointingDiv.src = "drag.svg";
              pointingDiv.className = "dragcursor";
              pointingDiv.id = wvContainer.id + "-draghint";
              wvContainer.appendChild(pointingDiv);
              pointingDiv.style.left = Math.round($(wvContainer).width() / 2 - $(pointingDiv).width() / 2) + "px";
              pointingDiv.style.top = Math.round($(wvContainer).height() / 2 - $(pointingDiv).height() / 2) + "px";
            }

            wvContainer.dataset.canDrag = 'true';
            wvContainer.dispatchEvent(new Event("dragHintStart"));
            $(wvContainer).draggable({
              disabled: false,
              scroll: false,
              refreshPositions: true,
              start: () => {
                const contentElement = document.getElementById('content');
                if (closebtn) {
                  closebtn.style.display = 'none';
                }
                pointingDiv.style.display = 'none';
                contentElement!.removeChild(wvContainer);
                contentElement!.append(wvContainer);
              },
              drag: (event: JQueryEventObject) => {
                wvContainer.dataset.isDragging = 'true';
                if (event && event.screenY && event.screenY < 1 && options.uiClosable) {
                  $(wvContainer).draggable({disabled : true});
                  wvContainer.dataset.isDragging = 'false';
                  pointingDiv.style.display = "none";
                  dragCover.style.display = "none";
                  wvContainer.dispatchEvent(new Event("dragHintEnd"));
                  document.getElementById('content')!.removeChild(wvContainer);
                  ipcRenderer.send('view-object-event', {
                    type : "viewObjectClosed",
                    displayContextName : displayContextName,
                    details :  {
                      viewId : wvContainer.id
                    }
                  });
                }

              },
              stop: () => {
                if (wvContainer.dataset.isDragging === 'true') {
                  ipcRenderer.send('set-drag-cursor', "");
                  $(wvContainer).draggable({ disabled: true });
                  wvContainer.dataset.isDragging = 'false';
                  if (closebtn) {
                    closebtn.style.display = 'block';
                  }
                  wvContainer.dispatchEvent(new Event("dragHintEnd"));
                  const _d = {
                    top: $(wvContainer).offset()!.top,
                    left: $(wvContainer).offset()!.left,
                    width: $(wvContainer).width(),
                    height: $(wvContainer).height(),
                    units: "px",
                    viewId: wvContainer.id
                  };

                  if (grid) {
                    const closest = getClosestGrid(_d.left, _d.top);
                    const computedStyle = {
                      width: parseFloat(getComputedStyle(wvContainer).width || ''),
                      height: parseFloat(getComputedStyle(wvContainer).height || '')
                    };

                    if (closest !== false && closest.distance > 0 && grid) {
                      const closestCell = grid[closest.label];
                      const destBounds = {
                        "left": closestCell.x + "px",
                        "top": closestCell.y + "px",
                        "width": (closestCell.width > computedStyle.width ? closestCell.width : computedStyle.width) + "px",
                        "height": (closestCell.height > computedStyle.height ? closestCell.height : computedStyle.height) + "px",
                        "animationOptions": {
                          duration: 500,
                          fill: 'forwards',
                          easing: 'linear'
                        }
                      };
                      _d.top = closestCell.y;
                      _d.width = parseInt(destBounds.width);
                      _d.height = parseInt(destBounds.height);

                      setBounds(wvContainer, destBounds, () => {
                        ipcRenderer.send('view-object-event', {
                          type: "viewObjectBoundsChanged",
                          displayContextName: displayContextName,
                          details: _d
                        });
                      });
                    }
                    else {
                      ipcRenderer.send('view-object-event', {
                        type: "viewObjectBoundsChanged",
                        displayContextName: displayContextName,
                        details: _d
                      });
                    }
                  }
                }
              }
            });

            pointingDiv.style.display = "block";
            dragCover.style.display = "block";

            dragTimer.set(wvContainer.id, setTimeout(() => {
              dragTimer.delete(wvContainer.id);
              if (wvContainer.dataset.isDragging !== "true") {
                if (pointingDiv) {
                  pointingDiv.style.display = "none";
                  dragCover.style.display = "none";
                }
                $(wvContainer).draggable({ disabled: true });
                wvContainer.dispatchEvent(new Event("dragHintEnd"));
              }
            }, 750));
          }
        });
        wvContainer.addEventListener("mouseleave", () => {
          clearTimeout(dragTimer.get(wvContainer.id));
          dragTimer.delete(wvContainer.id);
          wvContainer.dataset.canDrag = "false";
          $(wvContainer).draggable({ disabled: false });
          if (document.getElementById(wvContainer.id + "-draghint")) {
            document.getElementById(wvContainer.id + "-draghint").style.display = "none";
          }
        });
      }

      wv.nodeintegration = options.nodeIntegration === true ? "true" : "false";

      document.getElementById("content").append(wvContainer);

      ipcRenderer.send('view-object-event', {
        type: "viewObjectCreated",
        displayContextName: displayContextName,
        details: options
      });

      return {
        "viewId": wv.id,
        command: "create",
        "status": "success",
        "displayName": options.displayName,
        "windowName": options.windowName,
        displayContextName: options.displayContextName
      };
    }
    else if (options.command == "webview-execute-javascript") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        const userGesture = (options.userGesture) ? options.userGesture == true : false;
        wv.executeJavaScript(options.code, userGesture);
        return {"viewId": wv.id, command: "execute-javascript", "status": "success"};
      }
      else {
        return {"viewId": options.viewId, command: "execute-javascript", "status": "error", "error_message" : "view not found" };
      }
    }
    else if (options.command == "set-url") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        wv.src = options.url;
        ipcRenderer.send('view-object-event', {
          type: "urlChanged",
          displayContextName: displayContextName,
          details: {
            viewId: wv.id,
            url: options.url
          }
        });
        return { "viewId": wv.id, command: "set-url", "status": "success" };

      }
      else {
        return { "viewId": wv.id, command: "set-url", "status": "error", "error_message" : "view not found" };
      }

    }
    else if (options.command == "get-url") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        return { "viewId": wv.id, command: "get-url", "status": "success", "url": wv.src };
      }
      else {
        return { "viewId": wv.id, command: "get-url", "status": "error", "error_message" : "view not found" };
      }

    }
    else if (options.command == "reload") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        wv.reload();
        ipcRenderer.send('view-object-event', {
          type: "urlReloaded",
          displayContextName: displayContextName,
          details: {
            viewId: wv.id,
            url: wv.src
          }
        });
        return { "viewId": wv.id, command: "reload", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "reload", "status": "error", "error_message" :"view not found" };
      }

    }
    else if (options.command == "hide") {
      const wv = getWebviewById(options.viewId);

      if (wv) {
        const c = {
          width: wv.style.width, height: wv.style.height
        };
        previousValue.set(options.viewId, c);
        wv.className = 'hide';
        wv.style.width = '0px';
        wv.style.height = '0px';
        ipcRenderer.send('view-object-event', {
          type: "viewObjectHidden",
          displayContextName: displayContextName,
          details: {
            viewId: wv.id
          }
        });
        return { "viewId": wv.id, command: "hide", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "hide", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command == "show") {
      const wv = getWebviewById(options.viewId);

      if (wv) {
        const c = previousValue.get(options.viewId);
        wv.style.width = c.width;
        wv.style.height = c.height;
        wv.className = '';
        ipcRenderer.send('view-object-event', {
          type: "viewObjectShown",
          displayContextName: displayContextName,
          details: {
            viewId: wv.id
          }
        });
        return { "viewId": wv.id, command: "show", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "show", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command === "close") {
      const wvContainer = document.getElementById('container-' + options.viewId);

      if (wvContainer) {
        document.getElementById('content').removeChild(wvContainer);
        ipcRenderer.send('view-object-event', {
          type: "viewObjectClosed",
          displayContextName: displayContextName,
          details: {
            viewId: wvContainer.id
          }
        });
        return { "viewId": wvContainer.id, command: "close", "status": "success" };
      }
      else {
        return { "viewId": wvContainer.id, command: "close", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command == "set-bounds") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        setBounds(wv, options, () => {
          ipcRenderer.send('view-object-event', {
            type: "viewObjectBoundsChanged",
            displayContextName: displayContextName,
            details: {
              viewId: wv.id,
              top: $(wv).offset().top,
              left: $(wv).offset().left,
              width: $(wv).width(),
              height: $(wv).height(),
              units: "px"
            }
          });
        });
        return { "viewId": wv.id, command: "set-bounds", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "set-bounds", "status": "error", "error_message" :"view not found" };
      }

    }
    else if (options.command == "get-bounds") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        return {
          "viewId": wv.id,
          command: "get-bounds",
          "status": "success",
          "bounds": {
            left: getComputedStyle(wv).left,
            top: getComputedStyle(wv).top,
            width: getComputedStyle(wv).width,
            height: getComputedStyle(wv).height
          }
        };
      }
      else {
        return { "viewId": wv.id, command: "get-bounds", "status": "error", "error_message" :"view not found" };
      }

    }
    else if (options.command == "back") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        wv.goBack();
        return { "viewId": wv.id, command: "back", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "back", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command == "forward") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        wv.goForward();
        return { "viewId": wv.id, command: "forward", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "forward", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command == "enable-device-emulation") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        wv.getWebContents().enableDeviceEmulation(options.parameters);
        return { "viewId": wv.id, command: "enable-device-emulation", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "enable-device-emulation", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command == "disable-device-emulation") {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        wv.getWebContents().disableDeviceEmulation();
        return { "viewId": wv.id, command: "disable-device-emulation", "status": "success" };
      }
      else {
        return { "viewId": wv.id, command: "disable-device-emulation", "status": "error", "error_message" :"view not found" };
      }
    }
    else if (options.command == 'view-object-dev-tools') {
      const wv = getWebviewById(options.viewId);
      if (wv) {
        if (options.devTools) {
          wv.openDevTools();
        }
        else {
          wv.closeDevTools();
        }
      }

      return { "status": "success" };
    }
    else {
      return { "viewId": options.viewId, command: options.command, "status": "error", "error_message" :"command not defined" };
    }
  }
  catch (e) {
    console.log(e);
    return { "viewId": options.viewId, command: options.command, "status": "error", "error_message" : e.toString() };
  }
}

const hands = {};

io.rabbit.onTopic('pointing.api.display', (response) => {
  try {
    const msgs = JSON.parse((response.content as string));
    for (const msg of msgs.data) {
      let elem;
      if (!hands[msg.userId]) {
        elem = document.createElement('div');
        elem.classList.add('pointing');
        elem.setAttribute('id', 'pointing-' + msg.userId);
        const hand_elem = document.createElement('div');
        const span_elem = document.createElement('span');
        span_elem.classList.add('right-hand-text');
        span_elem.innerText = msg.userId;
        elem.appendChild(hand_elem);
        elem.appendChild(span_elem);
        document.getElementById('pointing').prepend(elem);
        hands[msg.userId] = {
          elem: elem,
          timeout: null
        };
      }
      else {
        elem = hands[msg.userId].elem;
        clearTimeout(hands[msg.userId].timeout);
      }

      const allowed_gestures = ['open', 'closed', 'lasso'];

      elem.style.left = (msg.pointing_pixel[0] - 25) + 'px';
      elem.style.top = (msg.pointing_pixel[1] - 25) + 'px';

      if (allowed_gestures.indexOf(msg.right_hand_state) !== -1) {
        elem.children[0].className = "";
        elem.children[0].classList.add('hand');
        elem.children[0].classList.add(`hand-${msg.right_hand_state}`);
        elem.children[0].classList.add('right');

      }
      else if (allowed_gestures.indexOf(msg.left_hand_state) !== -1) {
        elem.children[0].className = "";
        elem.children[0].classList.add('hand');
        elem.children[0].classList.add(`hand-${msg.left_hand_state}`);
        elem.children[0].classList.add('left');
      }

      elem.children[0].style.backgroundColor = msg.color;
      elem.children[1].style.color = invertColor(msg.color);
      hands[msg.userId].timeout = setTimeout(() => {
        document.getElementById('pointing').removeChild(hands[msg.userId].elem);
        delete hands[msg.userId];
      }, 30 * 1000);
    }
  }
  catch (e) {
    console.error('failed to parse message');
    console.error(e);
  }
});
