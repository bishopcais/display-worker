
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
    document.addEventListener('mouseenter', nativeMenuHandle)
    document.addEventListener('mouseleave', hideLauncherMenu)
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
        document.removeEventListener('mouseenter', nativeMenuHandle)
    }
}

function showLauncherMenu () {
    if(isShowingMenu)
        return;
    
    isShowingMenu = true

    $(".launchermenu").remove()
    
    let left = "-40vw";
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
        let div = document.createElement("div")
        div.innerHTML = lmenuitems[i].label 
        menu.appendChild(div)
    }

    document.getElementById("pointing").appendChild(menu)
    menu.animate( [ { "left" : left }, { "left" : destleft }],  {
        duration : 800, fill: 'forwards', easing: 'ease-in-out'
    })

    menu.addEventListener("mouseleave", ()=>{
       setTimeout( hideLauncherMenu, 500)
    })

    // setTimeout(hideLauncherMenu , 3800)
}

function hideLauncherMenu () {
    

    let menu = document.getElementById("launchermenu1")
    if(menu){
        let left = getComputedStyle(menu).left;
        console.log(left)
        let destleft = "-40vw"
        if(lmenuposition == "right"){
            left = "80vw"
            destleft = "100vw"
        }
        menu.animate(   [ { "left" : left }, { "left" : destleft }],  {
            duration : 800, fill: 'forwards', easing: 'ease-in-out'
        })
        
        isShowingMenu = false
    
    }
     
}