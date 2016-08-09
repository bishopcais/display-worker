const EventEmitter = require('events');
const vanishTime = 1000*60; // vanish after 1 minute

const cd_max = 150;
const cd_min = 0.22;
const vmax = 0.37; // mm/ms
const vmin = 0.006;

const lambda = 20.0;
const ratio = 0.5;
const vinf = ratio*(vmax - vmin)+vmin;

module.exports = class RelativePointing extends EventEmitter {
    constructor(io) {
        super();

        const bounds = io.config.get('display:bounds');
        this.pointerStates = new Map();

        setInterval(()=>{
            const now = new Date();

            for (let [key, ps] of this.pointerStates) {
                if (now - ps.lastSeen > vanishTime) {
                    this.pointerStates.delete(key);
                    this.emit('detach', key);
                }
            }
        }, vanishTime);

        io.onTopic('*.relative.pointing', msg=> {
            const e = JSON.parse(msg.toString());

            let pointerState = this.pointerStates.get(e.name);

            if (!pointerState) {
                pointerState = {
                    x: Math.round(bounds.width / 2),
                    y: Math.round(bounds.height / 2),
                    hardenedButtons: new Set()
                };

                this.pointerStates.set(e.name, pointerState);
                this.emit('attach', {
                    details: {
                        name: e.name,
                    }
                });
            }

            pointerState.lastSeen = e.time_captured;

            const pointer = {
                details: {
                    name: e.name,
                    time_captured: e.time_captured
                }
            }

            if (e.dx) {
                pointer.x = bounds.x + pointerState.x + this._convertToCD(e.dx/e.interval);
                pointer.y = bounds.y + pointerState.y + this._convertToCD(e.dy/e.interval);

                if (pointer.x < 0) pointer.x = 0;
                if (pointer.y < 0) pointer.y = 0;
                if (pointer.x > bounds.width) pointer.x = bounds.width;
                if (pointer.y > bounds.height) pointer.y = bounds.height;

                pointerState.x = pointer.x;
                pointerState.y = pointer.y

                this.emit('move', pointer);
            } else {
                pointer.x = pointerState.x;
                pointer.y = pointerState.y;

                if (e.buttons) {
                    // A button is down when it is not hardened already
                    const hardenedButtons = new Set(e.buttons);

                    // If any of the currently hardenedButtons was not previously hardened, emit a down event
                    for (let b of hardenedButtons) {
                        if (!pointerState.hardenedButtons.has(b)) {
                            pointerState.hardenedButtons.add(b);
                            pointer.eventButton = b;
                            this.emit('down', pointer);
                        }
                    }

                    // If any of the previously hardenedButtons is not currently hardened, emit a up event
                    for (let b of pointerState.hardenedButtons) {
                        if (!hardenedButtons.has(b)) {
                            pointerState.hardenedButtons.delete(b);
                            pointer.eventButton = b;
                            this.emit('up', pointer);
                        }
                    }
                } else { // no button is hardened emit up for all previously hardened buttons.
                    for (let b of pointerState.hardenedButtons) {
                        pointerState.hardenedButtons.delete(b);
                        pointer.eventButton = b;
                        this.emit('up', pointer);
                    }
                }
            }
        })
    };

    _convertToCD (v) {
        let cd = Math.round( (cd_max - cd_min) / (1 + Math.exp(-lambda*(Math.abs(v)-vinf))) + cd_min);
        if (v < 0) {
            cd = -cd;
        }
        return cd;
    }
}