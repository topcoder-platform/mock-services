/*
 * Copyright (C) 2016 TopCoder Inc., All Rights Reserved.
 */

/**
 * Contains all application routes
 */
'use strict';

const fs = require('mz/fs');
const Path = require('path');
const config = require('./config');
const validate = require('./validator').validate;

module.exports = {
  getPresignedUrlForUpload,
  getPresignedUrlForDownload,
  deleteFile,
  upload,
  download,
  members,
  getMemberChallenges,
  getMemberGroups,
  getProject,
  authorizations,
  searchMember,
  getSubGroups,
  getGroupMembers,
  getParentGroups
};

const files = {};

/**
 * Encode s3 path to safe format for disk
 * @param  {String} filePath the file path to encode
 * @return {String}          encoded path
 */
function _encodePath(filePath) {
  return `S3_FAKE_FILE_${new Buffer(filePath).toString('base64')}`;
}

/**
 * Get file or throw error if not exists
 * @param  {String} filePath the file path
 * @return {Object}          the file
 */
function _getFile(filePath) {
  const file = files[filePath];
  if (!file) {
    const error = new Error('File not found');
    error.status = 404;
    throw error;
  }
  return file;
}

/**
 * Get Presigned URL for upload to S3
 */
function* getPresignedUrlForUpload() {
  validate(this.request.body, {
    param: {
      filePath: String,
      contentType: 'String?',
      isPublic: 'bool?'
    }
  });
  const data = this.request.body.param;
  const encoded = new Buffer(JSON.stringify(data)).toString('base64');
  const url = `${config.BASE_URL}/mock-upload?param=${encoded}`;
  const result = {
    filePath: data.filePath,
    preSignedURL: url,
    contentType: data.contentType,
    public: data.isPublic
  };
  this.mockSuccess(result);
}

/**
 * Get Presigned URL for download from S3
 */
function* getPresignedUrlForDownload() {
  validate(this.request.body, {
    param: {
      filePath: String,
      size: 'string?'
    }
  });
  const param = this.request.body.param;
  const data = _getFile(param.filePath);
  const url = `${config.BASE_URL}/mock-download?filePath=${encodeURIComponent(data.filePath)}`;
  const result = {
    filePath: data.filePath,
    preSignedURL: url,
    contentType: data.contentType,
    public: data.isPublic,
    size: param.size || ''
  };
  this.mockSuccess(result);
}

/**
 * Delete file from S3
 */
function* deleteFile() {
  validate(this.query, {
    filter: String
  });
  const split = this.query.filter.split('=');
  if (split.length !== 2 || split[0] !== 'filePath') {
    this.throw('Invalid filter', 400);
    return;
  }
  const filePath = split[1];
  const data = _getFile(filePath);
  const result = {
    filePath: data.filePath,
    preSignedURL: ''
  };
  const path = Path.join(config.UPLOAD_PATH, _encodePath(filePath));
  yield fs.unlink(path);
  delete files[filePath];
  this.mockSuccess(result);
}

/**
 * Upload file using a presigned url
 */
function* upload() {
  validate(this.query, {
    param: String
  });
  let data;
  try {
    data = JSON.parse(new Buffer(this.query.param, 'base64').toString('utf8'));
  } catch (e) {
    this.throw('Invalid param', 400);
    return;
  }
  if (!Number(this.request.header['content-length'])) {
    this.throw('Empty request body', 400);
    return;
  }
  yield new Promise((resolve, reject) => {
    const path = Path.join(config.UPLOAD_PATH, _encodePath(data.filePath));
    console.log('saving file to', path);
    const stream = fs.createWriteStream(path);
    this.req.pipe(stream);
    this.req.on('end', () => {
      files[data.filePath] = data;
      resolve();
    });
    this.req.on('error', reject);
  });
  this.body = 'fake s3 upload ok';
}

/**
 * Download file using a presigned url
 */
function* download() {
  validate(this.query, {
    filePath: String
  });
  const filePath = this.query.filePath;
  const data = _getFile(filePath);
  const path = Path.join(config.UPLOAD_PATH, _encodePath(filePath));
  const fileName = filePath.split('/').pop();
  yield fs.stat(path); // will throw if not exists
  this.set('Content-Type', data.contentType || 'application/octet-stream');
  this.set('Content-Disposition', `inline; filename=${encodeURIComponent(fileName)}`);
  this.body = fs.createReadStream(path);
}

function* members() {
  console.log(this);

  this.body = {"handle": this.params.handle};
}

function* getMemberGroups() {
  let memberId = this.request.query.memberId;
  let groups = [
        {
          "id": 14,
          "name": "TopCoder Studio User",
          "description": "This is an example group1.",
          "modifiedBy": 12345678,
          "modifiedAt": "2015-09-25T03:56:16.000Z",
          "createdBy": 12345678,
          "createdAt": "2015-09-25T03:56:16.000Z"
        },
        {
          "id": "10",
          "name": "Competition User",
          "description": "This is an example group2.",
          "modifiedBy": 12345678,
          "modifiedAt": "2016-05-29T12:12:52.000Z",
          "createdBy": 12345678,
          "createdAt": "2015-09-25T03:56:16.000Z"
        }
      ];
  if (typeof(memberId) === "undefined" || memberId == null){

    groups.push({
       "id": 2000115,
       "name": "Admin"
    });
    groups.push({
       "id": 15471940,
       "name": "Member Admins"
    });
  } else if(memberId == "124916"){
    groups = [];
  }
  
  this.body = {
    "id": "-6b6bcc07:15bae231ad8:-5d65",
    "result": {
      "success": true,
      "status": 200,
      "metadata": null,
      "content": groups,
      "version": "v3"
    }
  };
}

function *getSubGroups() {
  this.body = {
    "id": "-6b6bcc07:15bae231ad8:-5d65",
    "result": {
      "success": true,
      "status": 200,
      "metadata": null,
      "content": {
          "id": "1",
          "name": "ExampleGroup1",
          "description": "This is an example group1.",
          "modifiedBy": 12345678,
          "modifiedAt": "2015-09-25T03:56:16.000Z",
          "createdBy": 12345678,
          "createdAt": "2015-09-25T03:56:16.000Z",
          "subGroups": [
            {
              "id": "2",
              "name": "ChildGroup1",
              "description": "This is an example group2.",
              "modifiedBy": 12345678,
              "modifiedAt": "2015-09-25T03:56:16.000Z",
              "createdBy": 12345678,
              "createdAt": "2015-09-25T03:56:16.000Z",
              "subGroups": [
                {
                  "id": "4",
                  "name": "ChildGroup4",
                  "description": "This is an example group4.",
                  "modifiedBy": 12345678,
                  "modifiedAt": "2015-09-25T03:56:16.000Z",
                  "createdBy": 12345678,
                  "createdAt": "2015-09-25T03:56:16.000Z"
                }
              ]
            },
            {
              "id": "3",
              "name": "ChildGroup2",
              "description": "This is an example group3.",
              "modifiedBy": 12345678,
              "modifiedAt": "2015-09-25T03:56:16.000Z",
              "createdBy": 12345678,
              "createdAt": "2015-09-25T03:56:16.000Z"
            }
          ]
      },
      "version": "v3"
    }
  };
}

function *getParentGroups() {
  this.body = {
    "id": "-13eae784:15ea2013504:-7ff7",
    "result": {
        "success": true,
        "status": 200,
        "metadata": null,
        "content": {
            "id": "4",
            "modifiedBy": "1",
            "modifiedAt": "2017-08-21T16:00:00.000Z",
            "createdBy": "1",
            "createdAt": "2017-08-21T16:00:00.000Z",
            "name": "group 4",
            "description": "group 4 desc",
            "privateGroup": false,
            "selfRegister": false,
            "subGroups": null,
            "parentGroup": {
                "id": "2",
                "modifiedBy": "1",
                "modifiedAt": "2017-08-21T16:00:00.000Z",
                "createdBy": "1",
                "createdAt": "2017-08-21T16:00:00.000Z",
                "name": "group 2",
                "description": "group 2 desc",
                "privateGroup": false,
                "selfRegister": false,
                "subGroups": null,
                "parentGroup": {
                    "id": "1",
                    "modifiedBy": "1",
                    "modifiedAt": "2017-08-21T16:00:00.000Z",
                    "createdBy": "1",
                    "createdAt": "2017-08-21T16:00:00.000Z",
                    "name": "group 1",
                    "description": "group 1 desc",
                    "privateGroup": false,
                    "selfRegister": false,
                    "subGroups": null,
                    "parentGroup": null
                }
            }
        }
    },
    "version": "v3"
  };
}

function* getMemberChallenges() {
  this.body = {
    "id": "-33b3bb18:1544d6226bd:-757a",
    "result": {
      "success": true,
      "status": 200,
      "metadata": {
        "fields": null,
        "totalCount": 1
      },
      "content": [{
        "updatedAt": "2016-02-01T23:29Z",
        "createdAt": "2016-02-02T02:51Z",
        "createdBy": "8547899",
        "updatedBy": "8547899",
        "technologies": "",
        "status": "ACTIVE",
        "track": "DESIGN",
        "subTrack": "DESIGN_FIRST_2_FINISH",
        "name": "Submission Test Challenge",
        "reviewType": "INTERNAL",
        "id": 30049551,
        "forumId": 593936,
        "numSubmissions": 7,
        "numRegistrants": 1,
        "registrationStartDate": "2016-02-01T23:23Z",
        "registrationEndDate": "2016-03-02T23:23Z",
        "checkpointSubmissionEndDate": null,
        "submissionEndDate": "2016-03-02T23:29Z",
        "platforms": "",
        "numberOfCheckpointPrizes": null,
        "totalCheckpointPrize": null,
        "totalPrize": 200.0,
        "isPrivate": false,
        "upcomingPhase": null,
        "projectId": 7377,
        "projectName": "TC - Web Based Arena",
        "currentPhases": [{
          "updatedAt": "2016-02-01T18:51Z",
          "createdAt": "2016-02-01T16:51Z",
          "createdBy": "8547899",
          "updatedBy": "22841596",
          "challengeId": 30049551,
          "id": 733709,
          "phaseType": "Registration",
          "phaseStatus": "Open",
          "scheduledStartTime": "2016-02-01T23:23Z",
          "scheduledEndTime": "2016-03-02T23:23Z",
          "actualStartTime": "2016-02-01T23:23Z",
          "actualEndTime": null,
          "fixedStartTime": "2016-02-01T14:00Z",
          "duration": 2592000000
        }, {
          "updatedAt": "2016-02-01T18:51Z",
          "createdAt": "2016-02-01T16:51Z",
          "createdBy": "8547899",
          "updatedBy": "22841596",
          "challengeId": 30049551,
          "id": 733710,
          "phaseType": "Review",
          "phaseStatus": "Open",
          "scheduledStartTime": "2016-02-01T23:51Z",
          "scheduledEndTime": "2016-03-02T23:51Z",
          "actualStartTime": "2016-02-01T23:51Z",
          "actualEndTime": null,
          "fixedStartTime": null,
          "duration": 2592000000
        }, {
          "updatedAt": "2016-02-01T18:51Z",
          "createdAt": "2016-02-01T16:51Z",
          "createdBy": "8547899",
          "updatedBy": "22841596",
          "challengeId": 30049551,
          "id": 11,
          "phaseType": "Submission",
          "phaseStatus": "Open",
          "scheduledStartTime": "2016-02-01T23:29Z",
          "scheduledEndTime": "2016-03-02T23:29Z",
          "actualStartTime": "2016-02-01T23:29Z",
          "actualEndTime": null,
          "fixedStartTime": null,
          "duration": 2592000000
        }],
        "submissionViewable": false,
        "userId": 22781893,
        "handle": "iamtong",
        "userDetails": {
          "roles": ["Submitter"],
          "hasUserSubmittedForReview": true,
          "submissionReviewScore": null,
          "winningPlacements": null,
          "submissions": [{
            "id": 202842,
            "submittedAt": "2016-02-02T04:51Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 202843,
            "submittedAt": "2016-02-02T04:57Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 202844,
            "submittedAt": "2016-02-02T04:58Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 202845,
            "submittedAt": "2016-02-02T04:59Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 202846,
            "submittedAt": "2016-02-02T05:10Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 202847,
            "submittedAt": "2016-02-02T05:22Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 202851,
            "submittedAt": "2016-02-02T00:38Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203080,
            "submittedAt": "2016-03-10T23:17Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203090,
            "submittedAt": "2016-03-12T02:44Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203100,
            "submittedAt": "2016-03-12T10:01Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203101,
            "submittedAt": "2016-03-12T10:05Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203140,
            "submittedAt": "2016-03-16T02:15Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203240,
            "submittedAt": "2016-03-17T04:49Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203372,
            "submittedAt": "2016-03-29T06:45Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203373,
            "submittedAt": "2016-03-29T06:44Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203374,
            "submittedAt": "2016-03-29T06:46Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203375,
            "submittedAt": "2016-03-29T06:47Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203376,
            "submittedAt": "2016-03-29T06:49Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203377,
            "submittedAt": "2016-03-29T06:49Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203378,
            "submittedAt": "2016-03-29T06:49Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203379,
            "submittedAt": "2016-03-29T07:05Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203380,
            "submittedAt": "2016-03-29T07:05Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203381,
            "submittedAt": "2016-03-29T07:05Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203430,
            "submittedAt": "2016-03-29T21:18Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203492,
            "submittedAt": "2016-03-31T16:26Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203590,
            "submittedAt": "2016-04-04T22:25Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203600,
            "submittedAt": "2016-04-04T22:25Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203602,
            "submittedAt": "2016-04-04T23:46Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203604,
            "submittedAt": "2016-04-04T22:25Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203611,
            "submittedAt": "2016-04-04T22:25Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203620,
            "submittedAt": "2016-04-05T00:10Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203644,
            "submittedAt": "2016-04-05T20:03Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203760,
            "submittedAt": "2016-04-06T02:12Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203941,
            "submittedAt": "2016-04-06T20:22Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203942,
            "submittedAt": "2016-04-06T20:24Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203950,
            "submittedAt": "2016-04-06T20:38Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 203960,
            "submittedAt": "2016-04-06T20:52Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 204080,
            "submittedAt": "2016-04-06T20:10Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 204273,
            "submittedAt": "2016-04-12T15:24Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }, {
            "id": 204274,
            "submittedAt": "2016-04-14T15:06Z",
            "status": "Active",
            "score": null,
            "placement": null,
            "challengeId": 30049551,
            "type": "Contest Submission",
            "submissionImage": null
          }]
        }
      }]
    },
    "version": "v3"
  }
}

function* getProject404() {
    this.body = {
        "id": "2eb5550a-f761-4923-baf6-942782488023",
        "result": {
            "success": false,
            "status": 404,
            "content": {
            "message": "project not found for id 13"
            },
            "debug": "Error: project not found for id 13\n    at null.<anonymous> (/usr/src/app/dist/routes/projects/get.js:57:20)\n    at wrapped (/usr/src/app/node_modules/newrelic/lib/transaction/tracer/index.js:161:28)\n    at Promise.linkTransaction (/usr/src/app/node_modules/newrelic/lib/instrumentation/promise.js:289:65)\n    at Promise.wrapped (/usr/src/app/node_modules/newrelic/lib/transaction/tracer/index.js:161:28)\n    at Promise.proxyWrapper (/usr/src/app/node_modules/newrelic/lib/instrumentation/promise.js:300:23)\n    at __NR_wrappedThenHandler (/usr/src/app/node_modules/newrelic/lib/instrumentation/promise.js:461:26)\n    at null.<anonymous> (/usr/src/app/node_modules/continuation-local-storage/context.js:76:17)\n    at wrapped (/usr/src/app/node_modules/newrelic/lib/transaction/tracer/index.js:161:28)\n    at Promise.linkTransaction (/usr/src/app/node_modules/newrelic/lib/instrumentation/promise.js:289:65)\n    at Promise.wrapped (/usr/src/app/node_modules/newrelic/lib/transaction/tracer/index.js:161:28)\n    at Promise.proxyWrapper (/usr/src/app/node_modules/newrelic/lib/instrumentation/promise.js:300:23)\n    at __NR_wrappedThenHandler (/usr/src/app/node_modules/newrelic/lib/instrumentation/promise.js:461:26)\n    at tryCatcher (/usr/src/app/node_modules/bluebird/js/release/util.js:16:23)\n    at Promise._settlePromiseFromHandler (/usr/src/app/node_modules/bluebird/js/release/promise.js:504:31)\n    at Promise._settlePromise (/usr/src/app/node_modules/bluebird/js/release/promise.js:561:18)\n    at Promise._settlePromise0 (/usr/src/app/node_modules/bluebird/js/release/promise.js:606:10)"
        }
    }
}

function* getProject() {
  this.body = {
    "id": "62317aa2-24a7-4c8f-af32-aa2f66a5ef2a",
    "version": "v4",
    "result": {
        "success": true,
        "status": 200,
        "content": {
        "id": 139,
        "directProjectId": null,
        "billingAccountId": null,
        "name": "Tony Test 1",
        "description": "efesr sdfsd fsfsf sdf s",
        "external": null,
        "estimatedPrice": null,
        "actualPrice": null,
        "terms": [],
        "type": "visual_prototype",
        "status": "draft",
        "details": {
            "appType": "ios",
            "devices": [
            "phone",
            "desktop"
            ],
            "utm": {
            "code": ""
            }
        },
        "challengeEligibility": [],
        "createdAt": "2016-08-09T02:22:31.000Z",
        "updatedAt": "2016-08-09T02:22:31.000Z",
        "createdBy": 8547899,
        "updatedBy": 8547899,
        "members": [
            {
            "id": 268,
            "userId": 8547899,
            "role": "customer",
            "isPrimary": true,
            "createdAt": "2016-08-09T02:22:31.000Z",
            "updatedAt": "2016-08-09T02:22:31.000Z",
            "createdBy": 8547899,
            "updatedBy": 8547899,
            "projectId": 139
            }
        ],
        "attachments": []
        },
        "metadata": {
        "totalCount": 1
        }
    }
    }
}

function* authorizations() {
  this.body = {
    "result" : {
      "content": {
        "token": "FAKE-TOKEN"
      }
    }
  }
}

const MEMBERS = [
   {
      "userId":132456,
      "handle":"heffan"
   },
   {
      "userId":20,
      "handle":"dok_tester"
   },
   {
      "userId":21,
      "handle":"dok_tester1"
   },
   {
      "userId":132457,
      "handle":"super"
   },
   {
      "userId":132458,
      "handle":"user"
   },
   {
      "userId":124764,
      "handle":"Hung"
   },
   {
      "userId":124766,
      "handle":"twight"
   },
   {
      "userId":124772,
      "handle":"Partha"
   },
   {
      "userId":124776,
      "handle":"sandking"
   },
   {
      "userId":124834,
      "handle":"lightspeed"
   },
   {
      "userId":124835,
      "handle":"reassembler"
   },
   {
      "userId":124836,
      "handle":"annej9ny"
   },
   {
      "userId":124852,
      "handle":"plinehan"
   },
   {
      "userId":124853,
      "handle":"chelseasimon"
   },
   {
      "userId":124856,
      "handle":"wyzmo"
   },
   {
      "userId":124857,
      "handle":"cartajs"
   },
   {
      "userId":124861,
      "handle":"ksmith"
   },
   {
      "userId":124916,
      "handle":"Yoshi"
   },
   {
      "userId":22770213,
      "handle":"Applications"
   },
   {
      "userId":22719217,
      "handle":"Components"
   },
   {
      "userId":22719218,
      "handle":"liquid_user"
   },
   {
      "userId":22873364,
      "handle":"LCSUPPORT"
   }
];

const GROUPS = [2000115, 10, 15471940, 14];

function* searchMember(){
  var q = this.params.handle;
  this.body = {
    "id": "105bfe9c-e85a-4d74-8a39-81023565053b",
    "result": {
      "success": true,
      "status": 200,
      "metadata": null,
      "content": MEMBERS.filter(function(member){
        return member['handle'].toLowerCase().indexOf(q.toLowerCase()) > -1
        })
    }
  }
}

function* getGroupMembers(){
  var groupId = Number(this.params.groupId);
  var members = [];
  switch(groupId){
    case GROUPS[0]:
      MEMBERS.slice(0,5).forEach(function(el){
        members.push({"memberId": el["userId"], "membershipType" : "user"});
      });
      break;
    case GROUPS[1]:
      MEMBERS.slice(5,12).forEach(function(el){
        members.push({"memberId": el["userId"], "membershipType" : "user"});
      });
      members.push({"memberId": 14, "membershipType" : "group"})
      break;
    case GROUPS[2]:
      MEMBERS.slice(12,14).forEach(function(el){
        members.push({"memberId": el["userId"], "membershipType" : "user"});
      });
      members.push({"memberId": 2000115, "membershipType" : "group"})
      break;
    case GROUPS[3]:
      MEMBERS.slice(14).forEach(function(el){
        members.push({"memberId": el["userId"], "membershipType" : "user"});
      });
      break;
    }
    this.body = {
      "id": "105bfe9c-e85a-4d74-8a39-81023565053c",
      "result": {
        "success": true,
        "status": 200,
        "metadata": null,
        "content": members
      }
    }
  }
