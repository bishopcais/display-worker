let previousValue = new Map()
let lastTransform = new Map()

function execute(opts){
    let options = JSON.parse(opts);
    try{
        if(options.command == "open"){
            let wv = document.createElement("webview")
            wv.id = options.view_id;
            wv.style.width = options.width;
            wv.style.height = options.height;
            wv.style.position = "absolute";
            wv.style.top = options.top;
            wv.style.left = options.left;
            wv.src = options.url;
            document.getElementById("content").appendChild(wv);
            return { "view_id" : wv.id, command : "create" , "status" : "success", 
            "window_id" : options.window_id,"screenName" : options.screenName } 
        }else if(options.command == "reload") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                wv.reload()
                return {"view_id" : wv.id,  command : "reload" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "reload" ,"error" : "view not found" }
            }
            
        }else if(options.command == "hide") {
            let wv = document.getElementById(options.view_id)
            
            if(wv){
                let c = {
                    width : wv.style.width, height : wv.style.height
                }
                previousValue.set(options.view_id , c)
                wv.className = 'hide'
                wv.style.width = '0px'
                wv.style.height = '0px'
                return {"view_id" : wv.id,  command : "hide" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "hide" ,"error" : "view not found" }
            }

        }else if(options.command == "show") {
            let wv = document.getElementById(options.view_id)
            
            if(wv){
                let c = previousValue.get(options.view_id)
                wv.style.width = c.width
                wv.style.height = c.height
                wv.className = ''
                return {"view_id" : wv.id,  command : "show" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "show" ,"error" : "view not found" }
            }
        }else if(options.command == "close") {
            let wv = document.getElementById(options.view_id)
            
            if(wv){
                document.getElementById('content').removeChild(wv);
                return {"view_id" : wv.id,  command : "close" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "close" ,"error" : "view not found" }
            }
        }else if(options.command == "set-bounds") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                let c = {top :0, left:0}
                if(lastTransform.has(wv.id)){
                    c = lastTransform.get(wv.id)
                }

                let currentValue = {
                    width : getComputedStyle(wv).width,
                    height : getComputedStyle(wv).height,
                    transform :'translate(' + c.left + 'px,' + c.top  + 'px)'
                }

                let ty = (parseInt(options.top) -  parseInt(getComputedStyle(wv).top))
                let tx = (parseInt(options.left) -  parseInt(getComputedStyle(wv).left))
                lastTransform.set(wv.id, { top : ty, left : tx })  
                let destValue = {
                    width : options.width ? options.width : currentValue.width,
                    height : options.height ? options.height :  currentValue.height,
                    transform : 'translate(' + tx  + 'px,' + ty + 'px)'
                }
                console.log(currentValue, destValue)

                wv.animate( [currentValue, destValue], options.animation_options? options.animation_options : {
                    duration : 1000, fill: 'forwards', easing: 'ease-in-out'
                })
                // wv.style.top = options.top ? options.top : currentValue.top 
                // wv.style.left = options.left ? options.left : currentValue.left
                // wv.style.width = options.width ? options.width : currentValue.width
                // wv.style.height = options.height ? options.height : currentValue.height
                return {"view_id" : wv.id,  command : "set-bounds" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "set-bounds" ,"error" : "view not found" }
            }

        }else if(options.command == "back") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                wv.goBack()
                return {"view_id" : wv.id,  command : "reload" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "reload" ,"error" : "view not found" }
            }
         }else if(options.command == "forward") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                wv.canGoForward()
                return {"view_id" : wv.id,  command : "reload" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "reload" ,"error" : "view not found" }
            }
        }else{
            return {"view_id" : options.view_id,  command : options.command ,"status" : "command not defined" }
        }
    }catch(e){
        console.log(e);
        return {"view_id" : options.view_id,  command : options.command ,"error" : e }
    }
}