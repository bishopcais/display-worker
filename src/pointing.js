const {BrowserWindow} = require("electron");
const RelativePointing = require('./relative-pointing');
const robot = require('robotjs');

class Pointing {
    constructor( io ){
        this.io = io;

        const hotspot = io.config.get("display:hotspot")
        const bounds = io.config.get("display:bounds")
        this.ppm = bounds.width / hotspot.width;
        this.sx = bounds.x;
        this.sy = bounds.y;

        this.controlCursor = null;
        this.dragging = false; 
        this.motorPos = new Map();

        const self = this;
        
        this.relaPointing = new RelativePointing(io);
        io.onTopic('*.relative.pointing', msg => self.relaPointing.handleMessage(JSON.parse(msg.toString())));
        this.relaPointing.on('move', this.moveHandler.bind(self));
        this.relaPointing.on('down', this.downHandler.bind(self));
        this.relaPointing.on('up', this.upHandler.bind(self));
        this.relaPointing.on('detach', this.detachHandler.bind(self));

        this.hotspot = io.createHotspot(hotspot, false);
        this.hotspot.onPointerMove(function (pointer) {
            const cursor = self.getPixelPosition(pointer);
            if (cursor) {
                self.moveHandler(cursor)
            }
        }.bind(self));
        this.hotspot.onPointerDown(function (pointer) {
            const cursor = self.getPixelPosition(pointer);
            if (cursor) {
                self.downHandler(cursor)
            }
        }.bind(self));
        this.hotspot.onPointerUp(function (pointer) {
            const cursor = self.getPixelPosition(pointer);
            if (cursor) {
                self.upHandler(cursor)
            }
        }.bind(self));
        this.hotspot.onPointerDetach(this.detachHandler.bind(self));
    }

    upHandler(pointer) {
        if (pointer.details.name === this.controlCursor) {
            const w = BrowserWindow.getFocusedWindow();
            if (w) {
                const contents = w.webContents;
                if (contents) {
                    const pos = {
                        state: 'up',
                        x: pointer.x,
                        y: pointer.y,
                        name: pointer.details.name
                    };
                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
                }
            }
            const evt = {
                type : 'mouseUp',
                x : pointer.x,
                y : pointer.y,
                button: pointer.button,
                clickCount: 1
            };

            this.dragging = false;
            this.sendInputEvent(evt);
        }
    }

    downHandler(pointer) {
        if (!this.dragging) {
            this.controlCursor = pointer.details.name;
            this.dragging = true;

            const w = BrowserWindow.getFocusedWindow();
            if (w) {
                const contents = w.webContents;
                if (contents) {
                    const pos = {
                        state: 'down',
                        x: pointer.x,
                        y: pointer.y,
                        name: pointer.details.name
                    };
                    contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
                }
            }

            const evt = {
                type : 'mouseDown',
                x : pointer.x,
                y : pointer.y,
                button: pointer.button,
                clickCount: 1
            };

            this.sendInputEvent(evt);
        }
    }

    moveHandler(pointer) {
        const w = BrowserWindow.getFocusedWindow();
         if (w) {
            const contents = w.webContents;
            if (contents) {
                const pos = {
                    state: 'move',
                    x: pointer.x,
                    y: pointer.y,
                    name: pointer.details.name
                };

                if (this.dragging && this.controlCursor === pointer.details.name) {
                    pos.state = "down";
                }
                contents.executeJavaScript("updateCursorPosition('"  +  JSON.stringify(pos) + "')");
            }
        }

        if (!this.controlCursor) {
            this.controlCursor = pointer.details.name;
        }

        if (this.controlCursor === pointer.details.name) {
            const evt = {
                type : 'mouseMove',
                x : pointer.x,
                button: pointer.button,
                y : pointer.y
            };

            if (this.dragging) {
                evt.buttons = 1;
            }

            this.sendInputEvent(evt);
        }
    }

    detachHandler(info) {
        console.log('Detach', info.name);
        if (this.controlCursor === info.name) {
            this.controlCursor = null;
            this.dragging = false;
        }
        this.motorPos.delete(info.name);
    }

    sendInputEvent(evt) {
        if (!Number.isFinite(evt.x) || !Number.isFinite(evt.y)) {
            return;
        }

        // -0 causes error
        if (evt.x === -0) {
            evt.x = 0;
        }

        if (evt.y === -0) {
            evt.y = 0;
        }

        switch (evt.type) {
            case 'mouseMove':
                if (evt.buttons == 1) {// dragging
                    robot.dragMouse(evt.x, evt.y);
                } else {
                    robot.moveMouse(evt.x, evt.y);
                }
                break;
            case 'mouseUp':
                robot.mouseToggle('up', evt.button);
                break;
            case 'mouseDown':
                robot.mouseToggle('down', evt.button);
                break;
        }
    }

    getPixelPosition(pointer){
        let x, y, lastMotorPos, button;

        // lighthouse driver
        if (pointer.details.trackpad) {
            if (pointer.eventButton) { // down or up event
                switch (pointer.eventButton) {
                    case 'P':
                    case 'T':
                        button = 'left';
                        break;
                    case 'M':
                        button = 'right';
                        break;
                    default:
                        break;
                }
            }
        
            lastMotorPos = this.motorPos.get(pointer.details.name);
            // Trackpad is touched
            if (pointer.details.trackpad[0] != 0 ||
                pointer.details.trackpad[1] != 0) {
                if (!lastMotorPos) { // first touch
                    lastMotorPos = {
                        x: pointer.x,
                        y: pointer.y,
                        mx: pointer.x,
                        my: pointer.y
                    }

                    this.motorPos.set(pointer.details.name, lastMotorPos);
                } else {
                    // get speed
                    const dx = pointer.x - lastMotorPos.mx;
                    const dy = pointer.y - lastMotorPos.my;

                    lastMotorPos.x += dx * 0.3;
                    lastMotorPos.y += dy * 0.3;
                    lastMotorPos.mx = pointer.x;
                    lastMotorPos.my = pointer.y;
                }
                x = lastMotorPos.x;
                y = lastMotorPos.y;
            } else { // Trackpad is released
                x = pointer.x;
                y = pointer.y;
                this.motorPos.delete(pointer.details.name);
            }
        } else {
            if (pointer.eventButton) { // down and up event
                button = 'left'
            } else if (pointer.details.buttons.length > 0) { // move event
                button = 'left';
            }
            x = pointer.x;
            y = pointer.y;
        }
        
        return {
            x : Math.round(this.sx + x * this.ppm),
            y : Math.round(this.sy + y * this.ppm),
            button,
            details : {
                name: pointer.details.name,
                time_captured: pointer.details.time_captured
            }
        };
    }
}

module.exports = Pointing;