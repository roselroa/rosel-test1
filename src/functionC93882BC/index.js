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
let processed = ':shipit: Requested';
let dialog;

exports.handler = function(event, context, callback) {
  var users = allowed_users.replace(" ","").split(',');
  var req = qs.parse(event.body);
  console.log(event.body);
  console.log(req);
  if (req.token === slack_verification_token) {
    callback(null,create_response('',200));
    trigger_id = req.trigger_id;
    cmd = req.text;
    if (users.includes(req.user_name)) {
      //check if valid commands
      switch (cmd) {
        case 'test-build-no-param':
          dialog = test_build_no_param_dialog();
          slack_dialog(dialog,context);
          send_response(req.response_url,gotcha);
          break;
        case 'test-build-with-param':
          // create dialog for parameters
          dialog = test_build_with_param_dialog();
          slack_dialog(dialog,context);
          send_response(req.response_url,gotcha);
          break;
        default:
          send_response(req.response_url,'Unknown command :heavy_exclamation_mark:');
      }
    } else {
      // invalid user
      send_response(req.response_url,'Access Denied :heavy_exclamation_mark:');
    }
  } else {
    // invalid token
    callback(null,create_response('Invalid Token',401));
  }
}

function send_response(url,message) {
    var post_data = {
	text: message
    };
    var url_array = url.split('/');
    var hooks = "/commands/";
    hooks.concat(url_array[url_array.length-3],"/",url_array[url_array.length-2],"/",url_array[url_array.length-1]);
    console.log(hooks);
    // the post options
    var post_options = {
        host: 'hooks.slack.com',
        port: '443',
        path: hooks,
        method: 'POST',
        headers: {
            'Content-Type': 'application/application/json',
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

function test_build_no_param_dialog() {
    var dialog = {
        token: slack_access_token,
        trigger_id,
        dialog : JSON.stringify({
            title: 'Submit a Jenkins Job',
            callback_id: 'submit-ticket',
            submit_label: 'Submit',
            elements: [
                {
                    label: 'Request',
                    type: 'text',
                    name: 'title',
                    value: cmd
                }
            ]
        })
    };
    return dialog;
}

function test_build_with_param_dialog() {
    var dialog = {
    token: slack_access_token,
    trigger_id,
    dialog : JSON.stringify({
        title: 'Submit a Jenkins Job',
        callback_id: 'submit-ticket',
        submit_label: 'Submit',
        elements: [
            {
                label: 'Request',
                type: 'text',
                name: 'title',
                value: cmd
            },
            {
                label: 'Parameters',
                type: 'textarea',
                name: 'description',
                optional: true,
                value: 'param1=master\nbool1=true'
            }
        ],
    })
    };
    return dialog;
}

function slack_dialog(dialog,context) {
    var post_data = qs.stringify(dialog);
    // the post options
    var post_options = {
        host: 'slack.com',
        port: '443',
        path: '/api/dialog.open',
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
