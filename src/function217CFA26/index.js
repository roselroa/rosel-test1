'use strict';
const qs = require('querystring');
const https = require('https');
const slack_access_token = process.env['SLACK_ACCESS_TOKEN'];
const slack_verification_token = process.env['SLACK_VERIFICATION_TOKEN'];
const allowed_users = process.env['ALLOWED_USERS'];
const jenkins_server = process.env['JENKINS_SERVER'];
const jenkins_token = process.env['JENKINS_TOKEN'];
// valid commands, update if you need to add jenkins job can be triggered.
const valid_cmds = ['test-build-no-param','test-build-with-param','Devx-Create'];
let cmd;
let trigger_id;
let gotcha = ':shipit: Got it :ok_hand:';
let dialog;

exports.handler = function(event, context, callback) {
  console.log(event.body);
  var req = qs.parse(event.body);
  console.log(req);
  var j_req = JSON.parse(req.payload);
  cmd = j_req.submission.title;
  var d_token = j_req.token;
  var jenkins_all;
  var jenkins_path;
  var jenkins_param;
  var jenkins_data;
  var jenkins_head;
  if (d_token === slack_verification_token) {
    if (valid_cmds.includes(cmd)) {
      jenkins_data = {
        job: cmd,
        token: jenkins_token
      };
      jenkins_head = qs.stringify(jenkins_data);
      switch (cmd) {
        case 'test-build-no-param':
          jenkins_all = jenkins_head;
          jenkins_path = '/buildByToken/build';
          break;
        default:
          jenkins_param = j_req.submission.description.replace(/(?:\r\n|\r|\n)/g, '&');
          jenkins_all = jenkins_head.concat('&',jenkins_param);
          jenkins_path = '/buildByToken/buildWithParameters';
      }
      jenkins_post(jenkins_path,jenkins_all);
      confirm_dialog(context,j_req);
      callback(null, create_response('',200));
    } else {
      callback(null, create_response('Invalid Command',401));
    }
  } else {
    callback(null, create_response('Invalid Token',401));
  }
}

function create_response(message,code) {
    var response = {
        statusCode: code,
        headers: {
            "x-custom-header" : "slack-cmd-endpoint"
        },
        body: message
    };
    return response;
}

function jenkins_post(jenkins_path,post_data) {
    // the post options
    var post_options = {
        host: jenkins_server,
        port: '443',
        path: jenkins_path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(post_data)
        }
    };
    // Set up the request
    var post_req = https.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
            context.succeed();
        });
        res.on('error', function (e) {
            console.log("Got error: " + e.message);
            context.done(null, 'FAILURE');
        });
    });
    // post the data
    post_req.write(post_data);
    post_req.end();
}

function confirm_dialog(context,param) {
    // send confirmation to slack
    var confirm_data = {
        token: slack_access_token,
        channel: param.user.id,
        text: 'Jenkins request created!',
        attachments: JSON.stringify([
            {
                title: 'Created for '+param.user.name,
                title_link: 'https://jenkins.devx.benefitcosmetics.com/',
                text: '',
                fields: [
                    {
                        title: 'Request',
                        value: param.submission.title || 'None provided',
                    },
                    {
                        title: 'Parameters',
                        value: param.submission.description || 'None provided',
                    }
                ],
            },
        ])
    };

    var post_data = qs.stringify(confirm_data);
    // the post options
    var post_options = {
        host: 'slack.com',
        port: '443',
        path: '/api/chat.postMessage',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(post_data)
        }
    };
    // Set up the request
    var post_req = https.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
            context.succeed();
        });
        res.on('error', function (e) {
            console.log("Got error: " + e.message);
            context.done(null, 'FAILURE');
        });
    });
    // post the data
    post_req.write(post_data);
    post_req.end();
}
