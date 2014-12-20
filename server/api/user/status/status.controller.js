'use strict';

var kue = require('kue');
var moment = require('moment');

function _checkJobLife(lastUpdated, state) {
  var lastUpdated = moment.utc(lastUpdated);
  var now = moment();
  if(state === 'complete') {
    return true;
  } else if (now.diff(lastUpdated) >= 1800000) {
    return true;
  }
  return false;
}

// Get status of a job.
exports.index = function(req, res) {
  kue.Job.get(req.body.id, function (error, job) {
    if(error) {
      return res.status(400).jsonp({message: 'Invalid id.'});
    }
    var isStale = _checkJobLife(parseInt(job.updated_at), job.state());
    if(isStale) {
      job.remove(function (error) {
        if(error) {
          return res.status(500).jsonp({message: 'Issue retreiving job status.'});
        }
        return res.jsonp({job: job});
      });
    } else {
      return res.jsonp({job: job});
    }
  });
};