'use strict';

// Production specific configuration
// =================================
module.exports = {
  // Server IP
  ip:       process.env.OPENSHIFT_NODEJS_IP ||
            process.env.IP ||
            undefined,

  // Server port
  port:     process.env.OPENSHIFT_NODEJS_PORT ||
            process.env.PORT ||
            8080,
  firebase: {
    url: process.env.GITMAS_FIREBASE_URL || 'https://sizzling-inferno-2672.firebaseio.com/'
  }
};