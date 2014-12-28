'use strict';

var validator = require('validator');
var teacher = require('teacher');
var config = require('../../../config/environment');
var Firebase = require('firebase');
var ref = new Firebase(config.firebase.url);
var ignoreList = [];
var spellRef = ref.child('misspellings');
spellRef.once('value', function (data) {
  ignoreList = data.val();
}, function (error) {
  console.log(error);
});

var _sortProperties = function(obj, isNumericSort) {
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
};

var _getIgnoredList = function (language, callback) {
  return callback(null, Object.keys(_sortProperties(ignoreList[language], true)).slice(0, 21));
};

var _isCapitalized = function (str) {
  var firstChar = str.charAt(0);
  if(firstChar === firstChar.toUpperCase()) {
    return true;
  }
  return false;
};

var _hasPunctuation = function (str) {
  var lastChar = str.charAt(str.length - 1);
  var punctRegex = new RegExp(/[.|?|!]/);
  return punctRegex.test(lastChar);
};

var _hasNewline = function(str) {
  return str.indexOf('\n') !== -1;
};

// Weight for bad words is 50%
// For each commit message we determine a rank and then take the average.
exports.calcBadWords = function (message) {
  var weight = 0.5;
  var message = message.toLowerCase().trim().replace(/[,;.]/g, ' ');
  var badWords = ['shit', 'piss', 'cock', 'cocksucker', 'motherfucker', 'fuck', 'titties', 'tits', 'crap', 'stupid', 'idiot', 'fucker'];
  var nonAlpha = new RegExp(/[^A-Za-z]/);
  // Count how many bad words their are.
  var badWordsFound = {};
  // Split message into words.
  var words = message.split(/[\s\/]+/g).sort();
  // Get rid of non-alphs such as 4 in "I love the number 4." or the & in "I hate using the & character."
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if(nonAlpha.test(word)) {
      words.splice(i, 1);
      continue;
    }
    // If the word is a bad word, add a frequency object to the list.
    if(badWords.indexOf(word) !== -1) {
      badWordsFound[word] = badWordsFound[word] || 0;
      badWordsFound[word]++;
    }
  }
  var badWordAmount = 0;
  if(Object.keys(badWordsFound).length !== 0) {
    badWordAmount = Object.keys(badWordsFound).map(function (key){ return badWordsFound[key]; }).reduce(function (a, b) { return a + b; });
  }
  var wordCount = words.length;
  return (badWordAmount / wordCount) * weight;
};

exports.calcCapitalization = function (message) {
  var weight = 0.03;
  if(_isCapitalized(message)) {
    return 0.0;
  }
  return weight;
};

exports.calcPunctuation = function (message) {
  var weight = 0.03;
  if(_hasPunctuation(message)) {
    return 0.0;
  }
  return weight;
};

exports.calcSpelling = function (message, language, callback) {
  var weight = 0.24;
  language = language.replace('#', 'Sharp');
  _getIgnoredList(language, function (error, ignored) {
    if(error) {
      return callback(error);
    }
    teacher.check({
      text: message,
      custom: ignored
    }, function (error, resp) {
      if(error) {
        return callback(error);
      }
      if(!resp) {
        return callback(null, weight);
      }
      var score = (resp.length / message.length) * weight;
      return callback(null, score);
    });
  });
};

exports.calcSyntax = function (message) {
  var weight = 0.2;
  var summary = message.slice(0, 50);
  if(summary.indexOf('\n') !== -1) {
    summary = message.slice(0, message.indexOf('\n'));
    message = message.slice(message.indexOf('\n'));
  }
  if(summary.length <= 50 && message.indexOf('\n') === -1) {
    console.log('Done due to summary only.');
    return 0.0;
  }
  if(message.charAt(0) === '\n' && message.length > 0) {
    while(message.length !== 0) {
      while(message.charAt(0) === '\n') {
        message = message.slice(1);
      }
      if(message.indexOf('\n') > 72) {
        console.log('Invalid detailed text area on line below:');
        console.log(message.slice(0, message.indexOf('\n')));
        return weight;
      }
      while(message.indexOf('\n') >= 1 && message.indexOf('\n') <= 72) {
        message = message.slice(message.indexOf('\n') + 1);
      }
      if(message.indexOf('\n') === -1) {
        console.log('Done due to finished detail parsing');
        return 0.0;
      }
    }
  } else {
    console.log('Invalid char after summary.');
    console.log(message);
    return weight;
  }
};