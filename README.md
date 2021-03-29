# Display Worker

Display Worker is a electron-based display daemon that helps to remotely manage web-based contents. CELIO display APIs supports this process. For more details on how to display content please refer [CELIO documentation](https://github.ibm.com/celio/CELIO).

## Development or Running from Source Requirements


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
  }
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
#### Uninstall

`sudo apt-get purge display-worker`
