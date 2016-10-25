

function showLauncherMenu ( items , position) {
    $(".launchermenu").remove()
    let left = "-20vw";
    let destleft = "0vw"
    if(position == "right"){
        left = "100vw"
        destleft = "80vw"
    }

    let menu = document.createElement("div")
    menu.id = "launchermenu1"
    menu.className = "launchermenu"
    menu.left = left

    for( var i = 0; i < items.length; i++){
        let it = document.createElement("div")
        div.innerHTML = items[i].name 
        menu.appendChild(div)
    }
    document.getElementById("pointing").appendChild(menu)
    menu.animate( [ { left : left }, { left : destleft }],  {
            duration : 800, fill: 'forwards', easing: 'ease-in-out'
        })

}

function hideLauncherMenu (position) {
    let left = "0vw";
    let destleft = "-20vw"
    if(position == "right"){
        left = "80vw"
        destleft = "100vw"
    }

    let menu = document.getElementById("launchermenu1")
    menu.animate( [ { left : left }, { left : destleft }],  {
            duration : 800, fill: 'forwards', easing: 'ease-in-out'
        }).onFinish(() => {
            $(menu).remove()
        })
     
}