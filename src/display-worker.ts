import { BrowserWindow, BrowserWindowConstructorOptions, Display, Screen as ElectronScreen } from 'electron';
import logger from '@cisl/logger';
import io from '@cisl/io';
import path from 'path';
import { setError } from './util';

declare module 'electron' {
  interface BrowserWindow {
    isReady: boolean;
  }
}

export interface ExecuteDisplayWindowResponse {
  command: string;
  status: 'success' | 'error';
  error_message?: string;
  viewId?: string;
  viewObjects?: string[];
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayConfig {
  displayName: string;
  bounds?: Bounds
  liaison_worker_url?: string;
}

// Display Worker class
export class DisplayWorker {
  private displays: Display[];
  private bounds: Bounds;
  private config: DisplayConfig;
  private displayName: string;
  private displayContext: Set<string>;
  private activeDisplayContext: string;
  private windowIdMap: Map<string, number>;
  private windowOptions: Map<string, any>;
  /** maps an array of WindowNames to a displayContext. Key - DisplayContext Name (String), Value - an array of WindowNames (Array<String>) */
  private dcWindows: Map<string, string[]>;
  private webviewOwnerStack: Map<string, string>;

  constructor(screen: ElectronScreen) {
    // gets screen information via Electron Native API
    this.displays = screen.getAllDisplays();

    logger.info('Displays attached to this display-worker:');
    this.displays.forEach((d) => {
      logger.info(d);
    });

    // Loads bounds information from settings file if present otherwise infers from Electron's Screen information
    if (io.config.display.bounds) {
      this.bounds = io.config.display.bounds;
    }
    else {
      const bounds = {
        x: 0,
        y: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0
      };
      this.displays.forEach((disp) => {
        bounds.x = Math.min(disp.bounds.x, bounds.x);
        bounds.y = Math.min(disp.bounds.y, bounds.y);

        bounds.right = Math.max(disp.bounds.width + disp.bounds.x, bounds.right);
        bounds.bottom = Math.max(disp.bounds.height + disp.bounds.y, bounds.bottom);
      });

      this.bounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.right - bounds.x,
        height: bounds.bottom - bounds.y
      };

      io.config.display.bounds = this.bounds;
    }

    // Prints Display Configuration
    logger.info('');
    logger.info('Display-worker configuration:');
    logger.info(io.config.display);
    this.config = io.config.display;

    // DisplayName is used to identify a display worker instance.
    this.displayName = this.config.displayName;

    // DisplayContext is an unique app identifier
    this.displayContext = new Set();
    this.displayContext.add('default');
    this.activeDisplayContext = 'default';

    // windowIdMap maps system window id to user-defined window name. Key - WindowName (String), Value - System Window Id (Integer)
    this.windowIdMap = new Map();

    // windowOptions catalogs options such as contentGrid and background specified by user while creating a DisplayContext
    this.windowOptions = new Map();


    this.dcWindows = new Map();
    this.dcWindows.set(this.activeDisplayContext, []);

    // webviewOwnerStack maps a viewObject Id to a window name. Key - ViewObject Id (String), Value - Window Name (String)
    this.webviewOwnerStack = new Map();

    // listens and processes RPC call
    io.rabbit!.onRpc('rpc-display-' + io.config.display.displayName, (response, reply) => {
      this.processMessage(response.content, reply);
    });

    // Publishes a display.added event
    io.rabbit!.publishTopic('display.added', {
      name: io.config.display.displayName
    });
    logger.info('worker server started.');
    logger.info('');
  }

  // closes a display context, removes associated windows and view objects
  closeDisplayContext(context: any, next: (msg: object) => void) {
    this.displayContext.delete(context);
    let b_list = this.dcWindows.get(context);
    if (b_list) {
      let closedWebviewIds: string[] = [];
      b_list.forEach((b_id) => {
        let b = this.getBrowserWindowFromName(b_id);
        if(b) {
          b.close();
          this.windowIdMap.delete(b_id);
        }

        this.webviewOwnerStack.forEach((webviewId, k) => {
          if (webviewId === b_id) {
            closedWebviewIds.push(webviewId);
            this.webviewOwnerStack.delete(webviewId);
          }
        });
      }, this);

      this.dcWindows.delete(context);
      this.activeDisplayContext = 'default';
      next({
        'status' : 'success',
        'command' : 'close-display-context',
        'displayName' : this.displayName,
        'message' : context + ' : context closed. The active display context is set to default context. Please use setDisplayContext to bring up the default context or specify an existing or new display context.',
        'closedDisplayContextName' : context,
        'closedWindows' : b_list,
        'closedViewObjects' : closedWebviewIds
      });
    }
    else{
      next({
        'status' : 'warning',
        'displayName' : this.displayName,
        'command' : 'close-display-context',
        'message' : context + ' : context does not exist'
      });
    }
  }

  // activates or creates a display context
  setDisplayContext(context: any, next: (msg: object) => void) {
    if(this.activeDisplayContext !== context ){
      let b_list  = this.dcWindows.get(this.activeDisplayContext);
      if(b_list){
        b_list.forEach((element) => {
          let b = this.getBrowserWindowFromName(element);
          if(b) {
            b.hide();
          }
        }, this);
      }
    }
    this.activeDisplayContext = context;
    if (this.dcWindows.has(this.activeDisplayContext)){
      let b_list  = this.dcWindows.get(this.activeDisplayContext);
      if (b_list) {
        b_list.forEach((element) => {
          let b = this.getBrowserWindowFromName(element);
          if(b) {
            b.show();
          }
        }, this);
      }
    }
    else{
      this.dcWindows.set(this.activeDisplayContext, []);
    }

    next({
      'status' : 'success',
      'command' : 'set-active-context',
      'displayName' : this.displayName,
      'message' : this.activeDisplayContext + ' is now active'
    });
  }

  // creates a new BrowserWindow
  createWindow(context: string, options: any, next: (msg: object) => void) {
    let b_id = options.windowName;
    this.windowOptions.set(options.windowName, options);
    let opts: BrowserWindowConstructorOptions = {
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      frame: false,
      // fullscreen: true,
      enableLargerThanScreen: false,
      acceptFirstMouse: true,
      backgroundColor: '#2e2c29',
      webPreferences: {
        nodeIntegration: true,
        webviewTag: true
      }
    };

    if (io.config.display.liaison_worker_url) {
      logger.warn(`LiasionWorker uses http - Disabling webSecurity and enabling allowRunningInsecureContent`);
      opts.webPreferences!.webSecurity = io.config.display.liaison_worker_url.startsWith('https'),
      opts.webPreferences!.allowRunningInsecureContent = !io.config.display.liaison_worker_url.startsWith('https');
    }

    let browser = new BrowserWindow(opts);
    let template_path = path.resolve(path.join(__dirname, 'template'));

    logger.info(`loading template: file://${template_path}/index.html`);
    browser.loadURL(`file://${template_path}/index.html`);

    browser.on('closed', () => {
    });

    if (!this.dcWindows.has(context)) {
      this.dcWindows.set(context, []);
    }

    this.windowIdMap.set(b_id, browser.id);
    this.dcWindows.get(context)!.push(b_id);

    // Avoids navigating away from template page
    browser.webContents.on('will-navigate', (e) => {
      logger.info('preventing attempt to navigate browser window content');
      e.preventDefault();
      return false;
    });

    // sets up DisplayContext associated with BrowserWindow
    browser.webContents.on('did-finish-load', () => {
      browser.webContents.executeJavaScript(`setDisplayContext('${context}')`);

      browser.isReady = true;

      if (options.contentGrid) {
        this.executeInDisplayWindow(Object.assign(options, {
          command: 'create-grid',
          displayName: this.displayName,
          displayContextName: this.activeDisplayContext,
          windowName: options.windowName,
          x: options.x,
          y: options.y,
          width: options.width,
          height: options.height
        }), next);
      }
      else {
        next({
          status: 'success',
          x: options.x,
          y: options.y,
          width: options.width,
          height: options.height,
          displayName: this.displayName,
          displayContextName: this.activeDisplayContext,
          windowName: options.windowName
        });
      }
    });

    // When the dom is ready, Grid is defined if specified. The create_window
    // call returns after the dom is ready to allow users create view objects
    browser.webContents.on('dom-ready', () => {

    });

    // Publishes a displayWindowCreated event
    io.rabbit!.publishTopic('display.window', {
      type: 'displayWindowCreated',
      details: {
        displayContextName: this.activeDisplayContext,
        displayName: this.displayName,
        windowName: b_id
      }
    });
  }

  // Creates a ViewObject
  createViewObject(ctx: string, options: any, next: (msg: object) => void) {
    let viewId = io.generateUuid();
    this.webviewOwnerStack.set(viewId, options.windowName);

    this.executeInDisplayWindow(Object.assign(options, {
      displayName: options.displayName,
      windowName: options.windowName,
      displayContextName: ctx,
      command: 'create-view-object',
      viewId: viewId
    }), next);
  }

  // Executes js commands in the template page
  executeInDisplayWindow(options: any, next: (msg: object) => void) {
    let b = this.getBrowserWindowFromName(options.windowName);
    if(b == undefined) {
      logger.error('windowName not found');
      options.displayName = this.displayName;
      logger.error('Display Worker Error: windowName not found: ' + JSON.stringify(options));
      next(setError(options, 'windowName not found'));
    }
    else {
      if (b.isReady) {
        b.webContents.executeJavaScript("execute('"+ JSON.stringify(options)  +"')", true).then((d: ExecuteDisplayWindowResponse) => {
          if (d.status === 'error') {
            logger.error('ViewObject Command Execution Error: ' + JSON.stringify(d));
            next(d);
          }
          else {
            if (d.command === 'close') {
              this.webviewOwnerStack.delete( d.viewId );
            }
            else if(d.command == 'clear-contents') {
              let wv_id = new Array();
              this.webviewOwnerStack.forEach((v, k) => {
                if(v == options.windowName)
                  wv_id.push(k);
              });
              wv_id.forEach((v) => this.webviewOwnerStack.delete(v) );
              d.viewObjects = wv_id;
            }
            next(d);
          }
        });
      }
      else {
        options.displayName = this.displayName;
        logger.error('Display Worker Error: DOM not ready: ' + JSON.stringify(options));
        next(setError(options, 'DOM not ready'));
      }
    }
  }

  // returns DisplayContext associated with a window Name
  getWindowContext(windowName: string): string {
    let ctx = '';

    this.dcWindows.forEach((v, k) => {
      if (v.indexOf(windowName) > -1) {
        ctx = k;
      }
    });
    return ctx;
  }

  getWindowNameFromBrowserId(browserId: number): string {
    let windowName = '';
    this.windowIdMap.forEach((v, k) => {
      if (v === browserId) {
        windowName = k;
      }
    });
    return windowName;
  }

  // returns the system window id from user defined window name
  getBrowserWindowFromName(name: string): BrowserWindow | null {
    if (this.windowIdMap.has(name)) {
      return BrowserWindow.fromId((this.windowIdMap.get(name) as number));
    }
    else {
      return null;
    }
  }

  // Process commands specified through RPC
  processMessage(message: any, next: (msg: object) => void) {
    logger.info(`processing ${message.command}`);
    let ctx = this.activeDisplayContext;
    try {
      switch (message.command) {
      case 'get-dw-context-windows-vbo':
        let _vbo: any;
        let _winOptions: any;
        let _wins = this.dcWindows.get(message.options.context);

        // add bounds and other information
        if (_wins) {
          _winOptions = {};
          _wins.forEach(_win => {
            _winOptions[_win] = this.windowOptions.get(_win);
          });
        }

        this.webviewOwnerStack.forEach((v, k) => {
          if (_wins && _wins.indexOf(v) > -1) {
            if (_vbo === undefined) {
              _vbo = {};
            }
            _vbo[k] = v;
          }
        });

        let state = {
          'displayName': this.displayName,
          'context': message.options.context,
          'windows': _winOptions,
          'viewObjects': _vbo
        };
        next(state);
        break;

      case 'get-display-bounds':
        let bound = {
          'displayName': this.displayName,
          'bounds': this.bounds
        };
        next(bound);
        break;

      case 'get-window-bounds':
        let _windows = this.dcWindows.get(message.options.context);
        let _windowOptions: any = {};
        if (_windows) {
          _windows.forEach(_win => {
            let _bounds: any = this.windowOptions.get(_win);
            if (_bounds.displayName === undefined) {
              _bounds.displayName = this.displayName;
            }
            _bounds.windowName = _win;
            _bounds.displayContextName = message.options.context;
            _windowOptions[_win] = _bounds;
          });
        }
        else {
          let _bounds: any = this.bounds;
          _bounds.displayName = this.displayName;
          _bounds.windowName = this.displayName;
          _bounds.displayContextName = message.options.context;
          _windowOptions[this.displayName] = _bounds;
        }
        next(_windowOptions);
        break;

      case 'get-context-list' :
        next([...this.displayContext]);
        break;

      case 'set-display-context':
        if (!this.displayContext.has(message.options.context)) {
          this.displayContext.add(message.options.context);
        }
        this.setDisplayContext(message.options.context, next);
        break;

      case 'hide-display-context':
        let b_list = this.dcWindows.get(message.options.context);
        if (b_list) {
          b_list.forEach((b_id) => {
            let b = this.getBrowserWindowFromName(b_id);
            if (b) {
              b.hide();
            }
          }, this);
        }
        next({
          'displayName': this.displayName,
          'command': 'hide-display-context',
          'status': 'success'
        });
        break;

      case 'close-display-context':
        if (message.options.context === 'default') {
          message.command = 'hide-display-context';
          this.processMessage(message, next);
        }
        else {
          this.closeDisplayContext(message.options.context, next);
        }
        break;

      case 'get-focus-window':
        const w = BrowserWindow.getFocusedWindow();
        if (w) {
          let _dc = 'default';
          let _winName = '';
          for (let [k, v] of this.windowIdMap) {
            if (v === w.id) {
              _winName = k;
            }
          }

          for (let [k, v] of this.dcWindows) {
            if (v.indexOf(_winName) > -1) {
              _dc = k;
            }
          }
          next({
            'command': 'get-focus-window',
            'status': 'success',
            'windowName': _winName,
            'displayName': this.displayName,
            'displayContextName': _dc
          });
        }
        else {
          let e_details = {
            command: 'get-focus-window',
            displayName: this.displayName
          };
          logger.error(`Display Worker Error: None of the  display windows are in focus ${JSON.stringify(e_details)}`);
          next(setError(e_details, 'None of the  display windows are in focus'));
        }
        break;

      case 'create-window':
        if (message.options.displayContextName) {
          ctx = message.options.displayContextName;
        }
        this.createWindow(ctx, message.options, next);
        break;

      case 'close-all-windows':
        for(let ctx of this.displayContext){
          let b_list  = this.dcWindows.get(ctx);
          if(b_list){
            b_list.forEach((b_id) => {
              let b = this.getBrowserWindowFromName(b_id);
              if(b){
                b.close();
                this.windowIdMap.delete(b_id);
              }

              let wv_id = new Array();
              this.webviewOwnerStack.forEach( (v, k) => {
                if(v == b_id)
                  wv_id.push(k);
              });
              wv_id.forEach((v) => this.webviewOwnerStack.delete(v) );

            }, this);
          }
        }
        this.displayContext.clear();
        this.displayContext.add('default');
        next({
          'displayName' : this.displayName,
          'command' : 'close-all-windows',
          'status' : 'success'
        });
        break;

      case 'hide-window':
        if(message.options.windowName){
          let b = this.getBrowserWindowFromName(message.options.windowName);
          if(b){
            b.hide();
            next({
              'command' : 'hide-window',
              'status' : 'success',
              'displayName' : this.displayName
            });
          }
          else{
            let e_details = {
              command : 'hide-window',
              displayName : this.displayName
            };
            logger.error('Display Worker Error: windowName not present' + JSON.stringify(e_details));
            next(setError(e_details, 'windowName not present'));
          }
        }
        else{
          let e_details = {
            command : 'hide-window',
            displayName : this.displayName
          };
          logger.error('Display Worker Error: windowName not present' + JSON.stringify(e_details));
          next(setError(e_details, 'windowName not present'));
        }

        break;

      case 'hide-all-windows':
        let bs = BrowserWindow.getAllWindows();
        for( var i = 0; i < bs.length ;i++)
          bs[i].hide();

        next({
          'command' : 'hide-all-windows',
          'status' : 'success',
          'displayName' : this.displayName
        });
        break;

      case 'show-window':
        if(message.options.windowName){
          let b = this.getBrowserWindowFromName(message.options.windowName);
          if(b){
            b.show();
            next({
              'command' : 'show-window',
              'status' : 'success',
              'displayName' : this.displayName
            });
          }
          else{
            let e_details = {
              command : 'show-window',
              displayName : this.displayName
            };
            logger.error('Display Worker Error: windowName not present' + JSON.stringify(e_details));
            next(setError(e_details, 'windowName not present'));
          }
        }
        else{
          let e_details = {
            command : 'show-window',
            displayName : this.displayName
          };
          logger.error('Display Worker Error: windowName not present' + JSON.stringify(e_details));
          next(setError(e_details, 'windowName not present'));
        }
        break;

      case 'close-window':
        if (message.options.windowName) {
          let b = this.getBrowserWindowFromName(message.options.windowName);
          if (b) {
            let webviewIds = new Array();
            this.webviewOwnerStack.forEach((v, k) => {
              if(v === message.options.windowName)
              webviewIds.push(k);
            });
            webviewIds.forEach((v) => this.webviewOwnerStack.delete(v));
            let windowContext = this.getWindowContext(this.getWindowNameFromBrowserId(b.id));
            if(this.dcWindows.has(windowContext)){
              let windowNames = (this.dcWindows.get(windowContext) as string[]);
              windowNames.splice( windowNames.indexOf(message.options.windowName) , 1);
              this.dcWindows.set(windowContext, windowNames);
            }
            b.close();
            this.windowIdMap.delete( message.options.windowName );
            next({
              'command' : 'close-window',
              'status' : 'success',
              'windowName' : message.options.windowName,
              'viewObjects' : webviewIds,
              'displayName' : this.displayName
            });

            io.rabbit!.publishTopic('display.window', {
              type : 'displayWindowClosed',
              details : {
                displayContextName: windowContext,
                windowName : message.options.windowName,
                displayName : this.displayName
              }
            });
          }
          else{
            let e_details = {
              command : 'close-window',
              displayName : this.displayName
            };
            logger.error('Display Worker Error: windowName not present' + JSON.stringify(e_details));
            next(setError(e_details, 'windowName not present'));
          }
        }
        else{
          let e_details = {
            command : 'close-window',
            displayName : this.displayName
          };
          logger.error('Display Worker Error: windowName not present' + JSON.stringify(e_details));
          next(setError(e_details, 'windowName not present'));
        }
        break;

      case 'window-dev-tools':
        let browserWindow = this.getBrowserWindowFromName(message.options.windowName);
        if (browserWindow) {
          if (message.options.devTools) {
            browserWindow.webContents.openDevTools();
          }
          else {
            browserWindow.webContents.closeDevTools();
          }
        }
        next({
          status: 'success',
          devTools: message.options.devTools,
          displayName: this.displayName
        });
        break;

      case 'create-view-object' :
        if (message.options.displayContextName) {
          ctx = message.options.displayContextName;
        }
        this.createViewObject(ctx, message.options, next);
        break;

      case 'capture-window':
        let focw = this.getBrowserWindowFromName(message.options.windowName);
        if (focw) {
          focw.capturePage(img => {
            next(img.toJPEG(80));
          });
        }
        else{
          let e_details = {
            command : 'capture-window',
            displayName : this.displayName
          };
          logger.error('Display Worker Error', `Window ${message.options.windowName} not found: `, e_details);
          next(setError(e_details, `Window ${message.options.windowName} not found`));
        }
        break;

      default:
        if(message.options.viewId){
          message.options.command = message.command;
          message.options.client_id = message.client_id;
          if(this.webviewOwnerStack.has(message.options.viewId) ){
            message.options.windowName = this.webviewOwnerStack.get(message.options.viewId);
            this.executeInDisplayWindow(message.options , next);
          }
          else{
            message.options.displayName = this.displayName;
            logger.error('Display Worker Error: ' +  message.options.viewId + ' - view object not found: ' + JSON.stringify(message.options));
            next(setError(message.options, `${message.options.viewId} - view object is not found.`));
          }
        }
        else if(message.options.windowName){
          message.options.command = message.command;
          this.executeInDisplayWindow(message.options, next);
        }
        else{
          message.options.displayName = this.displayName;
          logger.error('Display Worker Error: Command not defined: ' + JSON.stringify(message.options));
          next(setError(message.options, 'Command not defined'));
        }
      }
    }
    catch(exc) {
      logger.error(exc.stack);
      next({
        status: exc.toString()
      });
    }
  }
}