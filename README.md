#Display Worker

Display Worker is a electron-based display daemon that helps to remotely manage web-based contents. CELIO display APIs supports this process. For more details on how to display content please refer [CELIO documentation](https://github.ibm.com/celio/CELIO). 

## Development or Running from Source Requirements

### Setup

#### Dev Environment Prerequisites 
- Windows
Visual Studio 2013 (Express works fine).
Python (v2.7.3 recommended, v3.x.x is not supported).
- Mac
Xcode Command Line Tools.
- Linux
Python (v2.7 recommended, v3.x.x is not supported).
make.
A C/C++ compiler like GCC.
libxtst-dev and libpng++-dev (sudo apt-get install libxtst-dev libpng++-dev).


#### Clone display-Worker
```
git clone git@github.ibm.com:celio/display-worker.git
cd display-worker
npm install
```

#### Run
- using electron
```js
npm start <path to configuration file. Optional>
```

- using crun. crun is service launch daemon for using in CEL. Other environment does not require this. 
```
node index.js <path to configuration file. Optional>
```

#### Environment Variables

- For Linux, use `DISPLAY=:<n>`

- Use `DW_SETTINGS_FILE=<path_to_configuration_file>` to specify the path of the configuration file. The details of the configuration file is given below. 

## Configuration
The configuration file is a JSON object. 

```js
{
  "mq": {
     "url": "localhost/test",
     "username": "test",
     "password": "test"
  },
  "store": {
    "url": "localhost",
    "passwd": "password" 
  },
  "display" : {
    "displayName": "main",
    "templateDir": "<path-to-template-dir>",
    // Hotspot definition required for Oblong wand or HTC vive interaction
    "hotspot" : {
        "center" : [175.2119, 910.8918, -4263.35], // center of the display in millimeters
        "normal" : [ 0.0, 0.0, -1.0 ], // normal to the display
        "over" : [ 1.0, 0.0, 0.0 ], // over to the display
        "width" : 4102.0, // width in millimeters
        "height" : 2307.0 // height in millimeters
    },
    // Launcher menu. remove this if it is not required
    "launcherMenu" : {
      "position" : "left", // position: ["left", "right"]
      "menuWidth" : 100, // in millimeters. The menu region is defined as a hotspot. this setting specifies the width. The height and center are derived from the display's hotspot specification
      "distanceThreshold" : 850 // in millimeters. Minimum distance away from display required to show the launcherMenu 
    }
  },
  // list of Apps to show in the Launcher Menu
  "apps": [
    {
      "type" : "GSpeak", // type: ["GSpeak", "celio" ]
      "appname": "knice", // appname or displaycontext name
      "label" : "K-Nice", // Label to appear on the menu
      "chief-pool": "knice", // App's chief pool for GSpeak type apps
      "master-reset" : true // restart app (GSpeak) or refresh webpages of the app (CELIO)
    },
    {
      "type" : "GSpeak",
      "appname": "pulse",
      "label" : "Pulse",
      "chief-pool": "triweb",
      "master-reset" : true
    },
    {
      "type" : "celio",
      "appname" : "triptomarsland",
      "label" : "Mars",
      "master-reset" : true
    }
  ]

}

```

## Building Debian Package

- Set up the required development environment as described above on the ubuntu machine.
- After `npm install`, run `npm run dist`. This step produces a debian package with `display-worker_<version as specified package.json>_amd64.deb` under `dist` folder.

## Using Debian Package

#### Install

`sudo dpkg -i display-worker_<version as specified package.json>_amd64.deb`

The installer adds `display-worker` executable to the system. It also
- copies the template to `/opt/display-worker/template`
- copies a `display-worker.service` file to `/etc/systemd/system/`. Edit this file to change the application load order as well as the reference to the configuration file.
- copies the default configuration file to `/etc/celio/display-worker-settings.json`. Edit the default configuration file to suit your environment requirements. The display-worker service  uses this configuration file. You can change this in the service file

#### Running using service 

- start : `sudo systemctl start display-worker.service`
- stop : `sudo systemctl stop display-worker.service` 
- observing logs : `journalctl -f -u display-worker.service`

You can multiple display-workers in a system by ensuring a separate service and configuration files for each instance.

#### Running using Command

`DISPLAY=:<n> DW_SETTINGS_FILE=<path_to_configuration_file> display-worker`

or

`DISPLAY=:<n>  display-worker <path_to_configuration_file>`

or 

```
cd <into a dir with configuration file>
DISPLAY=:<n>  display-worker
```
#### uninstall

`sudo dpkg --remove display-worker`



