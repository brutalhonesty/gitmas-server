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
    url: process.env.GITMAS_FIREBASE_URL || ''
  },
  autho: {
    clientSecret: process.env.GITMAS_AUTH0_CLIENT_SECRET || '',
    clientId: process.env.GITMAS_AUTH0_CLIENT_ID || ''
  },
  github: {
    clientId: GITMAS_GITHUB_CLIENT_ID || '',
    clientSecret: GITMAS_GITHUB_CLIENT_SECRET || ''
  }
};