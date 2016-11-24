const electron_path = require('electron')
const spawn = require('child_process').spawn
process.env['DISPLAY'] = ':0'
console.log(process.argv)
let args = ['src/apprpc.js']
for( let i = 2; i < process.argv.length; i++){
    args.push(process.argv[i])
}
const proc = spawn(electron_path, args, {env:process.env})

proc.stdout.on('data', data=>console.log(data.toString()))
proc.stderr.on('data', data=>console.error(data.toString()))
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
