/*
In this example, we do the following:
1. Open display context on one worker
2. Open one view object (A)
3. Open a second view object (B)
4. Move A's position on the window
5. Resize B
6. Change A's url
7. Close A
8. Close B
 */
const cislio = require('@cisl/io');
require('@cisl/io-display');
const readline = require('readline-sync');
const { wait } = require('./utils');

const io = cislio();

(async function () {
  // The display context hierarchy is:
  //  main:   // the display name
  //    foo:  // the window name
  //      - viewObjA
  //      - viewObjB
  const displayContext = await io.display.openDisplayContext('contextOne', {
    foo: {
      displayName: 'main',
      contentGrid: {
        row: 3,
        col: 3,
      },
    },
  });

  const viewObjA = await displayContext.displayUrl(
    'foo',
    'http://www.google.com',
    {
      widthFactor: 1,
      heightFactor: 1,
      position: {
        gridLeft: 1,
        gridTop: 1,
      },
    },
  );

  const viewObjB = await displayContext.displayUrl(
    'foo',
    'http://www.example.com',
    {
      widthFactor: 1,
      heightFactor: 1,
      position: {
        gridLeft: 3,
        gridTop: 3,
      },
    },
  );

  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });

  await viewObjA.setBounds({ gridLeft: 2, gridTop: 2 });

  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });

  await viewObjB.setBounds({ gridLeft: 2, gridTop: 2 });

  await wait();

  await viewObjA.setBounds({ sendToFront: true });

  await wait();

  await viewObjA.setBounds({ zIndex: 0 });

  await wait();

  await viewObjB.setBounds({ sendToBack: true });

  await wait();

  await viewObjB.setBounds({ zIndex: 2 });

  await wait();

  await viewObjB.setBounds({ gridLeft: 3 });

  await wait();

  readline.prompt('Press enter to close the display context');

  await viewObjA.close();

  await new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });

  await viewObjB.close();

  await new Promise((resolve) => {
    setTimeout(resolve, 4000);
  });
  await displayContext.close();
})()
  .then(() => {
    console.log('done');
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    io.close().catch(() => {
      /* pass */
    });
    process.exit();
  });
