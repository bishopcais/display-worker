#Display Worker

## Requirements
### Windows
Visual Studio 2013 (Express works fine).
Python (v2.7.3 recommended, v3.x.x is not supported).
### Mac
Xcode Command Line Tools.
### Linux
Python (v2.7 recommended, v3.x.x is not supported).
make.
A C/C++ compiler like GCC.
libxtst-dev and libpng++-dev (sudo apt-get install libxtst-dev libpng++-dev).


## Installation
To install display-worker:
```
git clone git@github.ibm.com:celio/display-worker.git
cd display-worker
npm install
```

## Configuration
The configuration file is a JSON object. It specified in the following ways
1. <The absolute or relative path to the configuration file> as a parameter to `display-worker`.
2. a cog.json file in the working directory. 

Configuration File details
```
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


## Run
1. Running locally with default settings location
```
npm start
```

2. Running directly using electron

```
electron src/apprpc.js <path to configuration file. Optional>
```

3. Using debian installer in Ubuntu
```
display-worker <path to configuration file. Optional>
```