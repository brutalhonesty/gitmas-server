'use strict';

var validator = require('validator');
var kue = require('kue');
var jobs = kue.createQueue();
var gatherer = require('./gatherer');
var GitHubApi = require("github");
var github = new GitHubApi({
    version: "3.0.0",
    headers: {
      'User-Agent': 'Gitmas-Server/v0.1'
    }
});

// Take auth token and call github for user object
// Store in Firebase the user object.
exports.index = function(req, res) {
  var authToken = req.body.authToken;
  if(validator.isNull(authToken)) {
    return res.status(400).jsonp({message: 'Missing auth token.'});
  }
  github.authenticate({
      type: "oauth",
      token: authToken
  });
  github.user.get({}, function (error, reply) {
    if(error) {
      return res.status(500).jsonp({message: 'Could not sign user in.'});
    }
    var job = jobs.create('gather', {
      username: reply.login,
      authToken: authToken
    }).save(function (error) {
      if(error) {
        return res.status(500).jsonp({message: 'Could not sign user in.'});
      }
      gatherer.gather();
      return res.jsonp({id: job.id});
    });
  });
 };