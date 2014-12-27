var GithubApi = require('github');
var async = require('async');
var teacher = require('teacher');
var yaml = require('yamljs');
var fs = require('fs');
var request = require('request');
var _ = require('lodash');
var github = new GithubApi({
  version: '3.0.0',
  debug: true,
  headers: {
    'User-Agent': 'Gitmas-Aggregator/v0.1'
  }
});
var config = require('./server/config/environment');

// Get all languages from Github and return the YAML document.
function _getLanguages(callback) {
  request.get('https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml', function (error, resp, body) {
    if(error) {
      return callback(error);
    }
    if(resp.statusCode !== 200) {
      return callback(body);
    }
    var doc = yaml.parse(body);
    var languages = Object.keys(doc);
    return callback(null, languages);
  });
}

// Sort an object of {"string": int} format with highest value on top.
function _sortProperties(obj, isNumericSort) {
    isNumericSort = isNumericSort || false; // by default text sort
    var sortable=[];
    for(var key in obj) {
      if(obj.hasOwnProperty(key)) {
        sortable.push([key, obj[key]]);
      }
    }
    if(isNumericSort) {
      sortable.sort(function(a, b) {
          return b[1]-a[1];
      });
    }
    else {
      sortable.sort(function(a, b) {
          var x=a[1].toLowerCase();
          var y=b[1].toLowerCase();
          return x < y ? -1 : x > y ? 1 : 0;
      });
    }
    // array in format [ [ key1, val1 ], [ key2, val2 ], ... ]
    var newObj = {};
    for (var i = 0; i < sortable.length; i++) {
      var obj = sortable[i];
      newObj[obj[0]] = obj[1];
    }
    return newObj;
}

// Check all the commits gathered against the spell checker and return an object of {"word": occurances} form.
function _checkCommits(commits, callback) {
  var mistakes = {};
  async.eachLimit(commits, 200, function (commit, cb) {
    teacher.check(commit, function (error, resp) {
      if(error) {
        return cb(error);
      }
      if(!resp) {
        return cb();
      }
      for (var i = 0; i < resp.length; i++) {
        var wordObj = resp[i];
        if(wordObj.type === 'spelling') {
          mistakes[wordObj.string] = mistakes[wordObj.string] || 0;
          mistakes[wordObj.string]++;
        }
      }
      return cb();
    });
  }, function (error) {
    if(error) {
      return callback(error);
    }
    return callback(null, mistakes);
  });
}

// Auth to Github using application.
github.authenticate({
  type: 'oauth',
  key: config.github.clientId,
  secret: config.github.clientSecret
});

_getLanguages(function (error, languages) {
  if(error) {
    return console.log(error);
  }
  fs.readFile('./total.json', {encoding: 'utf8'}, function (error, total) {
    if(error && error.code !== 'ENOENT') {
      return callback(error);
    } else if (error && error.code === 'ENOENT') {
      var total = {};
    } else {
      total = JSON.parse(total);
      languages = _.difference(languages, Object.keys(total));
    }
    // For each language, get the top 40 repos.
    async.eachSeries(languages, function (language, callback) {
      console.log('Running for language ' + language);
      github.search.repos({
        q: 'created:>2014-01-01 stars:>100 pushed:<2014-12-01 language:' + language,
        per_page: 40
      }, function (error, data) {
        if(error) {
          return console.log(error);
        }
        console.log('Parsing ' + data.items.length + ' repos.');
        var commits = [];
        // For each repo, get the commits for all pages.
        async.eachLimit(data.items, 40, function (item, callbk) {
          var pages = [1,2,3,4,5,6,7,8,9];
          async.eachLimit(pages, 4, function (page, cb) {
            github.repos.getCommits({
              user: item.owner.login,
              repo: item.name,
              page: page,
              per_page: 100
            }, function (error, commitData) {
              if(error) {
                return cb(error);
              }
              console.log('Parsing ' + commitData.length + ' commits for repo ' + item.name + ' on page ' + page);
              // Add commits to big array.
              for (var i = 0; i < commitData.length; i++) {
                commits.push(commitData[i].commit.message.toLowerCase());
              }
              return cb();
            });
          }, function (error) {
            if(error) {
              return callbk(error);
            }
            setTimeout(function() {
              return callbk();
            }, 1000);
          });
        }, function (error) {
          if(error) {
            return callback(error);
          }
          // Now that we have all the commits, check them against the spell checker and return the mistakes.
          _checkCommits(commits, function (error, mistakes) {
            if(error) {
              return callback(error);
            }
            // Sort mistakes by highest amount of occurances.
            var sorted = _sortProperties(mistakes, true);
            // Add object to language object.
            total[language] = sorted;
            fs.writeFileSync('./total.json', JSON.stringify(total));
            setTimeout(function() {
              return callback();
            }, 2000);
          });
        });
      });
    }, function (error) {
      if(error) {
        return console.log(error);
      }
      // Take the object containing all the languages and their mistakes and write it to a file.
      // fs.writeFileSync('./total.json', JSON.stringify(total));
      // console.log(total);
      console.log('Done.');
    });
  });
});
