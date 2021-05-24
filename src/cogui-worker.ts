import { BrowserWindow, screen } from 'electron';

import type { Io } from "@cisl/io/io";
import type { Display } from 'electron';
import { Bounds } from './display-worker';
import { WindowOptions } from './types';
import { calculateBoundaries } from './util';

export class CoguiWorker {
  io: Io;

  /** Array of available displays */
  displays: Display[];
  /** Boundaries calculated from all displays merged */
  bounds: Bounds;
  /** DisplayName is used to identify a display worker instance */
  displayName: string;
  /** Active displayContext */
  activeDisplayContext: string;
  /** windowNameToWindowMap maps windowName to windows id and options specified by user while creating a displayContext */
  windowNameToWindowMap: Map<string, { id: number; options: WindowOptions }> = new Map();

  constructor(io: Io) {
    this.io = io;

    this.displayName = this.io.config.get('ephd:displayName');
    this.displays = screen.getAllDisplays();

    this.activeDisplayContext = 'default';

    this.bounds = calculateBoundaries(this.displays);

    //launch cogUI
    const msg = {
      "command": "launch-cogUI",
      "options": {
        "details": [
        ],
        "displayName": "cogUI",
        "displayContext": "ai4bi",
        "windowName": "cogUI"
      }
    };

    this.launchCogUI(msg);
  }

  // returns the system window id from user defined window name
  getBrowserWindowFromName(windowName): BrowserWindow {
    if (this.windowNameToWindowMap.has(windowName)) {
      return BrowserWindow.fromId(this.windowNameToWindowMap.get(windowName).id);
    }
    return undefined;
  }

  //launches cogUI
  launchCogUI(msg): Promise<any> {
    const { options } = msg;

    const browser = new BrowserWindow({
      x: this.bounds.x,
      y: this.bounds.y,
      width: this.bounds.width,
      height: this.bounds.height,
      title: this.io.config.get("ephd:title"),
      transparent: true,
      hasShadow: false,
      frame: false,
      resizable: false,
      backgroundColor: '#012',
      webPreferences: {
        nodeIntegration: false,
      }
    });
    this.windowNameToWindowMap.set(options.windowName, { id: browser.id, options });

    // Load a remote URL
    const url = this.io.config.get<string>("ephd:ephdUILocalURL");
    browser.loadURL(url);
    return new Promise((resolve) => {
      // sets up launcherMenu, DisplayContext associated with BrowserWindow, default fontSize after the template page is loaded
      browser.webContents.on('did-finish-load', () => {
        this.io.rabbit.onTopic('cogui.show-full-view', () => {
          const bw = this.getBrowserWindowFromName(this.displayName);
          bw.webContents.executeJavaScript(`document.getElementsByClassName('mainDiv')[0].style.display = 'block';`);
          bw.webContents.executeJavaScript(`document.getElementsByClassName('bubbleDiv')[0].style.display = 'none';`);
          bw.setPosition(0, 0, true);
          bw.setSize(this.bounds.width, this.bounds.height, false);
          bw.setAlwaysOnTop(false);
        });

        this.io.rabbit.onTopic(`cogui.show-bubble-view`, () => {
          const bw = this.getBrowserWindowFromName(this.displayName);
          bw.setPosition(
            Math.floor(this.bounds.width * this.io.config.get<number>("position-factor:x")),
            Math.floor(this.bounds.height * this.io.config.get<number>("position-factor:y")),
            true
          );
          bw.setSize(
            this.io.config.get<number>("bubble-size:w"),
            this.io.config.get<number>("bubble-size:h"),
            false
          );
          bw.setAlwaysOnTop(true);
          bw.webContents.executeJavaScript(`document.getElementsByClassName('mainDiv')[0].style.display = 'none';`);
          bw.webContents.executeJavaScript(`document.getElementsByClassName('bubbleDiv')[0].style.display = 'block';`);
        });

        resolve({
          status: 'success',
          displayName: this.displayName,
          displayContext: this.activeDisplayContext,
          windowName: options.windowName
        });
      });
    });
  }
}
