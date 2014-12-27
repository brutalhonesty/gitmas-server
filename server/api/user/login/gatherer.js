'use strict';

var kue = require('kue');
var Firebase = require('firebase');
var ranker = require('./ranker');
var async = require('async');
var GitHubApi = require("github");
var github = new GitHubApi({
    version: "3.0.0",
    headers: {
      'User-Agent': 'Gitmas-Server/v0.1'
    }
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
    var repos = data.map(function (repo) {
      return {name: repo.name, language: repo.language};
    });
    return callback(null, repos);
  });
}

function _getCommitMessages (job, repos, cb) {
  var commitMessages = [];
  var count = 0;
  async.eachLimit(repos, 10, function(item, callback) {
    // TODO Iterate over all pages
    github.repos.getCommits({
      user: job.data.username,
      repo: item.name,
      page: 1,
      per_page: 100
    }, function (error, commitData) {
      if(error) {
        return cb(error);
      }
      count++;
      console.log('Extracting commits for repo ' + item.name);
      job.log('Extracting commits for repo %s', item.name);
      job.progress(count, repos.length);
      async.eachLimit(commitData, 20, function (commit, callbk) {
        if(commit.commit.committer.name === job.data.username) {
          ranker.calcSpelling(commit.commit.message, item.language, function (error, reply) {
            if(error) {
              return callback(error);
            }
            commitMessages.push({
              message: commit.commit.message,
              spelling: reply
            });
            return callbk();
          });
        } else {
          return callbk();
        }
      }, function (error) {
        if(error) {
          return callback(error);
        }
        return callback();
      });
    });
  }, function (error) {
    if(error) {
      return cb(error);
    }
    return cb(null, commitMessages);
  });
}

function _calculateRanking (job, messages, callback) {
  var rankings = [];
  for (var i = 0; i < messages.length; i++) {
    job.progress(i, messages.length);
    var message = messages[i];
    rankings.push({
      badwords: ranker.calcBadWords(message.message),
      grammar: {
        capitalization: ranker.calcCapitalization(message.message),
        punctuation: ranker.calcPunctuation(message.message),
        spelling: message.spelling
      },
      syntax: 0.0
    });
  }
  var total = {
    badwords: 0.0,
    grammar: {
      capitalization: 0.0,
      punctuation: 0.0,
      spelling: 0.0
    },
    syntax: 0.0
  };
  for (var i = 0; i < rankings.length; i++) {
    job.progress(i, rankings.length);
    var rank = rankings[i];
    total.badwords = parseFloat(total.badwords) + parseFloat((1 / rankings.length) * rank.badwords);
    total.grammar = {
      capitalization: parseFloat(total.grammar.capitalization || 0.0) + parseFloat((1 / rankings.length) * (rank.grammar.capitalization)),
      punctuation: parseFloat(total.grammar.punctuation || 0.0) + parseFloat((1 / rankings.length) * (rank.grammar.punctuation)),
      spelling: parseFloat(total.grammar.spelling || 0.0) + parseFloat((1 / rankings.length) * (rank.grammar.spelling))
    };
  }
  var percentage = (total.badwords + total.grammar.capitalization + total.grammar.punctuation + total.grammar.spelling + total.syntax) * 100;
  return callback(null, {rankings: total, percentage: percentage});
}

exports.gather = function () {
  jobs.process('gather', function (job, done) {
    github.authenticate({
        type: "oauth",
        token: job.data.authToken
    });
    _getRepos(function (error, repos) {
      if(error) {
        console.log(error);
        return done(new Error(error));
      }
      _getCommitMessages(job, repos, function (error, messages) {
        if(error) {
          console.log(error);
          return done(new Error(error));
        }
        _calculateRanking(job, messages, function (error, results) {
          if(error) {
            console.log(error);
            return done(new Error(error));
          }
          var usersRef = ref.child('users');
          var rankRef = ref.child('ranks');
          var username = job['data']['username'];
          var userRank = {};
          userRank[username] = results.rankings;
          usersRef.set(userRank);
          var userPercent = {};
          userPercent[username] = {};
          userPercent[username]['username'] = username;
          userPercent[username]['percentage'] = results.percentage;
          rankRef.set(userPercent);
          done();
        });
      });
    });
  });
};