'use strict';

var validator = require('validator');
var kue = require('kue');
var jobs = kue.createQueue();
var gatherer = require('./gatherer');
var GitHubApi = require("github");
var github = new GitHubApi({
    version: "3.0.0"
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
    /*
     * {
      "login": "brutalhonesty",
      "id": 1609870,
      "avatar_url": "https://avatars.githubusercontent.com/u/1609870?v=3",
      "gravatar_id": "",
      "url": "https://api.github.com/users/brutalhonesty",
      "html_url": "https://github.com/brutalhonesty",
      "followers_url": "https://api.github.com/users/brutalhonesty/followers",
      "following_url": "https://api.github.com/users/brutalhonesty/following{/other_user}",
      "gists_url": "https://api.github.com/users/brutalhonesty/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/brutalhonesty/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/brutalhonesty/subscriptions",
      "organizations_url": "https://api.github.com/users/brutalhonesty/orgs",
      "repos_url": "https://api.github.com/users/brutalhonesty/repos",
      "events_url": "https://api.github.com/users/brutalhonesty/events{/privacy}",
      "received_events_url": "https://api.github.com/users/brutalhonesty/received_events",
      "type": "User",
      "site_admin": false,
      "name": "Adam",
      "company": "Amazon.com Inc.",
      "blog": "http://www.adamschodde.me",
      "location": "AZ",
      "email": "aaschodd@asu.edu",
      "hireable": false,
      "bio": null,
      "public_repos": 109,
      "public_gists": 11,
      "followers": 21,
      "following": 26,
      "created_at": "2012-04-03T22:40:12Z",
      "updated_at": "2014-12-18T20:43:58Z",
      "meta": {
        "x-ratelimit-limit": "5000",
        "x-ratelimit-remaining": "4983",
        "x-ratelimit-reset": "1419041862",
        "x-oauth-scopes": "admin:org, admin:repo_hook, delete_repo, gist, notifications, repo, user:email, user:follow, write:public_key",
        "last-modified": "Thu, 18 Dec 2014 20:43:58 GMT",
        "etag": "\"809fa2a065a792986ab2f6a5eef1cd99\"",
        "status": "200 OK"
      }
    }*/
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