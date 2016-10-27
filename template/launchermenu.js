
let isShowingMenu = false
let isNativeMenuHandlerEnabled = true
let lmenuitems = []
let lmenuposition = ""

ipcRenderer.on("launchermenu", (event, arg) => {
    disableNativeMenuHandler()
    if(event == "showmenu"){
        showLauncherMenu()
    }else if(event == "hidemenu"){
        hideLauncherMenu()
    }
})


function setupNativeMenuHandler(items, position){
    console.log("setting up menu ", items, position)
    isNativeMenuHandlerEnabled = true
    lmenuitems = items
    lmenuposition = position
    window.addEventListener('mouseenter', nativeMenuHandle)
}

function nativeMenuHandle(e){
    if(isNativeMenuHandlerEnabled){
        if(lmenuposition == 'left'){
            if( e.x < 100 )
                showLauncherMenu()
        }else{
            if( e.x > window.innerWidth - 100)
                showLauncherMenu()
        }
    }
}

function disableNativeMenuHandler(){
    if(isNativeMenuHandlerEnabled){
        isNativeMenuHandlerEnabled = false
        window.removeEventListener('mouseenter', nativeMenuHandle)
    }
}

function showLauncherMenu () {
    if(isShowingMenu)
        return;
    
    isShowingMenu = true

    $(".launchermenu").remove()
    
    let left = "-20vw";
    let destleft = "0vw"
    
    if(lmenuposition == "right"){
        left = "100vw"
        destleft = "80vw"
    }

    let menu = document.createElement("div")
    menu.id = "launchermenu1"
    menu.className = "launchermenu"
    menu.left = left

    for( var i = 0; i < lmenuitems.length; i++){
        let it = document.createElement("div")
        div.innerHTML = lmenuitems[i].name 
        menu.appendChild(div)
    }

    document.getElementById("pointing").appendChild(menu)
    menu.animate( [ { "left" : left }, { "left" : destleft }],  {
        duration : 800, fill: 'forwards', easing: 'ease-in-out'
    })

    setTimeout(hideLauncherMenu , 3800)
}

function hideLauncherMenu () {
    let left = "0vw";
    let destleft = "-20vw"
    if(lmenuposition == "right"){
        left = "80vw"
        destleft = "100vw"
    }

    let menu = document.getElementById("launchermenu1")
    menu.animate( [ { "left" : left }, { "left" : destleft }],  {
        duration : 800, fill: 'forwards', easing: 'ease-in-out'
    }).onFinish(() => {
        $(menu).remove()
        isShowingMenu = false
    })
     
}