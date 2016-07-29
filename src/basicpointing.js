
const {BrowserWindow} = require("electron");

class BasicPointing {

    constructor( io ){
        this.hotspot = io.createHotspot(io.display.hotspot);
        this.clickWidth = io.display.hotspot.screen.clickWidth;
        this.clickSpeed = io.display.hotspot.screen.clickSpeed;

        this.ppm = io.display.hotspot.screen.width / io.display.hotspot.width;

        this.sx = io.display.hotspot.screen.x;
        this.sy = io.display.hotspot.screen.y;

        this.downPos = new Map();
        this.absPos = new Map();

        this.hotspot.onPointerMove(msg => {
            // console.log('Move', msg);
            const w = BrowserWindow.getFocusedWindow();

            if (w) {
                const contents = w.webContents;
                if (contents) {
                    const pos = this.getPixelPosition(msg);
                    pos.state = "move";
                    const buttonState = this.downPos.get(pos.name);
                    if(buttonState){
                        pos.state = "down";
                    }

                    let evt = {
                        type : 'mouseMove',
                        x : pos.x,
                        y : pos.y
                    };
                    
                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
                    if(buttonState) {
                        if ((Date.now() - buttonState.downTime) > this.clickSpeed) {
                            contents.sendInputEvent(evt);
                        }
                    } else {
                        contents.sendInputEvent(evt);
                    }
                }
            }
        });
        
        this.hotspot.onPointerDown(msg => {
            // console.log('Down', msg)
            const w = BrowserWindow.getFocusedWindow();

            if (w) {
                const contents = w.webContents;
                if(contents){
                    const pos = this.getPixelPosition(msg);
                    pos.state = "down";
                    pos.downTime = Date.now();
                    this.downPos.set(pos.name, pos);
                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
                    const evt = {
                        type : 'mouseDown',
                        x : pos.x,
                        y : pos.y,
                        clickCount: 1
                    };
    				contents.sendInputEvent(evt);
                }
            }
        });


        this.hotspot.onPointerUp(msg => {
            // console.log('Up', msg)
            const w = BrowserWindow.getFocusedWindow();

            if (w) {
                const contents = w.webContents;
                if(contents){
                    const pos = this.getPixelPosition(msg);
                    pos.state = "up";
                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
                    
                    const evt = {
                        type : 'mouseUp',
                        x : pos.x,
                        y : pos.y
                    };

                    if(this.isClick(pos)){
                        console.log('clicked');
                        const dpos = this.downPos.get(pos.name);
                        evt.x = dpos.x;
                        evt.y = dpos.y;
                        evt.clickCount = 1;
                    } else {
                        console.log('dragged');
                    }
                    this.downPos.delete(pos.name);
                    contents.sendInputEvent(evt);
                }
            }
        });
        
        this.hotspot.onPointerDetach(msg => {
            console.log('Detach', msg);
            const w = BrowserWindow.getFocusedWindow();
            if (w) {
                const contents = w.webContents;
                if(contents){
                    if (this.downPos.has(msg)) {
                        this.downPos.delete(msg);
                    }
                    contents.executeJavaScript("removeCursor('"  +  msg + "')");
                }
            }
            
        });

    }

    getPixelPosition(pointer){
        let x, y, abspos;
        // lighthouse driver
        if (pointer.details.trackpad) {
            abspos = this.absPos.get(pointer.details.name);
            if (pointer.details.trackpad[0] != 0 ||
                pointer.details.trackpad[1] != 0) {
                if (!abspos) {
                    abspos = {x: this.sx + pointer.x  * this.ppm, y: this.sy + pointer.y  * this.ppm};
                    this.absPos.set(pointer.details.name, abspos);
                }

                x = abspos.x + pointer.details.trackpad[0] * 500;
                y = abspos.y - pointer.details.trackpad[1] * 500;
            } else { // trackpad is not touched
                if (abspos) {
                    this.absPos.delete(pointer.details.name);
                }
                x = this.sx + pointer.x  * this.ppm;
                y = this.sy + pointer.y  * this.ppm;
            }
        } else {
            x = this.sx + pointer.x  * this.ppm;
            y = this.sy + pointer.y  * this.ppm;
        }
        
        return { x : Math.round(x),
                 y : Math.round(y),
                 abspos,
                 name : pointer.details.name };
    }

    isClick(pos){
        let downpos = this.downPos.get(pos.name);
        if(downpos){
            return Math.sqrt( Math.pow( downpos.x - pos.x, 2 ) + 
                Math.pow( downpos.y - pos.y, 2 ) ) <= this.clickWidth;
        }else{
            return false;
        }
    }


}

module.exports = BasicPointing;