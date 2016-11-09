let cursors = new Map()

function clearAllCursors(){
    // document.getElementById("pointing").innerHTML = ""
}

function addCursor(opts){
    let cursordiv = document.createElement("div")
    cursordiv.className = "cursor"
    cursordiv.id = opts.name

    let img = document.createElement('img')
    img.className = "cursor-normal"
    img.src = "wandcursor.svg"

    let imgDown = document.createElement('img')
    imgDown.className = "cursor-down"
    imgDown.src = "wandcursor-down.svg"

    if(opts.state == "down"){
        img.style.display = "none"
        imgDown.style.display = "block"
    }

    cursordiv.appendChild(img)
    cursordiv.appendChild(imgDown)
    // cursordiv.style.transform = "translate( " + opts.x + "px," + opts.y +  "px )"
    cursordiv.style.transform = `translate(calc(${opts.x}px - 0.5vw), calc(${opts.y}px - 0.5vw))`

    document.getElementById("pointing").appendChild(cursordiv)
}

function removeCursor(opts){
    document.getElementById("pointing").removeChild(document.getElementById(opts))
}

function updateCursorPosition(opts){
    opts = JSON.parse(opts)
    let cursordiv = document.getElementById(opts.name)
    cursors.set(opts.name, opts)

    if(cursordiv){
        // cursordiv.style.transform = "translate( " + opts.x + "px," + opts.y +  "px )"
        cursordiv.style.transform = `translate(calc(${opts.x}px - 0.5vw), calc(${opts.y}px - 0.5vw))`

        if(opts.state == "down"){
            cursordiv.getElementsByClassName("cursor-normal")[0].style.display = "none"
            cursordiv.getElementsByClassName("cursor-down")[0].style.display = "block"
        }else{
            cursordiv.getElementsByClassName("cursor-normal")[0].style.display = "block"
            cursordiv.getElementsByClassName("cursor-down")[0].style.display = "none"
        }
    }else{
        addCursor(opts)
    }
}


function getClosestDragCursor(x,y){
    let distance = 1000
    let closestCursor = ""
    cursors.forEach( (v,k)=>{
        if(v.state == "down"){
            let d = Math.sqrt( Math.pow(v.x - x, 2) + Math.pow(v.y - y, 2) )
            if(d <= distance){
                distance = d
                closestCursor = k
            }
        }
    })
    console.log("closest cursor", closestCursor , distance)
    return closestCursor
}