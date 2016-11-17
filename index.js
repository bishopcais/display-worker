const electron_path = require('electron')
const winston = require('winston')
require('winston-syslog').Syslog
let logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        }),
        new (winston.transports.File)({ 
            name: 'info-file',
            filename: 'dw-info.log',
            level: 'info',
            colorize: false,
            timestamp: () => new Date().toLocaleString('en-us', { timeZoneName: 'short' }),
            filename: 'logs/all-logs.log',
            handleExceptions: true,
            json: false,
            maxsize: 5242880 // 5MB
        }),
        new (winston.transports.File)({
            name: 'error-file',
            filename: 'dw-error.log',
            level: 'error',
            colorize: false,
            timestamp: () => new Date().toLocaleString('en-us', { timeZoneName: 'short' }),
            filename: 'logs/all-logs.log',
            handleExceptions: true,
            json: false,
            maxsize: 5242880 // 5MB
        }),
        new (winston.transports.Syslog)({
            level: 'info',
            handleExceptions: true,
            json: false
        })
    ]
});
logger.info('DisplayWorker uses electron from - ', electron_path)
const spawn = require('child_process').spawn
process.env['DISPLAY'] = ':0'
const proc = spawn(electron_path, ['src/apprpc.js'], {env:process.env})

proc.stdout.on('data', data=>logger.log(data.toString()))
proc.stderr.on('data', data=>logger.error(data.toString()))
proc.on('exit', ()=>process.exit())

process.stdin.resume()//so the program will not close instantly

function exitHandler(options, err) {
    if (options.cleanup) {
        console.log('Exiting...') 
        proc.kill()
    }
    if (err) 
        console.log(err.stack)
    if (options.exit) 
        process.exit()
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}))

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}))
process.on('SIGTERM', exitHandler.bind(null, {exit:true}))

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}))
