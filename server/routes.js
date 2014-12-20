/**
 * Main application routes
 */

'use strict';

var errors = require('./components/errors');
var config = require('./config/environment');
var jwt = require('express-jwt');
var jwtCheck = jwt({
  secret: new Buffer(config.autho.clientSecret, 'base64'),
  audience: config.autho.clientId
});

module.exports = function(app) {

  // Insert routes below
  app.use('/api/user/login', require('./api/user/login'));
  app.use('/api/user/status', require('./api/user/status'));
  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*')
   .get(errors[404]);

};
