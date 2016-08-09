
const {BrowserWindow} = require("electron");
const RelativePointing = require('./relative-pointing');

class Pointing {

    constructor( io ){
        let hotspot = io.config.get("display:hotspot")
        this.hotspot = io.createHotspot(hotspot);
        this.clickWidth = hotspot.clickWidth;
        this.clickSpeed = hotspot.clickSpeed;

        this.io = io;

        let bounds = io.config.get("display:bounds")
        this.ppm = bounds.width / hotspot.width;
        this.sx = bounds.x;
        this.sy = bounds.y;

        this.downPos = new Map();
        this.absPos = new Map();

        this.relaPointing = new RelativePointing(io);

        this.relaPointing.on('move', pointer => {
            const w = BrowserWindow.getFocusedWindow();

            if (w) {
                const contents = w.webContents;
                if (contents) {
                    const pos = {state: 'move', x: pointer.x, y: pointer.y, name: pointer.details.name};
                    const buttonState = this.downPos.get(pos.name);
                    if(buttonState){
                        pos.state = "down";
                    }

                    const evt = {
                        type : 'mouseMove',
                        x : pos.x,
                        y : pos.y
                    };

                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");

                    this.sendInputEvent(contents, evt, pointer.details.time_captured, true);
                }
            }
        });

        this.relaPointing.on('down', pointer => {
            const w = BrowserWindow.getFocusedWindow();

            if (w) {
                const contents = w.webContents;
                if (contents) {
                    const pos = {state: 'down', x: pointer.x, y: pointer.y,
                        name: pointer.details.name};
                    this.downPos.set(pos.name, pos);

                    const evt = {
                        type : 'mouseDown',
                        x : pos.x,
                        y : pos.y,
                        clickCount: 1
                    };

                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");

                    this.sendInputEvent(contents, evt, pointer.details.time_captured, true);
                }
            }
        });

        this.relaPointing.on('up', pointer => {
            const w = BrowserWindow.getFocusedWindow();

            if (w) {
                const contents = w.webContents;
                if (contents) {
                    const pos = {state: 'up', x: pointer.x, y: pointer.y,
                        name: pointer.details.name};
                    this.downPos.set(pos.name, pos);

                    const evt = {
                        type : 'mouseUp',
                        x : pos.x,
                        y : pos.y,
                        clickCount: 1
                    };

                    this.downPos.delete(pos.name);
                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
                    this.sendInputEvent(contents, evt, pointer.details.time_captured, true);
                }
            }
        });

        this.relaPointing.on('detach', name => {
            console.log('Detach', name);
            const w = BrowserWindow.getFocusedWindow();
            if (w) {
                const contents = w.webContents;
                if(contents){
                    if (this.downPos.has(name)) {
                        this.downPos.delete(name);
                    }
                    contents.executeJavaScript("removeCursor('"  +  name + "')");
                }
            }
        });

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
                            this.sendInputEvent(contents, evt, msg.details.time_captured, Array.isArray(msg.details.trackpad));
                        }
                    } else {
                        this.sendInputEvent(contents, evt, msg.details.time_captured, Array.isArray(msg.details.trackpad));
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
    				this.sendInputEvent(contents, evt, msg.details.time_captured, Array.isArray(msg.details.trackpad));
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
                    this.sendInputEvent(contents, evt, msg.details.time_captured, Array.isArray(msg.details.trackpad));
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

    sendInputEvent(contents, evt, time, logging) {
        // if (logging) {
        //     this.io.publishTopic('emulated.mouse', `${evt.type},${evt.x},${evt.y},${time},${new Date().getTime()}\n`);
        // }
        contents.sendInputEvent(evt);
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

module.exports = Pointing;