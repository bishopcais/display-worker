const EventEmitter = require('events');
const vanishTime = 1000*60; // vanish after 1 minute 

const cd_max = 200;
const cd_min = 0.22;
const vmax = 0.37; // mm/ms
const vmin = 0.006;

const lambda = 20.0;
const ratio = 0.5;
const vinf = ratio*(vmax - vmin)+vmin;

module.exports = class RelativePointing extends EventEmitter {
    constructor(io) {
        super();

        this.bounds = io.config.get('display:bounds');
        this.pointerStates = new Map();

        setInterval(()=>{
            const now = new Date();

            for (let [key, ps] of this.pointerStates) {
                if (now - ps.lastSeen >= vanishTime) {
                    const x = ps.x;
                    const y = ps.y;
                    this.pointerStates.delete(key);
                    const msg = {
                        name: key,
                        x,
                        y
                    };
                    this.emit('detach', msg);
                }
            }
        }, 100); // gating time should be 50 ms
    };

    setStartingPoint(name, x, y) {
        this.pointerStates.set(name, {x, y, hardenedButtons: new Set(), lastSeen: new Date()});
    }

    removeCursor(name) {
        const pointerState = this.pointerStates.get(name);
        if (pointerState) {
            const x = pointerState.x;
            const y = pointerState.y;
            this.pointerStates.delete(name);
            this.emit('detach', {name, x, y});
        }
    }

    handleMessage(e) {
        let pointerState = this.pointerStates.get(e.name);
        if (!pointerState) {
            pointerState = {
                x: Math.round(this.bounds.width / 2),
                y: Math.round(this.bounds.height / 2),
                hardenedButtons: new Set()
            };

            this.pointerStates.set(e.name, pointerState);
            this.emit('attach', {
                details: {
                    name: e.name,
                }
            });
        }
        pointerState.lastSeen = new Date();
        
        const pointer = {
            details: {
                name: e.name,
                time_captured: e.time_captured
            },
            mode: 'relative'
        };

        // If the movement is big, then emit a move event
        if (e.dx && e.dx*e.dx + e.dy*e.dy > 0.02) {
            pointer.x = this.bounds.x + pointerState.x + this._convertToCD(e.dx/e.interval);
            pointer.y = this.bounds.y + pointerState.y + this._convertToCD(e.dy/e.interval);

            if (pointer.x < 0) pointer.x = 0;
            if (pointer.y < 0) pointer.y = 0;
            if (pointer.x > this.bounds.width) pointer.x = this.bounds.width;
            if (pointer.y > this.bounds.height) pointer.y = this.bounds.height;

            pointerState.x = pointer.x;
            pointerState.y = pointer.y

            this.emit('move', pointer);
        } else {
            pointer.x = pointerState.x;
            pointer.y = pointerState.y;
        }

        if (e.click) {
            pointer.button = e.click;
            this.emit('down', pointer);
            this.emit('up', pointer);
        }

        if (e.buttons) {
            const hardenedButtons = new Set(e.buttons);
            // If any of the previously hardenedButtons is not currently hardened, emit a up event
            for (let b of pointerState.hardenedButtons) {
                if (!hardenedButtons.has(b)) {
                    pointerState.hardenedButtons.delete(b);
                    pointer.button = b;
                    this.emit('up', pointer);
                }
            }

            // A button is down when it is not hardened already
            // If any of the currently hardenedButtons was not previously hardened, emit a down event
            for (let b of hardenedButtons) {
                if (!pointerState.hardenedButtons.has(b)) {
                    pointerState.hardenedButtons.add(b);
                    pointer.button = b;
                    this.emit('down', pointer);
                }
            }
        } else { // no button is hardened emit up for all previously hardened buttons.
            for (let b of pointerState.hardenedButtons) {
                pointerState.hardenedButtons.delete(b);
                pointer.button = b;
                this.emit('up', pointer);
            }
        }
    }

    _convertToCD (v) {
        let cd = Math.round( (cd_max - cd_min) / (1 + Math.exp(-lambda*(Math.abs(v)-vinf))) + cd_min);
        if (v < 0) {
            cd = -cd;
        }
        return cd;
    }
}