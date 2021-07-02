# display-worker

The display-worker is an electron based display daemon that can be used to show remotely managed web-based contents. The display-worker exposes
an API on RabbitMQ that can be used to open URLs within "windows" and manage them. To make working with the display-worker easier, it is
recommended to use the [`@cisl/io-display`](https://github.com/cislrpi/io-display) plugin for [`@cisl/io`](https://github.com/cislrpi/io).

## Usage

To use the display-worker, first clone the repository:

```bash
git clone git@github.com:bishopcais/display-worker.git
cd display-worker
npm install
cp cog-sample.json cog.json
```

To run it:

```js
npm start
```

## Configuration

To configure the display-worker, you will need to modify its `cog.json` file. The `cog-sample.json` file within
the repository acts as a starting point, with the full list of options specified below:

* rabbit: see https://github.com/cislrpi/io#rabbitmq
* redis: see https://github.com/cislrpi/io#rabbitmq
* display:
```json
{
  "display": {
    "displayName": "required, reference name for this display-worker instance",
    "templateDir": "optional, path to template file, defaults to dist/template",
    "liaison_worker_url": "optional, url for the liaison worker, omit to disable connection"
  }
}
```
