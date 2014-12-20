'use strict';

var kue = require('kue');
var Firebase = require('firebase');
var ranker = require('./ranker');
var async = require('async');
var GitHubApi = require("github");
var github = new GitHubApi({
    version: "3.0.0"
});
var config = require('../../../config/environment');
var ref = new Firebase(config.firebase.url);
var jobs = kue.createQueue();

function _getRepos (callback) {
  github.repos.getAll({
    type: 'all',
    per_page: 1000
  }, function (error, data) {
    if(error) {
      return callback(error);
    }
    var repoNames = data.map(function (repo) {
      return repo.name;
    });
    return callback(null, repoNames);
  });
}

function _getCommitMessages (job, repoNames, cb) {
  var commitMessages = [];
  var count = 0;
  async.eachSeries(repoNames, function(item, callback) {
    github.repos.getCommits({
      user: job.data.username,
      repo: item
    }, function (error, commitData) {
      if(error) {
        return cb(error);
      }
      count++;
      console.log('Called!');
      job.log('Extracting commits for repo %s', item);
      job.progress(count, repoNames.length);
      for (var i = 0; i < commitData.length; i++) {
        var commit = commitData[i];
        if(commit.commit.committer.name === job.data.username) {
          console.log(commit.commit);
          commitMessages.push(commit.commit.message);
        }
      }
      callback();
    });
  }, function (error) {
    if(error) {
      return callback(error);
    }
    return cb(null, commitMessages);
  });
}

function _calculateRanking (messages, callback) {
  var rankings = [];
  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];
    console.log('Message: ')
    console.log(message);
    rankings.push({
      badwords: ranker.calcBadWords(message)
    });
  }
  console.log('Rankings: ');
  console.log(rankings);
  console.log('Rankings length: ');
  console.log(rankings.length);
  var total = {
    badwords: 0.0,
    grammar: 0.0,
    syntax: 0.0
  };
  for (var i = 0; i < rankings.length; i++) {
    var rank = rankings[i];
    console.log('Current rank before: ' + total.badwords);
    console.log(((1 / rankings.length) * rank.badwords));
    total.badwords = parseFloat(total.badwords) + parseFloat((1 / rankings.length) * rank.badwords);
    console.log('Current rank after: ' + total.badwords);
  }
  console.log('total: ');
  console.log(total);
  return callback(null, total);
}

exports.gather = function () {
  jobs.process('gather', function (job, done) {
    github.authenticate({
        type: "oauth",
        token: job.data.authToken
    });
    _getRepos(function (error, repos) {
      if(error) {
        return done(new Error(error));
      }
      _getCommitMessages(job, repos, function (error, messages) {
        if(error) {
          return done(new Error(error));
        }
        console.log('Messages:');
        console.log(JSON.stringify(messages));
        _calculateRanking(messages, function (error, rankings) {
          if(error) {
            return done(new Error(error));
          }
          var usersRef = ref.child('users');
          var username = job['data']['username'];
          var userRank = {};
          userRank[username] = rankings
          usersRef.set(userRank);
          done();
        });
      });
    });
  });
};