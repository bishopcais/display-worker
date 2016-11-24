const fs = require('fs')
const electron = require('electron')
process.Title = "DisplayWorker"
const {app, BrowserWindow, ipcMain} = require('electron')
const uuid = require('node-uuid')
const winston = require('winston')
let logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: 'info',
            handleExceptions: true,
            json: false,
            colorize: true,
            formatter: function(options) {
                // Return string will be passed to logger.
                return process.Title +':'+ options.level.toUpperCase() +' '+ (options.message ? options.message : '') +
                (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
            }
        })
    ]
});

function fileExists(filePath)
{
    try
    {
        return fs.statSync(filePath).isFile();
    }
    catch (err)
    {
        return false;
    }
}

let searchPaths = []

if(process.argv.length > 2 )
    searchPaths.push(process.argv[2])
else
    searchPaths.push('./cog.json')


let cogPath = ''
searchPaths.some((f) => { if(fileExists(f)){ cogPath = f; return true;} } )
if(cogPath === ''){
    logger.error( 'Display Worker Configuration not found in any of these locations : ' , searchPaths )
    process.exit()
}
logger.info( 'using configuration from ' , cogPath )
const CELIO = require('@cel/celio')
const io = new CELIO(cogPath)

// check if displayName is defined
try{
    logger.info( 'Display Worker Name : ',  io.config.get('display:displayName') )
}catch(e){
    logger.error( 'Unable to start Display Worker. Please specify displayName under display settings in the configuration file.' )
    process.exit()
}

const Pointing = require('./pointing')
const DisplayError = require('./displayerror')
let displayWorker
app.commandLine.appendSwitch('disable-http-cache')
app.setName('CELIO Display Worker')
app.on('ready', () => {

    process.setMaxListeners(0);
	let displays = electron.screen.getAllDisplays()

    logger.info('Displays attached to this display-worker: \n')
    displays.forEach((d) => {
        logger.info(d)
    })

    // //stores the app details on store
    // if(io.config.get('apps'))
    //     io.store.setState('apps', JSON.stringify(io.config.get('apps')) )

    displayWorker = new DisplayWorker(process.argv)
});

app.on('quit', () =>{
    logger.info('closing display worker');
    // io.publishTopic('display.removed', io.config.get('display:displayName'))
})

app.on('exit', () =>{
    logger.info('exiting display worker');
    io.publishTopic('display.removed', io.config.get('display:displayName'))
})


app.on('window-all-closed', () => {
    // This dummy handler is required to keep display-worker running after closing all browserwindow
});


ipcMain.on('view-object-event', (event, arg) => {
  if(arg.displayContext && arg.type)  
    io.publishTopic('display.'+ arg.displayContext + '.' + arg.type + '.' + arg.details.view_id , arg)
})

ipcMain.on('launchermenu', (event , msg) => {
    msg = JSON.parse(msg)
    logger.info('launching app via menu ', msg)
    if(msg.type == 'celio') {
        io.displayContext.setActive( msg.appname, false );
        io.store.setState('display:activeAppOnMenu', msg.appname );
    }else if( msg.type == 'GSpeak') {
        io.store.setState('display:activeAppOnMenu', msg.appname )
        io.store.setState('display:activeDisplayContext', msg.appname )
        io.displayContext.hideAll().then(m =>{
            io.publishTopic('pool.' + msg['chief-pool'], JSON.stringify( { descrips : [ 'barbiturate', 'wake-up'], ingests: {} } ))
            logger.info('all display contexts hidden')
            if(msg['master-reset']){
                setTimeout( ()=>{
                    io.publishTopic('pool.' + msg['chief-pool'], JSON.stringify( { descrips : [ 'master-reset'], ingests: {} } ))

                }, 400)    
            }

            setTimeout( ()=>{
                io.publishTopic('pool.' + msg['chief-pool'], JSON.stringify( { descrips : [ 'barbiturate', 'wake-up'], ingests: {} } ))
                if(msg['master-reset']){
                    setTimeout( ()=>{
                        io.publishTopic('pool.' + msg['chief-pool'], JSON.stringify( { descrips : [ 'master-reset'], ingests: {} } ))

                    }, 400)
                }
            }, 500)

        })
    }
})

io.onTopic('pool.*', m =>{
    let msg = JSON.parse(m.toString())
    if(msg.ingests['signal-pool'] && msg.ingests['signal-pool'].indexOf('celio') > -1){
        io.store.getSet('display:displayContexts').then( c => {
            if(c.indexOf(msg.ingests.appname) > -1){
                io.displayContext.setActive( msg.ingests.appname, true )
            }
        })    
    }
})

class DisplayWorker {
    constructor(){
        this.displays = electron.screen.getAllDisplays()    
        
        if( io.config.get('display:bounds')){
            this.bounds = io.config.get('display:bounds')
        }else{
            const bounds = { x : 0, y : 0, right : 0, bottom : 0 }
            this.displays.forEach( (disp) => {
                //bounds: { x: 0, y: 0, width: 1920, height: 1200 }
                let bl = disp.bounds.x
                let bt = disp.bounds.y
                let br = disp.bounds.width + bl
                let bb = disp.bounds.height + bt

                bounds.x = Math.min(bl, bounds.x)
                bounds.y = Math.min(bt, bounds.y)

                bounds.right = Math.max(br, bounds.right)
                bounds.bottom = Math.max(bb, bounds.bottom)

                bounds.width = bounds.right - bounds.x
                bounds.height = bounds.bottom - bounds.y
            })
            bounds.details = this.displays
            this.bounds = bounds

            io.config.set('display:bounds', this.bounds)
        }

        logger.info('\nDisplay-worker configuration : \n')
        logger.info(io.config.get('display'))
        logger.info(io.config.get('display:templateDir'))
        this.config = io.config.get('display')
        
        this.displayName = this.config.displayName
        this.displayContext = new Set()
        this.displayContext.add('default')
        this.activeDisplayContext = 'default'
        
        this.windowIdMap = new Map()
        this.windowOptions = new Map()
        this.dcWindows = new Map()
        this.dcWindows.set(this.activeDisplayContext, [])
        this.webviewOwnerStack = new Map()

        io.doCall('rpc-display-' + io.config.get('display:displayName'), (request, reply, ack)=>{
            try{
                let msg = JSON.parse(request.content.toString())
                this.process_message(msg, reply)
            }catch(e){
                reply(e)
            }
        })

        this.pointing = new Pointing(io)
        io.publishTopic('display.added', io.config.get('display:displayName'))
        logger.info('\nworker server started.\n')
    }

    close_display_context (context, next) {
        
        this.displayContext.delete(context)
        let b_list  = this.dcWindows.get(context)
        if(b_list){
            let wv_ids = []
            b_list.forEach((b_id) => {
                let b = this.getBrowserWindowFromId(b_id)
                if(b) {
                    b.close()
                    this.windowIdMap.delete(b_id)
                }

                let wv_id = new Array();
                this.webviewOwnerStack.forEach( (v, k) => {
                    if(v == b_id)
                        wv_id.push(k)
                })
                wv_id.forEach((v) => {
                    wv_ids.push(v)
                    this.webviewOwnerStack.delete(v) 
                })

            }, this)
            this.dcWindows.delete(context)
            this.activeDisplayContext = 'default'
            next(JSON.stringify({
                'status' : 'success',
                'command' : 'close-display-context',
                'displayName' : this.displayName,
                'message' : context + ' : context closed. The active display context is set to default context. Please use setDisplayContext to bring up the default context or specify an existing or new display context.',
                'closedDisplayContext' : context,
                'closedWindows' : b_list,
                'closedViewObjects' : wv_ids
            }))             
        }else{
            next(JSON.stringify({
                'status' : 'warning',
                'displayName' : this.displayName,
                'command' : 'close-display-context',
                'message' : context + ' : context does not exist'
            }))
        }
    }

    set_display_context(context, next) {
        let lastContext = this.activeDisplayContext
        if( this.activeDisplayContext != context ){
            let b_list  = this.dcWindows.get(this.activeDisplayContext)
            if(b_list){
                b_list.forEach((element) => {
                    let b = this.getBrowserWindowFromId(element)
                    if(b) {
                        b.hide()
                    }
                }, this);
            }
        }
        this.activeDisplayContext = context
        if(this.dcWindows.has(this.activeDisplayContext)){
            let b_list  = this.dcWindows.get(this.activeDisplayContext)
            b_list.forEach((element) => {
                let b = this.getBrowserWindowFromId(element)
                if(b) b.show()
            }, this)
        }else{
            this.dcWindows.set(this.activeDisplayContext, []);
        }
        
        next(JSON.stringify({
            'status' : 'success',
            'command' : 'set-active-context',
            'displayName' : this.displayName,
            'message' : this.activeDisplayContext + ' is now active'
        })) 
    }

    create_window( context , options, next){
        console.log(options)
        let b_id = options.windowName;
        this.windowOptions.set(options.windowName, options)
        let opts = {
            x : options.x,
            y : options.y,
            width : options.width,
            height : options.height,
            frame: false,
            enableLargerThanScreen: true,
            acceptFirstMouse : true,
            backgroundColor: '#2e2c29',
            webPreferences : {
                nodeIntegration : true
            }
        }
        
        let browser = new BrowserWindow(opts)
        
        logger.info('loading template : ', 'file://' + io.config.get('display:templateDir') + '/' + options.template)
        browser.loadURL('file://' + io.config.get('display:templateDir') + '/' + options.template)
        
        browser.on('closed', () =>{
        })
        if(!this.dcWindows.has(context)){
            this.dcWindows.set(context, [])
        }
        
        this.windowIdMap.set(b_id, browser.id)
        this.dcWindows.get( context ).push( b_id )
        // let b_list = this.dcWindows.get( context )
        // b_id = b_list[b_list.length -1];    

        browser.on('blur', () => {
            browser.webContents.executeJavaScript('clearAllCursors()')
            browser.webContents.executeJavaScript('hideLauncherMenu()')
            browser.webContents.setAudioMuted(true)
        })

        browser.on('focus', () => {
            browser.webContents.setAudioMuted(false)
        })

        browser.webContents.on('will-navigate', (e) => {
            logger.info('preventing attempt to navigate browser window content')
            e.preventDefault()
            return false
        })

        browser.webContents.on('did-finish-load', ()=> {
            if(io.config.get('display:launcherMenu')){
                io.store.getState('apps').then( m => {
                    logger.info('setting up menu handler in new DisplayWindow')
                    browser.webContents.executeJavaScript("setupNativeMenuHandler(" + m  + ", '" + io.config.get("display:launcherMenu:position")  + "')")
                })
            }
            browser.webContents.executeJavaScript("setDisplayContext('" + context  + "')")
            if(options.fontSize)
                browser.webContents.executeJavaScript("setFontSize('" + options.fontSize  + "')")

        })

        browser.webContents.on('dom-ready', () => {
            browser.isReady = true

            if(options.contentGrid){
                this.execute_in_displaywindow(Object.assign(options, {
                    window_id: b_id,
                    displayName: this.displayName,
                    displayContext: this.activeDisplayContext,
                    windowName : options.windowName,
                    template: options.template,
                    x : options.x,
                    y : options.y,
                    width : options.width,
                    height : options.height,
                    command: 'create-grid'
                }), next)
            }else{
                next(JSON.stringify({
                    status : 'success',
                    window_id : b_id,
                    x : options.x,
                    y : options.y,
                    width : options.width,
                    height : options.height,
                    displayName : this.displayName,
                    displayContext : this.activeDisplayContext,
                    windowName : options.windowName
                }))
            }
        })

         io.publishTopic('display.window', JSON.stringify({
            type : 'displayWindowCreated',
            details : {
                displayContext : this.activeDisplayContext,
                window_id : b_id,
                displayName : this.displayName
            }
        }))
       
    }


    create_viewobj( ctx, options, next){
        let view_id = uuid.v1()
        this.webviewOwnerStack.set(view_id, options.window_id)
        
        this.execute_in_displaywindow(Object.assign(options, {
            window_id : options.window_id,
            displayName : options.displayName,
            windowName : options.windowName,
            displayContext : ctx,
            command: 'create-viewobj',
            view_id : view_id
        }), next)
    }

    execute_in_displaywindow(options, next){
        let b = this.getBrowserWindowFromId(options.window_id)
        if(b == undefined) {
            logger.error('window_id not found')
            options.displayName = this.displayName
            logger.error('Display Worker Error: Window_id not found: ' + JSON.stringify(options))
            next(new DisplayError('Display Worker Error', 'Window_id not found', options))
        }else{
            if(b.isReady){
                b.webContents.executeJavaScript("execute('"+ JSON.stringify(options)  +"')", true, (d)=>{
                    if(d.status === 'error'){
                        logger.error('ViewObject Command Execution Error: ' + JSON.stringify(d))
                        next( new DisplayError('ViewObject Command Execution Error', d.error_message, d))
                    }else{
                        if(d.command == 'close'){
                            this.webviewOwnerStack.delete( d.view_id )
                        }else if(d.command == 'clear-contents'){
                            let wv_id = new Array();
                            this.webviewOwnerStack.forEach( (v, k) => {
                                if(v == options.window_id)
                                    wv_id.push(k)
                            })
                            wv_id.forEach((v) => this.webviewOwnerStack.delete(v) )
                            d.viewObjects = wv_id
                        }
                        next(JSON.stringify(d))
                    }
                })
            }else{
                options.displayName = this.displayName
                logger.error('Display Worker Error: DOM not ready: ' + JSON.stringify(options))
                next(new DisplayError( 'Display Window Error', 'DOM not ready', options) )
            }

        }
    }

    getWindowContext(window_id){
        let ctx = '' 
        
        this.dcWindows.forEach( (v,k) =>{
            if(v.indexOf(window_id) > -1){
                ctx = k
            }
        })
        return ctx
    }

    getBrowserWindowFromId(uuid){
        if(this.windowIdMap.has(uuid)){
            return BrowserWindow.fromId(this.windowIdMap.get(uuid))
        }else{
            return null
        }
    }

    process_message ( message, next) {
        logger.info('processing ' , message.command)
        let ctx = this.activeDisplayContext
        try{
            switch (message.command){
                case 'get-dw-context-windows-vbo':
                    let _vbo = undefined
                    let _wins = this.dcWindows.get(message.options.context)
                    let _winOptions = undefined
                    //add bounds and other information
                    if(_wins){
                        _winOptions = {}
                        _wins.forEach( _win => {
                            _winOptions[_win] = this.windowOptions.get(_win)
                        })
                    } 
                    
                    this.webviewOwnerStack.forEach( (v, k) => {
                        if( _wins.indexOf(v) > -1 ){
                            if(_vbo === undefined)
                                _vbo = {}

                            _vbo[k] = v
                        }
                    })

                    let state = {
                        'displayName': this.displayName,
                        'context': message.options.context,
                        'windows': _winOptions,
                        'viewObjects': _vbo
                    }
                    console.log(state)
                    next(JSON.stringify(state))
                    break;
                case 'get-display-bounds' :
                    let bound = {
                        'displayName' : this.displayName,
                        'bounds' : this.bounds
                    }
                    next(JSON.stringify(bound))
                    break;
                case 'get-window-bounds' :
                    let _windows = this.dcWindows.get(message.options.context)
                    let _windowOptions = {}
                    if(_windows){
                        _windows.forEach( _win => {
                            let _bounds = this.windowOptions.get(_win)
                            if (_bounds.displayName === undefined) { _bounds.displayName = this.displayName }
                            _bounds.windowName = _win
                            _bounds.displayContext = message.options.context
                            _windowOptions[_win] = _bounds 
                        })
                    }else{
                        let _bounds = this.bounds
                        _bounds.displayName = this.displayName
                        _bounds.windowName = this.displayName
                        _bounds.displayContext = message.options.context
                        _windowOptions[this.displayName] = _bounds
                    } 
                    console.log(_windowOptions)
                    next(JSON.stringify(_windowOptions))
                    break;
                case 'get-context-list' :
                    console.log(this.displayContext)
                    next(JSON.stringify([...this.displayContext]))
                    break;
                case 'set-display-context':
                    if(!this.displayContext.has(message.options.context)){
                        this.displayContext.add(message.options.context)
                    }
                    this.set_display_context( message.options.context, next)
                    break;
                case 'hide-display-context':
                    let b_list  = this.dcWindows.get(message.options.context)
                    if(b_list){
                        b_list.forEach((b_id) => {
                            let b = this.getBrowserWindowFromId(b_id)
                            if(b) b.hide()
                        }, this)
                    }
                    next(JSON.stringify({
                                'displayName' : this.displayName,
                                'command' : 'hide-display-context',
                                'status' : 'success'
                            }))
                    break;
                case 'close-display-context':
                    if(message.options.context == 'default'){
                        message.command = 'hide-display-context'
                        this.process_message(message, next)
                    }else{
                        this.close_display_context(message.options.context, next)
                    }
                    
                    break;
                case 'get-focus-window':
                    const w = BrowserWindow.getFocusedWindow()
                    if (w) {
                        let _dc = 'default'
                        for( let [k, v] of this.dcWindows){
                            if(v.indexOf( w.id) > -1){
                                _dc = k
                            }
                        }
                        next(JSON.stringify({
                                'command' : 'get-focus-window',
                                'status' : 'success',
                                'window_id' : w.id,
                                'displayName' : this.displayName,
                                'displayContext' : _dc
                        }))
                    }else{
                        let e_details = {
                            command : 'get-focus-window',
                            displayName : this.displayName
                        }
                        logger.error( 'Display Worker Error: None of the  display windows are in focus' +  JSON.stringify(e_details))
                        next(new DisplayError('Display Worker Error', 'None of the  display windows are in focus', e_details))
                    }
                    break;
                case 'create-window':
                    if(message.options.displayContext){
                        ctx = message.options.displayContext
                    }
                    this.create_window(ctx, message.options, next)
                    break;
                case 'close-all-windows':
                    for( let ctx of this.displayContext){
                        let b_list  = this.dcWindows.get(ctx)
                        if(b_list){
                            b_list.forEach((b_id) => {
                                let b = this.getBrowserWindowFromId(b_id)
                                if(b){
                                    b.close()
                                    this.windowIdMap.delete(b_id)
                                } 

                                let wv_id = new Array();
                                this.webviewOwnerStack.forEach( (v, k) => {
                                    if(v == b_id)
                                    wv_id.push(k)
                                })
                                wv_id.forEach((v) => this.webviewOwnerStack.delete(v) )

                            }, this)
                        }
                    }
                    this.displayContext.clear()
                    this.displayContext.add('default')
                    next(JSON.stringify({
                                'displayName' : this.displayName,
                                'command' : 'close-all-windows',
                                'status' : 'success'
                            }))
                    
                    
                    break;
                case 'hide-window':
                    if(message.options.window_id){
                        let b = this.getBrowserWindowFromId(message.options.window_id);
                        if(b){
                            b.hide()
                            next(JSON.stringify({
                                'command' : 'hide-window',
                                'status' : 'success',
                                'displayName' : this.displayName
                            }))
                        }else{
                            let e_details = {
                                command : 'hide-window',
                                displayName : this.displayName
                            }
                            logger.error('Display Worker Error: Window_id not present' + JSON.stringify(e_details))
                            next(new DisplayError('Display Worker Error', 'Window_id not present', e_details))
                        }
                    }else{
                        let e_details = {
                            command : 'hide-window',
                            displayName : this.displayName
                        }
                        logger.error('Display Worker Error: Window_id not present' + JSON.stringify(e_details))
                        next(new DisplayError('Display Worker Error', 'Window_id not present', e_details))
                    }
                        
                    break;
                case 'hide-all-windows':
                    let bs = BrowserWindow.getAllWindows()
                    for( var i = 0; i < bs.length ;i++)
                        bs[i].hide()

                    next(JSON.stringify({
                        'command' : 'hide-all-windows',
                        'status' : 'success',
                        'displayName' : this.displayName 
                    }))
                    break;
                case 'show-window':
                    if(message.options.window_id){
                        let b = this.getBrowserWindowFromId(message.options.window_id);
                        if(b){
                            b.show()
                            next(JSON.stringify({
                                'command' : 'show-window',
                                'status' : 'success',
                                'displayName' : this.displayName 
                            }))
                        }else{
                            let e_details = {
                                command : 'show-window',
                                displayName : this.displayName
                            }
                            logger.error('Display Worker Error: Window_id not present' + JSON.stringify(e_details))
                            next(new DisplayError('Display Worker Error', 'Window_id not present', e_details))
                        }
                    }else{
                        let e_details = {
                            command : 'show-window',
                            displayName : this.displayName
                        }
                        logger.error('Display Worker Error: Window_id not present' + JSON.stringify(e_details))
                        next(new DisplayError('Display Worker Error', 'Window_id not present', e_details))
                    }
                    break;
                case 'close-window':
                    if(message.options.window_id){
                        let b = this.getBrowserWindowFromId(message.options.window_id)
                        if(b){
                        
                            let wv_id = new Array();
                            this.webviewOwnerStack.forEach( (v, k) => {
                                if(v == message.options.window_id)
                                    wv_id.push(k)
                            })
                            wv_id.forEach((v) => this.webviewOwnerStack.delete(v) )
                            let w_ctx = this.getWindowContext(b.id)
                            if(this.dcWindows.has(w_ctx)){
                                let win_arr = this.dcWindows.get( w_ctx   )
                                win_arr.splice( win_arr.indexOf(message.options.window_id) , 1)
                                this.dcWindows.set(w_ctx, win_arr)
                            }
                            b.close()
                            this.windowIdMap.delete( message.options.window_id )
                            next(JSON.stringify({
                                    'command' : 'close-window',
                                    'status' : 'success',
                                    'window_id' : message.options.window_id,
                                    'viewObjects' : wv_id,
                                    'displayName' : this.displayName
                                }))

                            io.publishTopic('display.window', JSON.stringify({
                                type : 'displayWindowClosed',
                                details : {
                                    displayContext : w_ctx,
                                    window_id : message.options.window_id,
                                    displayName : this.displayName
                                }
                            }))
                        }else{
                            let e_details = {
                                command : 'close-window',
                                displayName : this.displayName
                            }
                            logger.error('Display Worker Error: Window_id not present' + JSON.stringify(e_details))
                            next(new DisplayError('Display Worker Error', 'Window_id not present', e_details))
                        } 
                    }else{
                        let e_details = {
                            command : 'close-window',
                            displayName : this.displayName
                        }
                        logger.error('Display Worker Error: Window_id not present' + JSON.stringify(e_details))
                        next(new DisplayError('Display Worker Error', 'Window_id not present', e_details))
                    }
                    break;
                case 'window-dev-tools':
                
                    let b = this.getBrowserWindowFromId(message.options.window_id)
                    if(b){
                        if(message.options.devTools)
                            b.openDevTools()
                        else
                            b.closeDevTools()
                    }
                    next(JSON.stringify({'status' : 'success', 'devTools' : message.options.devTools,  'displayName' : this.displayName} ))
                    break;   
                case 'create-viewobj' :
                    if(message.options.displayContext){
                        ctx = message.options.displayContext
                    }
                    this.create_viewobj(ctx, message.options, next)
                    break;
                case 'capture-window':
                    let focw = this.getBrowserWindowFromId(message.options.window_id)
                    if (focw) {
                        focw.capturePage(img => {
                            next(img.toJPEG(80))
                        })
                    }else{
                        let e_details = {
                            command : 'capture-window',
                            displayName : this.displayName
                        }
                        logger.error('Display Worker Error', `Window ${message.options.window_id} not found: `, e_details)
                        next(new DisplayError('Display Worker Error', `Window ${message.options.window_id} not found`, e_details))
                    }
                    break;
                default :
                    if(message.options.view_id){
                        message.options.command = message.command
                        message.options.client_id = message.client_id
                        if(this.webviewOwnerStack.has(message.options.view_id) ){
                            message.options.window_id = this.webviewOwnerStack.get(message.options.view_id)
                            this.execute_in_displaywindow(message.options , next)
                        }else{
                            message.options.displayName = this.displayName
                            logger.error('Display Worker Error: ' +  message.options.view_id + ' - view object not found: ' + JSON.stringify(message.options))
                            next(new DisplayError('Display Worker Error', message.options.view_id + ' - view object is not found.' , message.options ))    
                        }
                    }else if(message.options.window_id){
                        message.options.command = message.command
                        this.execute_in_displaywindow(message.options , next)
                    }else{
                        message.options.displayName = this.displayName
                        logger.error('Display Worker Error: Command not defined: ' + JSON.stringify(message.options))
                        next(new DisplayError('Display Worker Error', 'Command not defined' , message.options ))
                    }
            }
        }catch(e){
            logger.error(e)
            next(JSON.stringify({ status : e.toString() }))
        }
    }
}
