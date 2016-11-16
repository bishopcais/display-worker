
class DisplayError extends Error{
    constructor(name, message, details){
        this.name = name
        this.message = message
        this.details = details
    }

    toString(){
        return JSON.stringify({
            name : this.name,
            message : this.message,
            details : this.details
        })
    }
}

module.exports = DisplayError
