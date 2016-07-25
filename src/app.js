const hapi = require("hapi")
const nes = require ("nes")
const fs = require("fs")
const electron = require('electron')

const {app, BrowserWindow, ipcMain} = require("electron")
const uuid = require('node-uuid')
const CELIO = require('celio')
const io = new CELIO()
let displayWorker
app.setName("CELIO Display Worker")
app.on('ready', () => {
	// console.log(process.argv)
    // setTimeout(()=>{
        let displays = electron.screen.getAllDisplays()    
        displays.forEach((d) => {
            console.log(d)
        })

    // }, 2000)
     
	displayWorker = new DisplayWorker(process.argv)
});

app.on('quit', () =>{
    console.log("closing");
})

app.on('window-all-closed', () => {
    // console.log('all windows closed');
//   app.quit();
});

class DisplayWorker {
    constructor(){
        this.config = io.display
        
        this.screenName = this.config.screenName
        this.appContext = new Set()
        this.appContext.add("default")
        this.activeAppContext = "default"
        
        this.appWindows = new Map()
        this.appWindows.set(this.activeAppContext, [])

        this.webviewOwnerStack = new Map()

        this.server = new hapi.Server();
        this.server.connection( { port : this.config.port })
        this.server.route({
            method : 'GET',
            path : '/ping',
            handler : ( request, reply) => {
                this.process_message(null, request.payload, reply)
            }
        })

        this.server.route({
            method : 'POST',
            path : '/execute',
            handler : ( request, reply) => {
                // reply("alive");
                this.process_message(null, request.payload, reply)
            }
        })

        // this.server.register( {
        //     register : nes,
        //     heartbeat : false,
        //     options : {
        //         onDisconnection : this.coordinator_disconnect,
        //         onMessage : this.process_message
        //     }
        // })

        // this.client = new  nes.Client("ws://" + this.config.displayCoordinator.host + ":" 
        // + this.config.displayCoordinator.port)
        // this.id = ""

        this.server.start ( (e) => {
            if(e) { 
                console.log(e)
                app.quit(); 
            }else {
                console.log("worker server started")
                // this.client.connect({}, (err) => {
                //     if(err) console.log(err)
                //     else this.register();
                // })
            } 
        });

        this.clickWidth = this.config.hotspot.screen.clickWidth
        this.downPos = {}
        this.hotspot = io.createHotspot(this.config.hotspot)
        
        this.hotspot.onPointerEnter(msg => { 
            // console.log('Entered', msg) 
            let b = BrowserWindow.getFocusWindow()
            if(b && msg.hit){
                let pos = this.getPixelPosition(msg)
                pos.state = "move"
                b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
                let evt = {
                    type : 'mouseEnter',
                    x : pos.x,
                    y : pos.y
                }
                b.webContents.sendInputEvent(evt)
            }
        })

        this.hotspot.onPointerLeave(msg => { 
            // console.log('Left', msg) 
            let b = BrowserWindow.getFocusWindow()
            if(b){
                let pos = this.getPixelPosition(msg)
                b.webContents.executeJavaScript("removeCursor('"  +  JSON.stringify(pos) + "')")
                let evt = {
                    type : 'mouseLeave',
                    x : pos.x,
                    y : pos.y
                }
                b.webContents.sendInputEvent(evt)
            }
        })

        this.hotspot.onPointerMove(msg => { 
            // console.log('Move', msg)
            let b = BrowserWindow.getFocusWindow()
            if(b && msg.hit){
                let pos = this.getPixelPosition(msg)
                pos.state = "move"
                b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
                let evt = {
                    type : 'mouseMove',
                    x : pos.x,
                    y : pos.y
                }
                b.webContents.sendInputEvent(evt)
            }
        })
        
        this.hotspot.onPointerDown(msg => {
            console.log('Down', msg)
            let b = BrowserWindow.getFocusWindow()
            if(b && msg.hit){
                let pos = this.getPixelPosition(msg)
                pos.state = "down"
                this.downPos.set(pos.name, pos)
                b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
                let evt = {
                    type : 'mouseDown',
                    x : pos.x,
                    y : pos.y
                }
				b.webContents.sendInputEvent(evt)
            }
        })


        this.hotspot.onPointerUp(msg => {
            console.log('Up', msg)
            let b = BrowserWindow.getFocusWindow()
            if(b){
                let pos = this.getPixelPosition(msg)
                pos.state = "up"
                b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
                
                let evt = {
                    type : 'mouseUp',
                    x : pos.x,
                    y : pos.y
                }

                if(this.isClick(pos)){
                    let dpos = this.downPos.get(pos.name)
                    evt.x = dpos.x
                    evt.y = dpos.y
                }
				b.webContents.sendInputEvent(evt);

            }
        })
        
        this.hotspot.onPointerAttach(msg => {
            console.log('Attach', msg)
            let b = BrowserWindow.getFocusWindow()
            if(b && msg.hit){
                let pos = this.getPixelPosition(msg)
                pos.state = "move"
                b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
                let evt = {
                    type : 'mouseMove',
                    x : pos.x,
                    y : pos.y
                }
                b.webContents.sendInputEvent(evt)
            }
        
        })
        
        this.hotspot.onPointerDetach(msg => {
            console.log('Detach', msg)
            let b = BrowserWindow.getFocusWindow()
            if(b){
                b.webContents.executeJavaScript("removeCursor('"  +  JSON.stringify(msg) + "')")
            }
        })
    }

    getPixelPosition(pointer){
        let pw = this.config.hotspot.screen.width / this.config.hotspot.width
        let ph = this.config.hotspot.screen.height / this.config.hotspot.height

        return { x : this.config.hotspot.screen.x + pointer.x  * pw,
                 y : this.config.hotspot.screen.y + pointer.y  * ph,
                name : pointer.details.name }
    }

    isClick(pos){
        let downpos = this.downPos.get(pos.name)
        if(downpos){
            return Math.sqrt( Math.pow( downpos.x - pos.x, 2 ) + Math.pow( downpos.y - pos.y, 2 ) ) <= this.clickWidth 
        }else{
            return false
        }
    }

/*
    register () {
        console.log("registering ...")
        let msg = {
            command : "register",
            port : this.config.port,
            type : "display-worker"
        }

        this.client.message( msg , (e,d)=> {
            if(e)console.log(e)
            else{
                console.log("registered (%s)", d.id)
                this.id = d.id
            }
        })
    }

    coordinator_disconnect () {

    }
*/
    close_app_context (context, next) {
        if(context == "default"){
            next({
                "error" : "Cannot close default context",
                "command" : "close-app-context"
            })
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
            next({
                "status" : "success",
                "command" : "close-app-context",
                "message" : context + " : context closed. The active app context is set to default context. Please use setAppContext to bring up the default context or specify an existing or new app context."
            }) 
        }else{
            next({
                "status" : "warning",
                "command" : "close-app-context",
                "message" : context + " : context does not exist"
            })
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

        next({
            "status" : "success",
            "command" : "set-active-context",
            "message" : this.activeAppContext + " is now active"
        }) 
    }

    create_window( context , options, next){
        let b_id = 0;
        let opts = {
            x : options.x,
            y : options.y,
            width : options.width,
            height : options.height,
            frame: false,
            enableLargerThanScreen: true
        }
        
        let browser = new BrowserWindow(opts)
        browser.loadURL("file://" + process.env.PWD + "/" + options.template)
        
        browser.on('closed', () =>{
        })
        if(!this.appWindows.has(context)){
            this.appWindows.set(context, [])
        }
        this.appWindows.get( context ).push( browser.id )
        let b_list = this.appWindows.get( context )
        b_id = b_list[b_list.length -1];    

        // }else if(options.window_id){
        //     let b_list = this.appWindows.get(this.activeAppContext)
        //     if(b_list.indexOf(options.window_id))
        //         b_id = options.window_id
        //     else
        //         next({
        //             error : "window (" + b_id + ") not found in appContext : " + this.activeAppContext ,
        //             window_id : b_id,
        //             screenName : this.screenName
        //         })
        // }else{
        //     let b_list = this.appWindows.get(this.activeAppContext)
        //     b_id = b_list[b_list.length -1];   
        // }

        
        // if(options.url){
        //     this.open_view(b_id, options, next)
        // }else{

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
                next({
                    status : "success",
                    window_id : b_id,
                    screenName : this.screenName,
                    appContext : this.activeAppContext
                })
            }
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
            next({ "error" : "window_id not found", "message" : options })
        }else{
            if(b.isReady){
                b.webContents.executeJavaScript("execute('"+ JSON.stringify(options)  +"')", true, (d)=>{
                    if(d.command == "close"){
                        this.webviewOwnerStack.delete( d.view_id )
                    }
                    next(d);
                })
            }else{
                next({ "error" : "dom not ready"})
            }

        }
    }

    process_message (socket, message, next) {
        console.log("executing : ", message.command)
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

                next([screens])
                break;
            case "get-active-app-context" :
                next(this.activeAppContext)
                break;
            case "set-app-context":
                if(!this.appContext.has(message.options.context)){
                    this.appContext.add(message.options.context)
                }
                this.set_app_context( message.options.context, next)
                // this.server.publish('/display/' + message.client_id, )
                io.publishTopic('display.' + message.client_id, JSON.stringify({ type : "app_context", data : "context changed to " + message.options.context}) )
                break;
            case "close-app-context":
                this.close_app_context(message.options.context, next)
                break;
            case "create-window":
                if(message.options.appContext){
                    ctx = message.options.context
                }
                this.create_window(ctx, message.options, next)
                break;
            case "hide-window":
                if(message.options.window_id){
                    let b = BrowserWindow.fromId(message.options.window_id);
                    if(b){
                        b.hide()
                        next({
                            "command" : "hide-window",
                            "status" : "success"
                        })
                    }else{
                        next({
                            "error" : "window_id not present"
                        })
                    }
                }else{
                    next({
                        "error" : "parameter window_id not present"
                    })
                }
                    
                break;
            case "show-window":
                 if(message.options.window_id){
                    let b = BrowserWindow.fromId(message.options.window_id);
                    if(b){
                        b.show()
                        next({
                            "command" : "show-window",
                            "status" : "success"
                        })
                    }else{
                        next({
                            "error" : "window_id not present"
                        })
                    }
                }else{
                    next({
                        "error" : "parameter window_id not present"
                    })
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

                        let win_arr = this.appWindows.get(this.activeAppContext)
                        win_arr.splice( win_arr.indexOf(message.options.window_id) , 1)
                        this.appWindows.set(this.activeAppContext, win_arr)
                        b.close()
                        next({
                                "command" : "close-window",
                                "status" : "success",
                                "viewObjects" : wv_id
                            })
                    }else{
                        next({
                            "error" : "window_id not present"
                        })
                    } 
                 }else{
                     next({
                        "error" : "parameter window_id not present"
                    })
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
                next({"status" : "success", "devTools" : message.options.devTools} )
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
                    if(this.webviewOwnerStack.has(message.options.view_id) ){
                        message.options.window_id = this.webviewOwnerStack.get(message.options.view_id)
                        this.execute_in_displaywindow(message.options , next)
                    }else{
                        next({
                            "error" : "View Obj not found.",
                            "message" : message.options.view_id + " - view object is not found."
                        })    
                    }
                }else if(message.options.window_id){
                     message.options.command = message.command
                    this.execute_in_displaywindow(message.options , next)
                }else{
                    next({
                        "error" : "Command not defined."
                    })
                }
        }
        }catch(e){
            console.log(e)
            next(e)
        }
    }
}

