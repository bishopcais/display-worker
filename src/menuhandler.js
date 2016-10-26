const {BrowserWindow} = require("electron")

class MenuHandler {

    construction(io){
        this.io = io;
        this.menuConfig = io.config.get("display:launcherMenu")
        let hotspotConfig = io.config.get("display:hotspot")
        
        if(this.menuConfig.position == "left"){
            hotspotConfig.center[0] -= (hotspotConfig.width/2 - this.menuConfig.menuWidth/2)  
        }else if(this.menuConfig.position == "right"){
            hotspotConfig.center[0] += (hotspotConfig.width/2 - this.menuConfig.menuWidth/2)
        }
        hotspotConfig.width = this.menuConfig.menuWidth

        this.hotspot = io.createHotspot(hotspotConfig, false);
        this.canShowMenu  = false
        this.isShowingMenu = false
        this.hotspot.onPointerMove( (pointer) => {
            if(this.canShowMenu && !this.isShowingMenu && pointer.distanceAlongNormal < this.menuConfig.distanceThreshold){
                this.isShowingMenu = true
                this.showLauncherMenu(this.menuConfig.position )
            }
        })

        this.hotspot.onPointerEnter( (pointer) => {
            this.canShowMenu  = true
            this.isShowingMenu = false
        })

        this.hotspot.onPointerLeave( (pointer) => {
            this.canShowMenu  = false
            this.isShowingMenu = false
        })
    }

    showLauncherMenu(pos){
        let b = BrowserWindow.getFocusedWindow()
        if(b){
            b.webContents.send("launchermenu", "showmenu")      
        }
    }

    // hideLauncherMenu() {
    //     let b = BrowserWindow.getFocusedWindow()
    //     if(b){
    //         let pos = io.config.get("display:launcherMenuAt")
    //         b.webContents.send("launchermenu", "hidemenu", { position : pos })      
    //     }
    // }

}

module.exports = MenuHandler