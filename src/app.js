const hapi = require("hapi")
const nes = require ("nes")
const fs = require("fs")
const {app, BrowserWindow, ipcMain} = require("electron")
const uuid = require('node-uuid')
const CELIO = require('celio')
const io = new CELIO()
let displayWorker

app.on('ready', () => {
	// console.log(process.argv)
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
        this.server.register({
            register : nes,
            heartbeat : false,
            options : {
                onDisconnection : this.coordinator_disconnect,
                onMessage : this.process_message
            }
        })

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
                        console.log('hiding');
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
        if(options.new_window || this.appWindows.get(this.activeAppContext).length == 0){
            let opts = {
                x : this.config.layout.x,
                y : this.config.layout.y,
                width : this.config.layout.width,
                height : this.config.layout.height,
                backgroundColor: '#2e2c29',
                frame: false
            }
            // console.log(opts);

            let browser = new BrowserWindow(opts)
            browser.loadURL("file://" + process.env.PWD + "/index.html")
            browser.on('closed', () =>{
            })
            this.appWindows.get(this.activeAppContext).push(browser.id)
            let b_list = this.appWindows.get(this.activeAppContext)
            b_id = b_list[b_list.length -1];    

        }else if(options.window_id){
            let b_list = this.appWindows.get(this.activeAppContext)
            if(b_list.indexOf(options.window_id))
                b_id = options.window_id
            else
                next({
                    status : "window not found in appContext : " + this.activeAppContext ,
                    window_id : b_id,
                    screenName : this.screenName
                })
        }else{
            let b_list = this.appWindows.get(this.activeAppContext)
            b_id = b_list[b_list.length -1];   
        }

        
        if(options.url){
            this.create_view(b_id, options, next)
        }else{
            next({
                status : "success",
                window_id : b_id,
                screenName : this.screenName
            })
        }
    }

    create_view(window_id, options, next){
        let view_id = uuid.v1()
        this.webviewOwnerStack.set(view_id, window_id)

        if(options.position){
            let pos = options.position
            if(pos["grid-top"] && pos["grid-left"] ){
               pos = pos["grid-top"] + ":" + pos["grid-left"];
            }
            let box = this.config.layout.grid[pos];
            if(box){
                options.left = box.x;
                options.top = box.y;
                options.width =  options.width ?  options.width : box.width;
                options.height =  options.height ?  options.height : box.height;
            }
        }
        
        this.execute_in_webview(Object.assign(options, {
            window_id : window_id,
            screenName : this.screenName,
            command: "open",
            view_id : view_id
        }), next)
    }

    execute_in_webview(options, next){
        let b = BrowserWindow.fromId(options.window_id)
        b.webContents.executeJavaScript("execute('"+ JSON.stringify(options)  +"')", true, (d)=>{
            next(d);
        })
    }

    process_message (socket, message, next) {
        // console.log(message)
        let response = {command : message.command}
        let ctx = this.activeAppContext
        try{
        switch (message.command){
            case "get-active-app-context" :
                next(this.activeAppContext);
                break;
            case "set-app-context":
                if(!this.appContext.has(message.options.context)){
                    this.appContext.add(message.options.context)
                }
                this.set_app_context( message.options.context, next)
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
            case "open" :
                if(message.options.appContext){
                    ctx = message.options.context
                }
                this.create_window(ctx, message.options, next)
                break;
            default :
                if(message.options.view_id){
                    message.options.command = message.command
                    message.options.window_id = this.webviewOwnerStack.get(message.options.view_id)
                    this.execute_in_webview(message.options , next);
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

