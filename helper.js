let previousValue = new Map()
let lastTransform = new Map()
let uniformGridCellSize = {}

let dragTimer = new Map()

let grid = {}
const {ipcRenderer} = nodeRequire('electron')
function createGrid(row, col, rowHeight, colWidth, padding){

    let w = parseInt(getComputedStyle(document.body, '').width) 
    let h = parseInt(getComputedStyle(document.body, '').height)
    
    if(!padding)
        padding = 0

    if(!rowHeight){
        rowHeight = []
        for(let x = 0 ; x < row; x++ ){
            rowHeight[x] = Math.ceil(h / row)
        }
    }else{
        for(let x = 0 ; x < row; x++ ){
            rowHeight[x] = Math.ceil(rowHeight[x] *  h)
        }
    }


    if(!colWidth){
        colWidth = []
        for(let y = 0; y < col; y++){
            colWidth[y] = Math.ceil(w / col)
        }
    }else{
        for(let y = 0; y < col; y++){
            colWidth[y] = Math.ceil( colWidth[y] * w )
        }
    }

    uniformGridCellSize.width = 0
    for(let x = 0; x < colWidth.length; x++){
        uniformGridCellSize.width += colWidth[x]
    }

    uniformGridCellSize.width /= colWidth.length

    uniformGridCellSize.height = 0
    for(let x = 0; x < rowHeight.length; x++){
        uniformGridCellSize.height += rowHeight[x]
    }
    uniformGridCellSize.height /= rowHeight.length

    let rr = 0;
    for(let r = 1 ; r <= row; r++ ){
        let cc = 0;
        for(let c = 1; c <= col; c++){
            let key = r + '|' + c
            
            grid[key] = {
                x : cc + padding,
                y : rr + padding,
                width :	colWidth[c-1] - 2 * padding,
                height : rowHeight[r-1] - 2 * padding,
                rx : cc,
                ry : rr,
                rw : colWidth[c-1],
                rh :  rowHeight[r-1]  
            }
            cc += colWidth[c-1]
        }
        rr += rowHeight[r-1]
    }

    grid["center"] = {
        x : Math.round(w/4),
        y : Math.round(h/4), 
        width : Math.round(w/2),
        height : Math.round(h/2)
    }

     grid["fullscreen"] = {
        x : 0,
        y : 0, 
        width : w,
        height : h
    }
}

function getGrid(row, col){
    if( row && col)
        return grid[row + ':' + col]
    else
        return grid
}

function addToGrid(label, bounds, style){
    if(!grid[label]){
        grid[label] = bounds
        if(style){
            let div = document.createElement('div')
            div.id = "bg" + label
            div.className = "background-div"
            div.style.top = bounds.top + "px"
            div.style.left = bounds.left + "px"
            div.style.width = bounds.width
            div.style.height = bounds.height
            for(let k of Object.keys(style)){
                div.style[k] = style[k]
            }
            document.getElementById("background").appendChild(div)
        }
        return { status : 'success' }
    }else{
        return { status : 'failed' , message : 'Label :  ' + label + ' exists.' }
    }
}

function execute(opts){
    let options = JSON.parse(opts)
    console.log('Executed command : ', options.command, options)
    try{
        if(options.command == "create-grid"){
            let cont_grid = options.contentGrid
            grid = {}
            if(cont_grid.row && cont_grid.col){
                createGrid(cont_grid.row, cont_grid.col, cont_grid.rowHeight, cont_grid.colWidth, cont_grid.padding)
            }

            if(cont_grid.custom){
                for( let x = 0; x < cont_grid.length; x++){
                    let g = cont_grid.custom[x]
                    g = toPixels(g)
                    addToGrid ( g.label, { x: g.left, y: g.top, width : g.width, height: g.height  })
                }
            }

            if(options.gridBackground){
                document.getElementById('background').innerHTML = ""
                for(let key of Object.keys(options.gridBackground)){
                   
                    let g = grid[key]
                    let div = document.createElement('div')
                    div.id = "bg" + key
                    div.className = "background-div"
                    div.style.top = g.ry + "px"
                    div.style.left = g.rx + "px"
                    div.style.width = g.rw
                    div.style.height = g.rh
                    div.style.background = options.gridBackground[key]
                    document.getElementById("background").appendChild(div)
                }
            }

            return {
                window_id : options.window_id,
                screenName : options.screenName,
                appContext : options.appContext,
                template : options.template
            }
        }else  if(options.command == "get-grid"){
            return grid
        }else  if(options.command == "uniform-grid-cell-size"){
            return uniformGridCellSize
        }else  if(options.command == "add-to-grid"){
            let bounds = toPixels(options.bounds)
            addToGrid(options.label, bounds, options.style)
            return grid
        }else if(options.command == "cell-style"){
            let g = document.getElementById("bg" + options.label)
            if(g){
                let currentValue = {}
                let destValue = {}

                for(let k of Object.keys(options.style)){
                    currentValue[k] = getComputedStyle(g,"")[k]
                    destValue[k] = options.style[k]
                }
                g.animate( [currentValue, destValue], options.animation_options? options.animation_options : {
                    duration : 800, fill: 'forwards', easing: 'ease-in-out'
                })

                return { "status" : "success" } 
            }else{
                return { "error" : "cell not found" } 
            }

        }else if(options.command == "set-displaywindow-font-size") {
            document.body.style.fontSize = options.fontSize 
            return { command : "set-displaywindow-font-size" ,"status" : "success" }
        }else if(options.command == "create-viewobj"){
            if(options.position){
                let pos = options.position
                if(pos["grid-top"] && pos["grid-left"] ){
                    pos = pos["grid-top"] + "|" + pos["grid-left"];
                }
                let box = grid[pos];
                if(box){
                    options.left = box.x;
                    options.top = box.y;
                    options.width =  options.width ?  options.width : box.width;
                    options.height =  options.height ?  options.height : box.height;
                }
            }
            let wv = document.createElement("webview")
            wv.id = options.view_id
            wv.className="ui-widget-content"
            
            toPixels(options)
            wv.style.width = options.width
            wv.style.height = options.height
            wv.style.position = "absolute"
            wv.style.top = options.top
            wv.style.left = options.left
            wv.style.background = "white"
            wv.src = options.url

            // wv.addEventListener("dragHintStart", (e)=>{
            //     console.log("drag hint start")
            // })

            // wv.addEventListener("dragHintEnd", (e)=>{
            //     console.log("drag hint end")
            // })


            wv.addEventListener("mouseover", (e) => {
                console.log("mouse in", $(wv).offset(), $(wv).width(), $(wv).height())
                if(!wv.canDrag){
                    wv.canDrag = true
                    wv.dispatchEvent(new Event("dragHintStart"))
                    wv.insertCSS("body{pointer-events:none;}")
                    let pointingDiv = document.getElementById(wv.id + "-draghint") 
                    if(pointingDiv == undefined){
                        let pointingDiv = document.createElement("img")
                        pointingDiv.src = "drag.svg"
                        pointingDiv.id = wv.id + "-draghint"
                        pointingDiv.style.position = "absolute"
                        pointingDiv.style.top = $(wv).offset().top + ($(wv).width()/2) - Math.round( $(document.body).width()* 0.1) + "px"
                        pointingDiv.style.left = $(wv).offset().left + ($(wv).height()/2) -  Math.round( $(document.body).height()* 0.1) + "px"
                        pointingDiv.style.width =  Math.round( $(document.body).width() * 0.1)+ "px"
                        pointingDiv.style.height = Math.round( $(document.body).height() * 0.1) + "px"
                        document.getElementById("pointing").appendChild(pointingDiv)
                    }else{
                        pointingDiv.style.top = $(wv).offset().top + ($(wv).width()/2) - Math.round( $(document.body).width()* 0.1) + "px"
                        pointingDiv.style.left = $(wv).offset().left + ($(wv).height()/2) -  Math.round( $(document.body).height()* 0.1) + "px"
                        pointingDiv.style.width =  Math.round( $(document.body).width() * 0.1)+ "px"
                        pointingDiv.style.height = Math.round( $(document.body).height() * 0.1) + "px"
                    }
                    wv.addEventListener("mousedown", wvMouseDownHandler)
                    wv.addEventListener("mouseup", wvMouseUpHandler)
                    dragTimer.set( wv.id, setTimeout(()=>{
                        
                        dragTimer.delete(wv.id)
                        //  document.getElementById("pointing").removeChild(document.getElementById(wv.id + "-draghint"))
                        $("#"+wv.id + "-draghint").fadeOut(300, ()=>{
                            $("#"+wv.id + "-draghint").remove()
                        })
                        wv.insertCSS("body{pointer-events:all;}")
                        wv.removeEventListener("mousedown", wvMouseDownHandler)
                        wv.removeEventListener("mouseup", wvMouseUpHandler)
                        wv.dispatchEvent(new Event("dragHintEnd"))
                    }, 1500) )
                }
                
            })
            wv.addEventListener("mouseout", (e) => {
                console.log("mouse out")
                clearTimeout(dragTimer.get(wv.id))
                dragTimer.delete(wv.id)
                wv.canDrag = false
                $("#"+wv.id + "-draghint").fadeOut(300, ()=>{
                    $("#"+wv.id + "-draghint").remove()
                    wv.insertCSS("body{pointer-events:all;}")
                    wv.removeEventListener("mousedown", wvMouseDownHandler)
                    wv.removeEventListener("mouseup", wvMouseUpHandler)
                })
            })

            

            
            
            if(options.nodeIntegration)
                wv.nodeintegration = true
            else
                wv.nodeintegration = false
            
            if(options.cssText){
                wv.cssText = options.cssText
                wv.addEventListener('did-finish-load', (evt) => { 
                    wv.insertCSS(wv.cssText )
                })

                wv.addEventListener('dom-ready', (evt) => { 
                    wv.insertCSS(wv.cssText)
                })
            }

            document.getElementById("content").appendChild(wv)
            // $( "#content webview" ).draggable({ stack: "#content webview" });

            ipcRenderer.send('display-window-event', JSON.stringify({
                    type : "viewobjectCreated",
                    details :  options
                }))

            return { "view_id" : wv.id, command : "create" , "status" : "success", 
            "window_id" : options.window_id,"screenName" : options.screenName } 
        }else if(options.command == "set-webview-css-style") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                wv.cssText = options.cssText
                try{
                    wv.insertCSS(options.cssText )
                }catch(e){

                }
                return {"view_id" : wv.id,  command : "set-css-style" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "set-css-style" ,"error" : "view not found" }
            }
          }else if(options.command == "set-url") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                wv.src = options.url
                ipcRenderer.send('view-object-event', JSON.stringify({
                    type : "urlChanged",
                    details :  {
                        view_id : wv.id,
                        url : options.url 
                    }
                }))
                return {"view_id" : wv.id,  command : "set-url" ,"status" : "success" }
                
            }else{
                return {"view_id" : wv.id,  command : "set-url" ,"error" : "view not found" }
            }
            
        }else if(options.command == "reload") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                wv.reload()
                ipcRenderer.send('view-object-event', JSON.stringify({
                    type : "urlReloaded",
                    details :  {
                        view_id : wv.id,
                        url : wv.src 
                    }
                }))
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
                ipcRenderer.send('view-object-event', JSON.stringify({
                    type : "viewobjectHidden",
                    details :  {
                        view_id : wv.id
                    }
                }))
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
                ipcRenderer.send('view-object-event', JSON.stringify({
                    type : "viewobjectShown",
                    details :  {
                        view_id : wv.id
                    }
                }))
                return {"view_id" : wv.id,  command : "show" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "show" ,"error" : "view not found" }
            }
        }else if(options.command == "close") {
            let wv = document.getElementById(options.view_id)
            
            if(wv){
                document.getElementById('content').removeChild(wv)
                ipcRenderer.send('view-object-event', JSON.stringify({
                    type : "viewobjectClosed",
                    details :  {
                        view_id : wv.id
                    }
                }))
                return {"view_id" : wv.id,  command : "close" ,"status" : "success" }
            }else{
                return {"view_id" : wv.id,  command : "close" ,"error" : "view not found" }
            }
        }else if(options.command == "set-bounds") {
            let wv = document.getElementById(options.view_id)
            if(wv){
                // let c = {top : 0, left: 0, scale : 1}
                let c = {top : 0, left: 0} 
                let d = {}
                
                if(lastTransform.has(wv.id)){
                    c = lastTransform.get(wv.id)
                }
                console.log(JSON.stringify(options))
                toPixels(options)
                console.log(JSON.stringify(options))
                let currentValue = {transform : ""}
                let destValue = {transform : ""}

                // if(options.left){
                d.left = parseInt(options.left) - parseInt(getComputedStyle(wv).left)
                // }else{
                    // d.left = c.left
                // }

                // if(options.top ){
                d.top = parseInt(options.top) -  parseInt(getComputedStyle(wv).top)
                // }else{
                    // d.top = c.top
                // }

                // if(options.left || options.top){
                currentValue.transform = 'translate(' + c.left + 'px,' + c.top  + 'px)'
                destValue.transform = 'translate(' + d.left  + 'px,' + d.top + 'px)'
                    
                // }


                if(options.width){
                    currentValue.width = getComputedStyle(wv).width
                    destValue.width = options.width 
                }

                if(options.height){
                    currentValue.height = getComputedStyle(wv).height
                    destValue.height = options.height 
                }

                if(options.zIndex){
                    // currentValue.zIndex = getComputedStyle(wv).zIndex
                    // destValue.zIndex = options.zIndex
                    wv.style.zIndex = options.zIndex
                }

                if(options.opacity){
                    
                    currentValue.opacity = getComputedStyle(wv).opacity
                    destValue.opacity = options.opacity
                }

                // if(options.scale){
                //     d.scale = options.scale
                //     wv.style.transformOrigin = "top left"
                //     currentValue.transform += " scale(" + c.scale + ")"
                //     destValue.transform += " scale(" + d.scale + ")"
                    
                // }else{
                //     d.scale = c.scale
                // }

                lastTransform.set(wv.id, d)  

                console.log(lastTransform)
                console.log(currentValue)
                console.log(destValue)

                wv.animate( [currentValue, destValue], options.animation_options? options.animation_options : {
                    duration : 800, fill: 'forwards', easing: 'ease-in-out'
                })
                
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
        }else if(options.command == 'view-object-dev-tools'){
            let vb = document.getElementById(options.view_id)
            if(vb){
                if(options.devTools)
                    vb.openDevTools()
                else
                    vb.closeDevTools()
            }

            return {"status" : "success" }
        }else{
            return {"view_id" : options.view_id,  command : options.command ,"status" : "command not defined" }
        }
    }catch(e){
        console.log(e)
        return {"view_id" : options.view_id,  command : options.command ,"error" : e }
    }
}


function wvMouseDownHandler(e){
    console.log("mouse down")
    let wv = e.target
    if(wv.canDrag){
        clearTimeout(dragTimer.get(wv.id))
        dragTimer.delete(wv.id)
        let d_top = e.y- $(wv).offset().top
        let d_left = e.x - $(wv).offset().left
        if(lastTransform.has(wv.id)){
            d_top += lastTransform.get(wv.id).top
            d_left +=  lastTransform.get(wv.id).left
        }
        $(wv).draggable({
            disabled : false,
            cursorAt: { top: d_top, left: d_left },
            scroll: false,
            containment: "document.body",
            drag: () => {
                let pointingDiv = document.getElementById(wv.id + "-draghint") 
                if(pointingDiv){
                    pointingDiv.style.top = $(wv).offset().top + ($(wv).width()/2) - Math.round( $(document.body).width()* 0.1) + "px"
                    pointingDiv.style.left = $(wv).offset().left + ($(wv).height()/2) -  Math.round( $(document.body).height()* 0.1) + "px"
                    
                }                        
            },
            stop: () => {
                wv.removeEventListener("mousedown", wvMouseDownHandler)
                wv.removeEventListener("mouseup", wvMouseUpHandler)
                $(wv).draggable( {disabled : true})
                ipcRenderer.send('view-object-event', JSON.stringify({
                    type : "positionChanged",
                    details : {
                        newOffset : $(wv).offset(),
                        width : $(wv).width(),
                        height : $(wv).height(),
                        view_id : wv.id
                    }
                }))
            }
        })
    }
}

function wvMouseUpHandler(e){
    console.log("mouse down")
    let wv = e.target
    if(wv.canDrag){
        $("#"+wv.id + "-draghint").fadeOut(300, ()=>{
            $("#"+wv.id + "-draghint").remove()
            wv.insertCSS("body{pointer-events:all;}")
            wv.removeEventListener("mousedown", wvMouseDownHandler)
            wv.removeEventListener("mouseup", wvMouseUpHandler)
        })
        wv.canDrag = false
    }
}

function toPixels(options){
    let ems = parseFloat(getComputedStyle(document.body, "").fontSize)
    let w = parseInt(getComputedStyle(document.body, '').width) 
    let h = parseInt(getComputedStyle(document.body, '').height)

    try{
        if(typeof(options) == "string"){
            if(options.indexOf("em") > -1){
                options =  Math.round(ems * parseFloat(options))   
            }
        }else if(typeof(options) == "object"){
        
            if( options.top.indexOf("em") > -1 ){
                options.top =  Math.round(ems * parseFloat(options.top))
            }

            if( options.left.indexOf("em") > -1 ) {
                options.left =  Math.round(ems * parseFloat(options.left))
            }

            if( options.width.indexOf("em") > -1 ) {
                options.width =  Math.round(ems * parseFloat(options.width)) + 'px'
            }else if( options.width.indexOf("%") > -1 ) {
                options.width = Math.round(parseFloat(options.width) * w/100) + 'px'
            }

            if( options.height.indexOf("em") > -1 ) {
                options.height =  Math.round(ems * parseFloat(options.height)) + 'px'
            } else if( options.height.indexOf("%") > -1 ) {
                options.height =  Math.round(h/100 * parseFloat(options.height)) + 'px'
            } 
        }
    }catch(e){
        console.log(e)
    }
}