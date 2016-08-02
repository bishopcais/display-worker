const fs = require("fs")
const electron = require('electron')

const {app, BrowserWindow, ipcMain} = require("electron")
const uuid = require('node-uuid')
const CELIO = require('celio')
const io = new CELIO()
const BasicPointing = require('./basicpointing')
let displayWorker
app.setName("CELIO Display Worker")
app.on('ready', () => {
	let displays = electron.screen.getAllDisplays()    

    console.log("screens attached to this display-worker: \n")
    displays.forEach((d) => {
        console.log(d)
    })
    displayWorker = new DisplayWorker(process.argv)
});

app.on('quit', () =>{
    console.log("closing");
})

app.on('window-all-closed', () => {
    // console.log('all windows closed');
    // This dummy handler is required to keep display-worker running after closing all browserwindow
});


ipcMain.on('view-object-event', (event, arg) => {
  io.publishTopic("display.window.viewobject", arg)
})

ipcMain.on('display-window-event', (event, arg) => {
  io.publishTopic("display.window", arg)
})

class DisplayWorker {
    constructor(){
        console.log("\nDisplay-worker configuration : \n")
        console.log(io.config.get("display"))
        this.config = io.config.get("display")
        
        this.screenName = this.config.screenName
        this.appContext = new Set()
        this.appContext.add("default")
        this.activeAppContext = "default"
        
        this.appWindows = new Map()
        this.appWindows.set(this.activeAppContext, [])
        this.webviewOwnerStack = new Map()

        if(this.config.isPrimaryWorker){
            io.doCall('display-rpc-queue', (request, reply, ack)=>{
                try{
                    let msg = JSON.parse(request.content.toString())
                    console.log(msg)
                    this.process_message(msg, reply)
                }catch(e){
                    reply(JSON.stringify(e))
                }
            })
        }

        this.pointing = new BasicPointing(io)
        console.log("\nworker server started.\n")
    }

    close_app_context (context, next) {
        if(context == "default"){
            next(JSON.stringify( new Error("Cannot close default context")))
            return
        }
        this.appContext.delete(context)
        let b_list  = this.appWindows.get(context)
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
            this.appWindows.delete(context)
            this.activeAppContext = "default"
            next(JSON.stringify({
                "status" : "success",
                "command" : "close-app-context",
                "message" : context + " : context closed. The active app context is set to default context. Please use setAppContext to bring up the default context or specify an existing or new app context."
            })) 
            io.publishTopic("display", JSON.stringify({
                type : "appContextClosed",
                details : {
                    appContext : context,
                    newAppContext : this.activeAppContext
                }
            }))
        }else{
            next(JSON.stringify({
                "status" : "warning",
                "command" : "close-app-context",
                "message" : context + " : context does not exist"
            }))
        }
    }

    set_app_context(context, next) {
        if( this.activeAppContext != context ){
            let b_list  = this.appWindows.get(this.activeAppContext)
            if(b_list){
                b_list.forEach((element) => {
                    let b = BrowserWindow.fromId(element)
                    if(b) {
                        b.hide()
                    }
                }, this);
            }
        }
        this.activeAppContext = context
        if(this.appWindows.has(this.activeAppContext)){
            let b_list  = this.appWindows.get(this.activeAppContext)
            b_list.forEach((element) => {
                let b = BrowserWindow.fromId(element)
                if(b) b.show()
            }, this)
        }else{
            this.appWindows.set(this.activeAppContext, []);
        }
        io.publishTopic("display", JSON.stringify({
            type : "appContextChanged",
            details : {
                appContext : this.activeAppContext
            }
        }))
        next(JSON.stringify({
            "status" : "success",
            "command" : "set-active-context",
            "message" : this.activeAppContext + " is now active"
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
            webPreferences : {
                nodeIntegration : true
            }
        }
        
        let browser = new BrowserWindow(opts)
        console.log("loading template : ", "file://" + process.env.PWD + "/" + options.template)
        browser.loadURL("file://" + process.env.PWD + "/" + options.template)
        
        browser.on('closed', () =>{
        })
        if(!this.appWindows.has(context)){
            this.appWindows.set(context, [])
        }
        this.appWindows.get( context ).push( browser.id )
        let b_list = this.appWindows.get( context )
        b_id = b_list[b_list.length -1];    

        browser.on('blur', () => {
            browser.webContents.executeJavaScript("clearAllCursors()")
        })

        browser.webContents.on('dom-ready', () => {
            browser.isReady = true
             if(options.contentGrid){
                this.execute_in_displaywindow(Object.assign(options, {
                    window_id: b_id,
                    screenName: this.screenName,
                    appContext: this.activeAppContext,
                    template: options.template,
                    command: "create-grid"
                }), next)
            }else{
                next(JSON.stringify({
                    status : "success",
                    window_id : b_id,
                    screenName : this.screenName,
                    appContext : this.activeAppContext
                }))
            }
            io.publishTopic("display.window", JSON.stringify({
                type : "displayWindowCreated",
                details : {
                    appContext : this.activeAppContext,
                    window_id : b_id,
                    screenName : this.screenName
                }
            }))
        })
       
    }


    create_viewobj( ctx, options, next){
        let view_id = uuid.v1()
        this.webviewOwnerStack.set(view_id, options.window_id)
        
        this.execute_in_displaywindow(Object.assign(options, {
            window_id : options.window_id,
            screenName : options.screenName,
            appContext : ctx,
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
        
        this.appWindows.forEach( (v,k) =>{
            if(v.indexOf(window_id) > -1){
                ctx = k
            }
        })
        return ctx
    }

    process_message ( message, next) {
        // console.log("executing : ", message.content.toString())
        // message = JSON.parse(message.content.toString())
        let ctx = this.activeAppContext
        try{
        switch (message.command){
            case "get-screens" :
                let displays = electron.screen.getAllDisplays()    
            
                let bound = { x : 0, y : 0, right : 0, bottom : 0 }
                displays.forEach( (disp) => {
                    //bounds: { x: 0, y: 0, width: 1920, height: 1200 }
                    let bl = disp.bounds.x
                    let bt = disp.bounds.y
                    let br = disp.bounds.width + bl
                    let bb = disp.bounds.height + bt

                    bound.x = Math.min(bl, bound.x)
                    bound.y = Math.min(bt, bound.y)

                    bound.right = Math.max(br, bound.right)
                    bound.bottom = Math.max(bb, bound.bottom)

                    bound.width = bound.right - bound.x
                    bound.height = bound.bottom - bound.y

                })
                let screens = {
                    "screenName" : this.screenName,
                    "bounds" : bound,
                    "details" : displays
                }

                next(JSON.stringify([screens]))
                break;
            case "get-active-app-context" :
                next(this.activeAppContext)
                break;
            case "set-app-context":
                if(!this.appContext.has(message.options.context)){
                    this.appContext.add(message.options.context)
                }
                console.log(this.appContext)
                this.set_app_context( message.options.context, next)
                break;
            case "hide-app-context":
                let b_list  = this.appWindows.get(message.options.context)
                if(b_list){
                    b_list.forEach((b_id) => {
                        let b = BrowserWindow.fromId(b_id)
                        if(b) b.hide()
                    }, this)
                }
                next(JSON.stringify({
                            "command" : "hide-app-context",
                            "status" : "success"
                        }))
                break;
            case "close-app-context":
                this.close_app_context(message.options.context, next)
                break;
            case "get-all-contexts":
                console.log(this.appContext)
                next(JSON.stringify(Array.from(this.appContext)))
                break;
            case "get-all-windows-by-context":
                let wins = this.appWindows.get(options.context)
                next(JSON.stringify(wins))
                break;
            case "create-window":
                if(message.options.appContext){
                    ctx = message.options.context
                }
                this.create_window(ctx, message.options, next)
                break;
            case "close-all-windows":
                for( let ctx of this.appContext){
                    let b_list  = this.appWindows.get(ctx)
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
                this.appContext.clear()
                this.appContext.add("default")
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
                        if(this.appWindows.has(w_ctx)){
                            let win_arr = this.appWindows.get( w_ctx   )
                            win_arr.splice( win_arr.indexOf(message.options.window_id) , 1)
                            this.appWindows.set(w_ctx, win_arr)
                        }
                        b.close()
                        next(JSON.stringify({
                                "command" : "close-window",
                                "status" : "success",
                                "window_id" : message.options.window_id
                            }))

                        io.publishTopic("display.window", JSON.stringify({
                            type : "displayWindowClosed",
                            details : {
                                appContext : w_ctx,
                                window_id : message.options.window_id,
                                screenName : this.screenName
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
                if(message.options.appContext){
                    ctx = message.options.context
                }
                this.create_viewobj(ctx, message.options, next)
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

