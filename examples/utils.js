module.exports.wait = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 4000);
  });
};
