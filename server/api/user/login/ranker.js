'use strict';

var validator = require('validator');
var teacher = require('teacher');

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

exports.isCapitalized = function (str) {
  var firstChar = str.charAt(0);
  if(firstChar === firstChar.toUpperCase()) {
    return true;
  }
  return false;
};