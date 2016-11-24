
class DisplayError extends Error{
    constructor(name, message, details){
        super()
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
