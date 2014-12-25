/**
 * Main application file
 */

'use strict';

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var express = require('express');
var kue = require('kue');
var config = require('./config/environment');
// Setup server
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
require('./config/express')(app);
require('./routes')(app);

io.on('connection', function (socket) {
  socket.on('getProgress', function (data) {
    var progressInterval = setInterval(function () {
      kue.Job.get(data.id, function (error, job) {
        if(error) {
          socket.emit('progressError', {error: 'Invalid id.'});
        }
        socket.emit('sendProgress', {progress: job.progress() || "0"});
        if(job.progress() === "100") {
          clearInterval(progressInterval);
        }
      });
    }, 100);
  });
});

// Start server
server.listen(config.port, config.ip, function () {
  console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

// Expose app
exports = module.exports = app;