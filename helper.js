let previousValue = new Map()
let lastTransform = new Map()
let uniformGridCellSize = {}
let dragTimer = new Map()
let grid = {}
let gridSize={}

const {ipcRenderer} = nodeRequire('electron')

function getClosestGrid(x,y){
	let min_dist=Number.MAX_VALUE
	let temp_row_=1,temp_col=1;
    for(let i=1;i<=gridSize.row;i++){
		for(let j=1;j<=gridSize.col;j++){
			let diff_x=grid[i+"|"+j].rx-x
			let diff_y=grid[i+"|"+j].ry-y
			let cur_dist=Math.pow(diff_x,2) + Math.pow(diff_y,2) //no need to do sqrt to save time
			if(cur_dist<min_dist){
				min_dist=cur_dist
				temp_row=i;
				temp_col=j;
			}
		}
	}
	//console.log("min_dist="+min_dist);
	let closest={left:grid[temp_row+"|"+temp_col].rx,top:grid[temp_row+"|"+temp_col].ry,sq_dist:min_dist};
	return closest;

}
function rectangleSelect(selector, x1, y1, x2, y2) {
    var elements = [];
    jQuery(selector).each(function() {
        var $this = jQuery(this);
        var offset = $this.offset();
        var x = offset.left;
        var y = offset.top;
        var w = $this.width();
        var h = $this.height();

        if (x >= x1
            && y >= y1
            && x + w <= x2
            && y + h <= y2) {
            // this element fits inside the selection rectangle
            elements.push($this.get(0));
        }
    });
    return elements;
}
function test(x1, y1, x2, y2){
    // Simple test
    // Mark all li elements red if they are children of ul#list
    // and if they fall inside the rectangle with coordinates:
    // x1=0, y1=0, x2=200, y2=200
    var elements = rectangleSelect("webview", x1, y1, x2, y2);
    var itm = elements.length;
    while(itm--) {
        //elements[itm].style.color = 'red';
        console.log(elements[itm]);
    }
}

function createGrid(row, col, rowHeight, colWidth, padding){
    gridSize.row = row
    gridSize.col = col
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
	uniformGridCellSize.padding = padding
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
            toPixels(options.bounds)
            addToGrid(options.label, options.bounds, options.style)
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
			console.log("options.fontSize="+options.fontSize)
            document.body.style.fontSize = options.fontSize
            return { command : "set-displaywindow-font-size" ,"status" : "success" }
        }else if(options.command == "create-viewobj"){

            if(options.slide && options.position){
                slideContents(options)
            }


            if(options.position){
                let pos = options.position
                if( typeof pos == "object" ){
                    if(pos["grid-top"] && pos["grid-left"] ){
                        pos = pos["grid-top"] + "|" + pos["grid-left"];
                    }
                }
                let box = grid[pos];
                console.log("box="+JSON.stringify(box));
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
            wv.style.zIndex = 0
            wv.src = options.url
            

            // wv.addEventListener("dragHintStart", (e)=>{
            //     console.log("drag hint start")
            // })

            // wv.addEventListener("dragHintEnd", (e)=>{
            //     console.log("drag hint end")
            // })
            wv.addEventListener("did-finish-load",(e)=>{
                let se = " var elems = document.querySelectorAll('*'); var draggable = []; for(var i=0;i<elems.length;i++){ elems[i].draggable=false };console.log('disabled draggables')" 
                wv.executeJavaScript(se)
            })

            wv.addEventListener("mouseover", (e) => {
                // console.log("mouse in", $(wv).offset(), $(wv).width(), $(wv).height(), $(document.body).width(), $(document.body).height())
                let se = " var elems = document.querySelectorAll('*'); var draggable = []; for(var i=0;i<elems.length;i++){ elems[i].draggable=false };console.log('disabled draggables')" 
                wv.executeJavaScript(se)
                let closest;



                if(!wv.canDrag){
                    wv.canDrag = true
                    wv.dispatchEvent(new Event("dragHintStart"))


                    $(wv).draggable({
                        disabled : false,
                        scroll: false,
                        refreshPositions: true,
                        start: (e, ui) => {
                            console.log(e.eventSource)
                            wv.dragSource = e.eventSource
                            let zIndex = 0
                            let elems = document.getElementsByTagName("webview")
                            for(let i =0;i < elems.length; i++){
                                let zi = parseInt(getComputedStyle(elems[i], "").zIndex)
                                console.log(zi)
                                zIndex = zi > zIndex ?  zi : zIndex 
                            }
                            
                            if(wv.style.zIndex <= zIndex){
                                wv.style.zIndex = zIndex + 1
                                console.log(zIndex)
                            }
                        },
                        drag: (e, ui) => {
                            if(e.eventSource != wv.eventSource)
                                return false

                            wv.isDragging = true
                            let pointingDiv = document.getElementById(wv.id + "-draghint")
                            if(pointingDiv){
                                pointingDiv.style.left = Math.round($(wv).offset().left + $(wv).width()/2 -$(pointingDiv).width()/2) + "px"
                                pointingDiv.style.top = Math.round($(wv).offset().top + $(wv).height()/2 - $(pointingDiv).height()/2) + "px"
                            }
                            //shang
                        	closest=getClosestGrid($(wv).offset().left,$(wv).offset().top);
                        },
                        stop: (e, ui) => {
                            if(e.eventSource != wv.eventSource)
                                return false
                            $(wv).draggable( {disabled : true})
                            wv.isDragging = false
                            pointingDiv.style.left = Math.round($(wv).offset().left + $(wv).width()/2 -$(pointingDiv).width()/2) + "px"
                            pointingDiv.style.top = Math.round($(wv).offset().top + $(wv).height()/2 - $(pointingDiv).height()/2) + "px"
                            pointingDiv.style.display = "none"
                            wv.dispatchEvent(new Event("dragHintEnd"))
                            ipcRenderer.send('view-object-event', JSON.stringify({
                                type : "boundsChanged",
                                details : {
                                    top : $(wv).offset().top,
                                    left : $(wv).offset().left,
                                    width : $(wv).width(),
                                    height : $(wv).height(),
                                    units : "px",
                                    view_id : wv.id
                                }
                            }))
							//shang
							let ems = parseFloat(getComputedStyle(document.body, "").fontSize);
							if(Math.sqrt(closest.sq_dist)<ems/6){
								let destBounds =  {
									"left" : closest.left +uniformGridCellSize.padding+ "px",
									"top" :  closest.top +uniformGridCellSize.padding+ "px",
									"animation_options" : {
										duration : 500,
										fill : 'forwards',
										easing : 'linear'
										}
								}
								setBounds(wv, destBounds);
							}

                        }
                    })

                    let pointingDiv = document.getElementById(wv.id + "-draghint")

                    if(pointingDiv == undefined){
                        pointingDiv = document.createElement("img")
                        pointingDiv.src = "drag.svg"
                        pointingDiv.className = "dragcursor"
                        pointingDiv.id = wv.id + "-draghint"
                        document.getElementById("pointing").appendChild(pointingDiv)
                    }

                    pointingDiv.style.left = Math.round($(wv).offset().left + $(wv).width()/2 -$(pointingDiv).width()/2) + "px"
                    pointingDiv.style.top = Math.round($(wv).offset().top + $(wv).height()/2 - $(pointingDiv).height()/2) + "px"
                    pointingDiv.style.display = "block"

                    dragTimer.set( wv.id, setTimeout(()=>{
                        console.log("drag timeout");
                        dragTimer.delete(wv.id)
                        if(!wv.isDragging){
                            document.getElementById(wv.id + "-draghint").style.display = "none"
                            $(wv).draggable({disabled : true});
                            wv.dispatchEvent(new Event("dragHintEnd"))
                        }
                    }, 1500) )
                }

            })
            wv.addEventListener("mouseout", (e) => {
                console.log("mouse out")
                clearTimeout(dragTimer.get(wv.id))
                dragTimer.delete(wv.id)
                wv.canDrag = false
                $(wv).draggable({disabled : false});
                document.getElementById(wv.id + "-draghint").style.display = "none"
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

			console.log("before options.slide wv="+JSON.stringify($('webview').offset()))
			console.log("before options.slide options="+JSON.stringify(options))


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
                let animate = setBounds(wv, options)
                if(animate){
                    animate.onFinish(() => {
                        ipcRenderer.send('view-object-event', JSON.stringify({
                            type : "boundsChanged",
                            details :  {
                                view_id : wv.id,
                                top : $(wv).offset().top,
                                left : $(wv).offset().left,
                                width : $(wv).width(),
                                height : $(wv).height(),
                                units : "px"
                            }
                        }))
                    })
                }

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
                wv.goForward()
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

/*

   destBounds =  {
        "left" : "100px",
        "top" : "100px",
        "height" : "300px",
        "width" : "400px",
        "animation_options" : {
            duration : 1000,
            fill : 'forwards',
            easing : 'linear'
         }
      }
*/

function setBounds(wv , destBounds) {

    if(destBounds.zIndex){
        wv.style.zIndex = destBounds.zIndex
    }else if(destBounds.bringToFront){
        let zIndex = 0
        let elems = document.getElementsByTagName("webview")
        for(let i =0;i < elems.length; i++){
            let zi = getComputedStyle(elems[i], "").zIndex
            zIndex = zi > zIndex ?  zi : zIndex 
        }
        wv.style.zIndex = zIndex + 1
    }else if(destBounds.sendToBack){
        let zIndex = 10000
        let elems = document.getElementsByTagName("webview")
        for(let i =0;i < elems.length; i++){
            let zi = getComputedStyle(elems[i], "").zIndex
            zIndex = zi < zIndex ?  zi : zIndex 
        }
        wv.style.zIndex = zIndex - 1
    }

    toPixels(destBounds)
    let currentValue = {}
    let destValue = {}

    if(destBounds.left && destBounds.top){
        currentValue.transform = ""
        destValue.transform = ""
        let c = {top : 0, left: 0}
        let d = {}

        if(lastTransform.has(wv.id)){
            c = lastTransform.get(wv.id)
        }

        d.left = parseInt(destBounds.left) - parseInt(getComputedStyle(wv).left)
        d.top = parseInt(destBounds.top) -  parseInt(getComputedStyle(wv).top)

        currentValue.transform = 'translate(' + c.left + 'px,' + c.top  + 'px)'
        destValue.transform = 'translate(' + d.left  + 'px,' + d.top + 'px)'
        lastTransform.set(wv.id, d)

    }

    if(destBounds.width){
        currentValue.width = getComputedStyle(wv).width
        destValue.width = destBounds.width
    }

    if(destBounds.height){
        currentValue.height = getComputedStyle(wv).height
        destValue.height = destBounds.height
    }

    if(destBounds.opacity){

        currentValue.opacity = getComputedStyle(wv).opacity
        destValue.opacity = destBounds.opacity
    }


    if(Object.keys(currentValue).length === 0){
        return false
    }else{
        return wv.animate( [currentValue, destValue], destBounds.animation_options? destBounds.animation_options : {
            duration : 800, fill: 'forwards', easing: 'ease-in-out'
        })
    }
}


function slideContents(options){

    //  Shang's code

    var max_row_index=gridSize.row;
    var max_col_index=gridSize.col;
    var cur_row_index=options['position']['grid-top']
    var cur_col_index=options['position']['grid-left']
    var x1,x2;
    var y1,y2;

    if(options.slide.cascade){

        if(options.slide.direction=="down"){
            //console.log("down")
            for(let i=(max_row_index-1);i>=cur_row_index;i--){
                x1=grid[i+"|"+cur_col_index].rx;
                y1=grid[i+"|"+cur_col_index].ry;
                x2=grid[i+"|"+cur_col_index].rx+grid[i+"|"+cur_col_index].rw;
                y2=grid[i+"|"+cur_col_index].ry+grid[i+"|"+cur_col_index].rh;
                let eles = rectangleSelect("webview", x1, y1, x2, y2);
                //console.log("eles.length="+eles.length);
                if(eles.length > 0){
                    let next_grid_index=(i+1)+"|"+cur_col_index;
                    let destBounds =  {
                        "left" : grid[next_grid_index].x + "px",
                        "top" : grid[next_grid_index].y + "px",
                        "animation_options" : {
                            duration : 800,
                            fill : 'forwards',
                            easing : 'linear'
                            }
                    }
                    //console.log("destBounds "+destBounds.left+" "+destBounds.top);
                    let index=0

                    while (index < eles.length){
                        setBounds(eles[index], destBounds)
                        index++
                    }
                }
            }
        }else if(options.slide.direction=="right"){
            //console.log("right")

            for(let i=(max_col_index-1);i>= cur_col_index;i--){
                x1=grid[cur_row_index+"|"+i].rx;
                y1=grid[cur_row_index+"|"+i].ry;
                x2=grid[cur_row_index+"|"+i].rx+grid[cur_row_index+"|"+i].rw;
                y2=grid[cur_row_index+"|"+i].ry+grid[cur_row_index+"|"+i].rh;
                let eles = rectangleSelect("webview", x1, y1, x2, y2);
                //console.log("eles.length="+eles.length);
                if(eles.length>0){
                    let next_grid_index=cur_row_index+"|"+(i+1);
                    let destBounds =  {
                        "left" : grid[next_grid_index].x + "px",
                        "top" : grid[next_grid_index].y + "px",
                        "animation_options" : {
                            duration : 800,
                            fill : 'forwards',
                            easing : 'linear'
                            }
                    }
                    //console.log("destBounds "+destBounds.left+" "+destBounds.top);
                    let index=0

                    while (index < eles.length){
                        setBounds(eles[index], destBounds)
                        index++
                    }
                }
            }
        }else if(options.slide.direction=="left"){

            //console.log("left")

            for(let i=2;i<=cur_col_index;i++){
                x1=grid[cur_row_index+"|"+i].rx;
                y1=grid[cur_row_index+"|"+i].ry;
                x2=grid[cur_row_index+"|"+i].rx+grid[cur_row_index+"|"+i].rw;
                y2=grid[cur_row_index+"|"+i].ry+grid[cur_row_index+"|"+i].rh;
                let eles = rectangleSelect("webview", x1, y1, x2, y2);
                //console.log("eles.length="+eles.length);
                if(eles.length>0){
                    let next_grid_index=cur_row_index+"|"+(i-1);
                    let destBounds =  {
                        "left" : grid[next_grid_index].x + "px",
                        "top" : grid[next_grid_index].y + "px",
                        "animation_options" : {
                            duration : 800,
                            fill : 'forwards',
                            easing : 'linear'
                            }
                    }
                    //console.log("destBounds "+destBounds.left+" "+destBounds.top);
                    let index=0

                    while (index < eles.length){
                        setBounds(eles[index], destBounds)
                        index++
                    }
                }
            }

        }else{//up

            for(let i=2;i<=cur_row_index;i++){
                x1=grid[i+"|"+cur_col_index].rx;
                y1=grid[i+"|"+cur_col_index].ry;
                x2=grid[i+"|"+cur_col_index].rx+grid[i+"|"+cur_col_index].rw;
                y2=grid[i+"|"+cur_col_index].ry+grid[i+"|"+cur_col_index].rh;
                let eles = rectangleSelect("webview", x1, y1, x2, y2);
                //console.log("eles.length="+eles.length);
                if(eles.length>0){
                    let next_grid_index=(i-1)+"|"+cur_col_index;
                    let destBounds =  {
                        "left" : grid[next_grid_index].x + "px",
                        "top" : grid[next_grid_index].y + "px",
                        "animation_options" : {
                            duration : 800,
                            fill : 'forwards',
                            easing : 'linear'
                            }
                    }
                    //console.log("destBounds "+destBounds.left+" "+destBounds.top);
                    let index=0

                    while (index < eles.length){
                        setBounds(eles[index], destBounds)
                        index++
                    }
                }
            }
        }
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
            if(!options.position){
                if( options.top && options.top.indexOf("em") > -1 ){
                    options.top =  Math.round(ems * parseFloat(options.top))
                }

                if( options.left && options.left.indexOf("em") > -1 ) {
                    options.left =  Math.round(ems * parseFloat(options.left))
                }
            }

            if( options.width && typeof(options.width) == "string"){
                if(  options.width.indexOf("em") > -1 ) {
                    options.width =  Math.round(ems * parseFloat(options.width)) + 'px'
                }else if( options.width.indexOf("%") > -1 ) {
                    options.width = Math.round(parseFloat(options.width) * w/100) + 'px'
                }
            }
             if( options.height && typeof(options.height) == "string"){
                if( options.height.indexOf("em") > -1 ) {
                    options.height =  Math.round(ems * parseFloat(options.height)) + 'px'
                } else if( options.height.indexOf("%") > -1 ) {
                    options.height =  Math.round(h/100 * parseFloat(options.height)) + 'px'
                }
             }
        }
    }catch(e){
        console.log(e)
    }
}