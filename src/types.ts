import { BrowserWindowConstructorOptions } from "electron";

export interface Bounds {
  x: number;
  y: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  details?: any;
  displayName?: any;
  windowName?: any;
  displayContext?: any;
}

export interface WindowOptions extends BrowserWindowConstructorOptions {
  displayName: string;
  windowName: string;
  displayContext: string;
}
