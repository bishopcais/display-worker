module.exports.formatError = function(message, params) {
  params.status = 'error';
  params.message = message;
  return params;
}
