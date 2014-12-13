'use strict';

var validator = require('validator');
var Firebase = require("firebase");
var async = require('async');
var GitHubApi = require("github");
var github = new GitHubApi({
    // required
    version: "3.0.0"
});
var config = require('../../../config/environment');
var badRegex = new RegExp(/(shit|piss|cock|motherfucker|fuck|tits|stupid)/ig);
var ref = new Firebase(config.firebase.url);

// Take auth token and call github for user object
// Store in Firebase the user object.
exports.index = function(req, res) {
  var username = req.body.username;
  var authToken = req.body.authToken;
  if(validator.isNull(username)) {
    return res.status(400).jsonp({message: 'Missing username.'});
  }
  if(validator.isNull(authToken)) {
    return res.status(400).jsonp({message: 'Missing auth token.'});
  }
  github.authenticate({
      type: "oauth",
      token: authToken
  });
  github.repos.getAll({
    type: 'all'
  }, function (error, data) {
    if(error) {
      console.log(error);
      return res.status(500).jsonp({message: 'Could not log user in.'});
    }
    var repoNames = data.map(function (repo) {
      return repo.name;
    });
    var commitList = [];
    async.eachLimit(repoNames, 10, function(item, callback) {
      github.repos.getCommits({
        user: username,
        repo: item
      }, function (error, commitData) {
        if(error) {
          console.log(error);
          return res.status(500).jsonp({message: 'Could not log user in.'});
        }
        commitList.push(commitData);
        callback();
      });
    }, function (error) {
      if(error) {
        return res.status(500).jsonp({message: 'Could not log user in.'});
      }
      var commitMessages = [];
      for (var i = 0; i < commitList.length; i++) {
        var commitObj  = commitList[i];
        var commitNames = commitObj.map(function (commit) {
          return commit.commit.message;
        });
        commitMessages.push(commitNames);
      }
      commitMessages = commitMessages.reduce(function (a, b) {
        return a.concat(b);
      });
      for (var i = 0; i < commitMessages.length; i++) {
        var message = commitMessages[i];
        var result = badRegex.exec(message);
        console.log(result);
      }
      return res.jsonp({message: 'Login successful.'});
    });
  });
 };