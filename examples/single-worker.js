const cislio = require('@cisl/io');
require('@cisl/io-display');

const io = cislio();

(async function () {
  const { displayContext } = await io.display.openDisplayWorker('contextOne', {
    main: {
      displayName: 'main',
      contentGrid: {
        row: 3,
        col: 3,
      },
      width: 300,
      height: 400,
    },
    foo: {
      displayName: 'main',
      contentGrid: {
        row: 3,
        col: 3,
      },
      width: 300,
      height: 400,
      x: 1000,
    },
  });

  const promises = [];

  promises.push(io.display.displayUrl('main', 'http://www.google.com', {
    widthFactor: 1,
    heightFactor: 1,
  }));

  promises.push(io.display.displayUrl('foo', 'https://www.example.com', {
    widthFactor: 1,
    heightFactor: 1,
    position: {
      gridLeft: 2,
      gridTop: 2,
    },
  }));

  await Promise.all(promises);

  await new Promise((resolve) => {
    setTimeout(resolve, 8000);
  });
  await displayContext.close();
})()
  .then(() => {
    console.log('done');
    process.exit();
  })
  .catch((err) => {
    console.error(err);
  });
