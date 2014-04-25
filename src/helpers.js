/*
 * Node GitLab Logging
 *
 * Copyright 2014, Valerian Saliou
 * Author: Valerian Saliou <valerian@valeriansaliou.name>
 */
var _ = require('underscore');

const NS = 'gitlab-logging/helpers';


// Import libs
const log = require('loglevel');
const crypto = require('crypto');


// Process issue checksum
function __checksum(error) {
    const FN = '[' + NS + '.__checksum' + ']';

    return crypto.createHash('md5').update(error).digest('hex');
}


// Process issue data
function __data(error, options, checksum) {
    const FN = '[' + NS + '.__data' + ']';

    var description = {
        head: '#### :zap: Note: this issue has been automatically opened.',
        trace: '```javascript\n' + error + '\n```'
    };

    var data = {};

    data.title = ('[ERROR@' + options.environment + '] Events Server Exception (' + checksum + ')');
    data.description = description.head + '\n\n---\n\n' + description.trace;

    return data;    
}


// Handles project list from GitLab
function __handle_list(gitlab_client, options, error, issues, issue_data) {
    const FN = '[' + NS + '.__handle_list' + ']';

    try {
        if(error !== null) {
            log.error(FN, 'Could not list issues from GitLab');
        } else {
            var existing_issue_id = null;
            var existing_issue_state = null;

            for(var i in issues) {
                if(issues[i].title == issue_data.title) {
                    existing_issue_id = issues[i].id;
                    existing_issue_state = issues[i].state;

                    break;
                }
            }

            if(existing_issue_id !== null) {
                if(existing_issue_state !== 'opened') {
                    __reopen(gitlab_client, options, existing_issue_id, issue_data);
                } else {
                    log.info(FN, 'Issue exists and is already opened, not re-opening');
                }
            } else {
                __create(gitlab_client, options, issue_data);
            }
        }
    } catch(_e) {
        log.error(FN, _e);
    }
}


// Reopens a closed issue
function __reopen(gitlab_client, options, existing_issue_id, issue_data) {
    const FN = '[' + NS + '.__reopen' + ']';

    gitlab_client.issues.update({
        id: options.project_id,
        issue_id: existing_issue_id,
        description: issue_data.description,
        state_event: 'reopen'
    }, function(error, row) {
        __handle_reopen(error, row);
    });
}


// Handles the reopening response
function __handle_reopen(error, row) {
    const FN = '[' + NS + '.__handle_reopen' + ']';

    try {
        if(error !== null || row.state !== 'reopened') {
            log.error(FN, 'Could not re-open existing issue on GitLab');
        } else {
            log.info(FN, 'Re-opened existing issue on GitLab');
        }
    } catch(_e) {
        log.error(FN, _e);
    }
}


// Creates a new issue
function __create(gitlab_client, options, issue_data) {
    const FN = '[' + NS + '.__create' + ']';

    gitlab_client.issues.create({
        id: options.project_id,
        title: issue_data.title,
        description: issue_data.description,
        assignee_id: options.assignee_id,
        labels: 'error, bug, '+options.environment
    }, function(error, row) {
        __handle_create(error, row);
    });
}


// Handles the creation response
function __handle_create(error, row) {
    const FN = '[' + NS + '.__handle_create' + ']';

    try {
        if(error !== null) {
            log.error(FN, 'Could not open issue on GitLab');
        } else {
            log.info(FN, 'Opened issue on GitLab');
        }
    } catch(_e) {
        log.error(FN, _e);
    }
}

function __advance_data(params) {
    const FN = '[' + NS + '.__data' + ']';

    var content = "+   URL : "+params.url+"\n\n";

    content += "# Stacktrace\n\n";
    content += "```javascript\n";
    content += params.stacktrace+'\n';
    content += "```\n\n";

    if(params.vars) {
        content += "# Variables\n\n";
        _.each(params.vars, function(value, key){
            content += "## "+key+"\n\n";
            content += "```javascript\n";
            content += JSON.stringify(value, undefined, 2)+'\n';
            content += "```\n\n";
        });
    }

    var description = {
        head: 'Note: this issue has been automatically opened.',
        trace: content
    };

    var data = {};

    data.title = ('[ERROR] '+params.message);
    data.description = description.head + '\n\n---\n\n' + description.trace;

    return data;
}

// Engages the issue opening process
exports.__engage = function(gitlab_client, error, options) {
    const FN = '[' + NS + '.__engage' + ']';

    try {
        log.info(FN, 'Engaging GitLab issue opening process...');

        // Process issue SHA-1 checksum
        var checksum = __checksum(error);

        // Process issue data
        var issue_data = __data(error, options, checksum);

        // Check if issue already exists
        gitlab_client.issues.list({
            id: options.project_id
        }, function(error, issues) {
            __handle_list(gitlab_client, options, error, issues, issue_data);
        });
    } catch(_e) {
        log.error(FN, _e);
    }
};

exports.__engage_advance = function(gitlab_client, params, options) {
    const FN = '[' + NS + '.__engage' + ']';

    try {
        log.info(FN, 'Engaging GitLab issue opening process...');

        var checksum = __checksum(params.message);

        // Process issue data
        var issue_data = __advance_data(params);

        // Check if issue already exists
        gitlab_client.issues.list({
            id: options.project_id
        }, function(error, issues) {
            __handle_list(gitlab_client, options, error, issues, issue_data);
        });
    } catch(_e) {
        log.error(FN, _e);
    }
};