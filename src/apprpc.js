const fs = require("fs")
const electron = require('electron')

const {app, BrowserWindow, ipcMain} = require("electron")
const uuid = require('node-uuid')
const CELIO = require('celio')
const io = new CELIO()
const Pointing = require('./pointing')
let displayWorker
app.commandLine.appendSwitch('disable-http-cache')
app.setName("CELIO Display Worker")
app.on('ready', () => {

    process.setMaxListeners(0);
	let displays = electron.screen.getAllDisplays()


    console.log("Displays attached to this display-worker: \n")
    displays.forEach((d) => {
        console.log(d)
    })
    displayWorker = new DisplayWorker(process.argv)
});

app.on('quit', () =>{
    console.log("closing");
    io.getStore().removeFromHash("display.displays", io.config.get("display:displayName") )
    io.publishTopic("display.removed", io.config.get("display:displayName"))
})

app.on('window-all-closed', () => {
    // console.log('all windows closed');
    // This dummy handler is required to keep display-worker running after closing all browserwindow
});


ipcMain.on('view-object-event', (event, arg) => {
  if(arg.displayContext && arg.type)  
    io.publishTopic("display."+ arg.displayContext + "." + arg.type , arg)
})

ipcMain.on('launchermenu', (event , arg) => {
    console.log(" launch menu ", arg)
    io.publishTopic('launchmenu.select', arg)
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

        console.log("\nDisplay-worker configuration : \n")
        console.log(io.config.get("display"))
        this.config = io.config.get("display")
        
        this.displayName = this.config.displayName
        this.displayContext = new Set()
        this.displayContext.add("default")
        this.activeDisplayContext = "default"
        
        this.dcWindows = new Map()
        this.dcWindows.set(this.activeDisplayContext, [])
        this.webviewOwnerStack = new Map()



        io.getStore().addToHash("display.displays", this.displayName, JSON.stringify(this.bounds) )

        io.doCall('display-rpc-queue-' + io.config.get("display:displayName"), (request, reply, ack)=>{
            try{
                let msg = JSON.parse(request.content.toString())
                console.log(msg)
                this.process_message(msg, reply)
            }catch(e){
                reply(JSON.stringify(e))
            }
        })

        this.pointing = new Pointing(io)
        io.publishTopic("display.added", io.config.get("display:displayName"))
        console.log("\nworker server started.\n")
    }

    close_display_context (context, next) {
        
        this.displayContext.delete(context)
        let b_list  = this.dcWindows.get(context)
        console.log( "close dc ", context, b_list)
        if(b_list){
            let wv_ids = []
            b_list.forEach((b_id) => {
                let b = BrowserWindow.fromId(b_id)
                if(b) b.close()

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
            this.activeDisplayContext = "default"
            next(JSON.stringify({
                "status" : "success",
                "command" : "close-display-context",
                "message" : context + " : context closed. The active display context is set to default context. Please use setDisplayContext to bring up the default context or specify an existing or new display context."
            })) 
            io.publishTopic("display.displayContext.closed", JSON.stringify({
                type : "displayContextClosed",
                details : {
                    closedDisplayContext : context,
                    closedWindows : b_list,
                    closedViewObjects : wv_ids
                }
            }))
        }else{
            next(JSON.stringify({
                "status" : "warning",
                "command" : "close-display-context",
                "message" : context + " : context does not exist"
            }))
        }
    }

    set_display_context(context, next) {
        let lastContext = this.activeDisplayContext
        if( this.activeDisplayContext != context ){
            let b_list  = this.dcWindows.get(this.activeDisplayContext)
            if(b_list){
                b_list.forEach((element) => {
                    let b = BrowserWindow.fromId(element)
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
                let b = BrowserWindow.fromId(element)
                if(b) b.show()
            }, this)
        }else{
            this.dcWindows.set(this.activeDisplayContext, []);
        }
        io.publishTopic("display.displayContext.changed", JSON.stringify({
            type : "displayContextChanged",
            details : {
                displayContext : this.activeDisplayContext,
                lastDisplayContext : lastContext
            }
        }))
        next(JSON.stringify({
            "status" : "success",
            "command" : "set-active-context",
            "message" : this.activeDisplayContext + " is now active"
        })) 
    }

    create_window( context , options, next){
        let b_id = 0;
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
        console.log("loading template : ", "file://" + process.cwd() + "/template/" + options.template)
        browser.loadURL("file://" + process.cwd() + "/template/" + options.template)
        
        browser.on('closed', () =>{
        })
        if(!this.dcWindows.has(context)){
            this.dcWindows.set(context, [])
        }
        this.dcWindows.get( context ).push( browser.id )
        let b_list = this.dcWindows.get( context )
        b_id = b_list[b_list.length -1];    

        browser.on('blur', () => {
            browser.webContents.executeJavaScript("clearAllCursors()")
            browser.webContents.executeJavaScript("hideLauncherMenu()")
            browser.webContents.setAudioMuted(true)
        })

        browser.on('focus', () => {
            browser.webContents.setAudioMuted(false)
        })

        browser.webContents.on("will-navigate", (e) => {
            console.log("preventing attempt to navigate browser window content")
            e.preventDefault()
            return false
        })

        browser.webContents.on('did-finish-load', ()=> {
            if(io.config.get("display:launcherMenu")){
                io.getStore().getState("apps").then( m => {
                    console.log("setting up menu handler")
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
                    command: "create-grid"
                }), next)
            }else{
                next(JSON.stringify({
                    status : "success",
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

         io.publishTopic("display.window", JSON.stringify({
            type : "displayWindowCreated",
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
            command: "create-viewobj",
            view_id : view_id
        }), next)
    }

    execute_in_displaywindow(options, next){
        let b = BrowserWindow.fromId(options.window_id)
        if(b == undefined) {
            console.log("window_id not found")
            next(JSON.stringify({ "error" : "window_id not found", "message" : options }))
        }else{
            if(b.isReady){
                b.webContents.executeJavaScript("execute('"+ JSON.stringify(options)  +"')", true, (d)=>{
                    if(d.command == "close"){
                        this.webviewOwnerStack.delete( d.view_id )
                    }else if(d.command == "clear-contents"){
                        let wv_id = new Array();
                        this.webviewOwnerStack.forEach( (v, k) => {
                            if(v == options.window_id)
                                wv_id.push(k)
                        })
                        wv_id.forEach((v) => this.webviewOwnerStack.delete(v) )
                        d.viewObjects = wv_id
                    }
                    next(JSON.stringify(d))
                })
            }else{
                next(JSON.stringify(new Error( "dom not ready")))
            }

        }
    }

    getWindowContext(window_id){
        let ctx = "" 
        
        this.dcWindows.forEach( (v,k) =>{
            if(v.indexOf(window_id) > -1){
                ctx = k
            }
        })
        return ctx
    }

    process_message ( message, next) {
        // console.log("executing : ", message.content.toString())
        // message = JSON.parse(message.content.toString())
        let ctx = this.activeDisplayContext
        try{
        switch (message.command){
            case "get-bounds" :
                let bound = {
                    "displayName" : this.displayName,
                    "bounds" : this.bounds,
                    "details" : this.displays
                }
                next(JSON.stringify(bound))
                break;
            case "get-active-display-context" :
                next(this.activeDisplayContext)
                break;
            case "set-display-context":
                if(!this.displayContext.has(message.options.context)){
                    this.displayContext.add(message.options.context)
                }
                console.log(this.displayContext)
                this.set_display_context( message.options.context, next)
                break;
            case "hide-display-context":
                let b_list  = this.dcWindows.get(message.options.context)
                if(b_list){
                    b_list.forEach((b_id) => {
                        let b = BrowserWindow.fromId(b_id)
                        if(b) b.hide()
                    }, this)
                }
                next(JSON.stringify({
                            "command" : "hide-display-context",
                            "status" : "success"
                        }))
                break;
            case "close-display-context":
                if(message.options.context == "default"){
                    message.command = "hide-display-context"
                    this.process_message(message, next)
                }else{
                    this.close_display_context(message.options.context, next)
                }
                
                break;
            case "get-all-contexts":
                console.log(this.displayContext)
                next(JSON.stringify(Array.from(this.displayContext)))
                break;
            case "get-all-windows-by-context":
                let wins = this.dcWindows.get(message.options.context)
                next(JSON.stringify(wins))
                break;
            case "get-focus-window":
                const w = BrowserWindow.getFocusedWindow()
                if (w) {
                    let _dc = "default"
                    for( let [k, v] of this.dcWindows){
                        if(v.indexOf( w.id) > -1){
                            _dc = k
                        }
                    }
                    next(JSON.stringify({
                            "command" : "get-focus-window",
                            "status" : "success",
                            "window_id" : w.id,
                            "displayName" : this.displayName,
                            "displayContext" : _dc
                    }))
                }else{
                    next(JSON.stringify(new Error("none of the  display windows are in focus")))
                }
                break;
            case "create-window":
                if(message.options.displayContext){
                    ctx = message.options.displayContext
                }
                this.create_window(ctx, message.options, next)
                break;
            case "close-all-windows":
                for( let ctx of this.displayContext){
                    let b_list  = this.dcWindows.get(ctx)
                    if(b_list){
                        b_list.forEach((b_id) => {
                            let b = BrowserWindow.fromId(b_id)
                            if(b) b.close()

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
                this.displayContext.add("default")
                next(JSON.stringify({
                            "command" : "close-all-windows",
                            "status" : "success"
                        }))
                
                
                break;
            case "hide-window":
                if(message.options.window_id){
                    let b = BrowserWindow.fromId(message.options.window_id);
                    if(b){
                        b.hide()
                        next(JSON.stringify({
                            "command" : "hide-window",
                            "status" : "success"
                        }))
                    }else{
                        next(JSON.stringify( new Error( "window_id not present" ) ))
                    }
                }else{
                    next(JSON.stringify( new Error( "parameter window_id not present" ) ))
                }
                    
                break;
            case "hide-all-windows":
                let bs = BrowserWindow.getAllWindows()
                for( var i = 0; i < bs.length ;i++)
                    bs[i].hide()

                next(JSON.stringify({
                    "command" : "hide-all-windows",
                    "status" : "success"
                }))
                break;
            case "show-window":
                 if(message.options.window_id){
                    let b = BrowserWindow.fromId(message.options.window_id);
                    if(b){
                        b.show()
                        next(JSON.stringify({
                            "command" : "show-window",
                            "status" : "success"
                        }))
                    }else{
                        next(JSON.stringify( new Error( "window_id not present")))
                    }
                }else{
                    next(JSON.stringify( new Error( "parameter window_id not present" ) ))
                }
                break;
            case "close-window":
                 if(message.options.window_id){
                    let b = BrowserWindow.fromId(message.options.window_id)
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
                        next(JSON.stringify({
                                "command" : "close-window",
                                "status" : "success",
                                "window_id" : message.options.window_id,
                                "viewObjects" : wv_id
                            }))

                        io.publishTopic("display.window", JSON.stringify({
                            type : "displayWindowClosed",
                            details : {
                                displayContext : w_ctx,
                                window_id : message.options.window_id,
                                displayName : this.displayName
                            }
                        }))
                    }else{
                        next(JSON.stringify( new Error( "window_id not present")))
                    } 
                 }else{
                     next(JSON.stringify( new Error( "parameter window_id not present" ) ))
                 }
                break;
            case "window-dev-tools":
               
                let b = BrowserWindow.fromId(message.options.window_id)
                if(b){
                    if(message.options.devTools)
                        b.openDevTools()
                    else
                        b.closeDevTools()
                }
                next(JSON.stringify({"status" : "success", "devTools" : message.options.devTools} ))
                break;   
            case "create-viewobj" :
                if(message.options.displayContext){
                    ctx = message.options.displayContext
                }
                this.create_viewobj(ctx, message.options, next)
                break;
            case "capture-window":
                let focw = BrowserWindow.fromId(message.options.window_id)
                if (focw) {
                    focw.capturePage(img => {
                        next(img.toJPEG(80))
                    })
                }else{
                    next ( JSON.stringify( new Error(`Window ${message.options.window_id} not found`) ))
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
                        next(JSON.stringify(new Error( message.options.view_id + " - view object is not found.")))    
                    }
                }else if(message.options.window_id){
                     message.options.command = message.command
                    this.execute_in_displaywindow(message.options , next)
                }else{
                    next(JSON.stringify(new Error( "Command not defined.")))
                }
        }
        }catch(e){
            console.log(e)
            next(JSON.stringify(e))
        }
    }
}