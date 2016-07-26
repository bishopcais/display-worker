
const {BrowserWindow} = require("electron")

class BasicPointing {

    constructor( io ){
        this.hotspot = io.createHotspot(io.display.hotspot)
        this.clickWidth = io.display.hotspot.screen.clickWidth
        this.clickSpeed = io.display.hotspot.screen.clickSpeed

        this.pw = io.display.hotspot.screen.width / io.display.hotspot.width
        this.ph = io.display.hotspot.screen.height / io.display.hotspot.height

        this.sx = io.display.hotspot.screen.x
        this.sy = io.display.hotspot.screen.y

        this.downPos = new Map()

         // this.hotspot.onPointerEnter(msg => { 
        //     // console.log('Entered', msg) 
        //     let b = BrowserWindow.getFocusedWindow()
        //     if(b && msg.hit){
        //         let pos = this.getPixelPosition(msg)
        //         pos.state = "move"
        //         b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
        //         let evt = {
        //             type : 'mouseEnter',
        //             x : pos.x,
        //             y : pos.y
        //         }
        //         b.webContents.sendInputEvent(evt)
        //     }
        // })

        // this.hotspot.onPointerLeave(msg => { 
        //     // console.log('Left', msg) 
        //     let b = BrowserWindow.getFocusedWindow()
        //     if(b){
        //         let pos = this.getPixelPosition(msg)
        //         b.webContents.executeJavaScript("removeCursor('"  +  JSON.stringify(pos) + "')")
        //         let evt = {
        //             type : 'mouseLeave',
        //             x : pos.x,
        //             y : pos.y
        //         }
        //         b.webContents.sendInputEvent(evt)
        //     }
        // })

        this.hotspot.onPointerMove(msg => { 
            // console.log('Move', msg)
            let b = BrowserWindow.getFocusedWindow()
            if(b && msg.hit){
                let pos = this.getPixelPosition(msg)
                pos.state = "move"
                let buttonState = this.downPos.get(pos.name)
                if(buttonState){
                    pos.state = "down"
                }
                b.webContents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')")
                let evt = {
                    type : 'mouseMove',
                    x : pos.x,
                    y : pos.y
                }
                
                if(buttonState && (Date.now() - buttonState.downTime) > this.clickSpeed){
                    b.webContents.sendInputEvent(evt)
                } else if(b.webContents){
                    b.webContents.sendInputEvent(evt)
                }
            }
        })
        
        this.hotspot.onPointerDown(msg => {
            // console.log('Down', msg)
            let b = BrowserWindow.getFocusedWindow()
            if(b && msg.hit){
                let pos = this.getPixelPosition(msg)
                pos.state = "down"
                pos.downTime = Date.now()
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
            // console.log('Up', msg)
            let b = BrowserWindow.getFocusedWindow()
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
                    console.log('clicked')
                    let dpos = this.downPos.get(pos.name)
                    evt.x = dpos.x
                    evt.y = dpos.y
                }
                this.downPos.delete(pos.name)
                b.webContents.sendInputEvent(evt);
            }
        })
        
        // this.hotspot.onPointerAttach(msg => {
        //     console.log('Attach', msg)        
        // })
        
        this.hotspot.onPointerDetach(msg => {
            console.log('Detach', msg)
            let b = BrowserWindow.getFocusedWindow()
            if(b){
                b.webContents.executeJavaScript("removeCursor('"  +  JSON.stringify(msg) + "')")
            }
        })

    }

    getPixelPosition(pointer){
        return { x : Math.round(this.sx + pointer.x  * this.pw),
                 y : Math.round(this.sy + pointer.y  * this.ph),
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


}

module.exports = BasicPointing