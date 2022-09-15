define(function (require, exports, module) {
    var Notify = require('grace/ui/notify').Notify;
    var GitCommands = require('./git_commands').GitCommands;
    var failure = GitCommands.failure;
    GitCommands.log = function (ev, prov) {
        prov.log().then(function (logs) {
            Notify.modal({
                header: 'History',
                body: logs.map(printCommit).join(''),
            });
        }, failure);
    };
    //to do goto specific commits
    function entry(arr, key, value) {
        arr.push('<tr><td>' + key + '</td><td>' + value + '</td></tr>');
    }

    function printCommit(item) {
        var log = item.commit;
        var a = ["<table style='margin-bottom:20px'>"];
        var date;
        entry(
            a,
            'commit',
            "<span class='git-commit-sha'>" + item.oid + '</span>'
        );
        if (log.committer) {
            date = log.committer.timestamp;
            if (date) {
                if (!isNaN(log.committer.timezoneOffset)) {
                    date +=
                        (new Date().getTimezoneOffset() -
                            log.committer.timezoneOffset) *
                        60;
                }
            }
            entry(
                a,
                'committer',
                (log.committer.name || '') +
                    (' (' + (log.committer.email || 'no-email') + ')')
            );
        }
        if (log.author) {
            if (!date) {
                date = log.author.timestamp;
                if (date) {
                    if (!isNaN(log.author.timezoneOffset)) {
                        date +=
                            (new Date().getTimezoneOffset() -
                                log.author.timezoneOffset) *
                            60;
                    }
                }
            }
            entry(
                a,
                'author',
                (log.author.name || '') +
                    (' (' + (log.author.email || 'no-email') + ')')
            );
        }
        if (date) {
            entry(a, 'date', new Date(date * 1000));
        }
        entry(a, 'message', log.message);
        a.push('</table>');
        return a.join('');
    }
}); /*_EndDefine*/
