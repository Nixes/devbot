var Botkit = require('botkit');
var os = require('os');
var fs = require('fs');

var configFile = fs.readFileSync('config.json');
console.log("Loading config file: ");
console.log(configFile);
var config = JSON.parse(configFile);

if (!config.token) {
    console.log('Error: Specify token in config.json');
    process.exit(1);
}

var controller = Botkit.slackbot({
    debug: true,
});

var bot = controller.spawn({
    token: config.token
}).startRTM();

class DevServerManager {
  constructor() {
  }
  setCurrentOwnerId(id) {
      this.owner_id = id;
      this.owner_set_time = new Date();
  }
  getOwnerSetTime() {
      return this.owner_set_time;
  }
  getOwnerUsageDuration() {
      let current_time = new Date();
      // if owner set time exists
      if ( this.getOwnerSetTime() ) {
          return current_time - this.getOwnerSetTime();
      }
  }
  getCurrentOwnerId() {
      return this.owner_id;
  }
  // returns user object
  getCurrentOwner(callback) {
      bot.api.users.info({ user:this.getCurrentOwnerId() }, callback);
  }
}
var devServerManager = new DevServerManager();

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '. Bleep bloop');
        } else {
            bot.reply(message, "Hello. Bleep bloop, I'm a bot");
        }
    });
});

controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {
    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());

    bot.reply(message,
        ':robot_face: I am a bot named <@' + bot.identity.name +
         '>. I have been running for ' + uptime + ' on ' + hostname + '.');

});

controller.hears([
    "who'?s (using|is using) dev\??",
    "(anyone|still) (use|using|on) dev\??",
    "is (anyone|still) (using|on) dev\??",
],'direct_message,direct_mention,mention',function(bot, message) {

        devServerManager.getCurrentOwner(function(err, response) {
            if (response && response["user"]) {
                 var user = response["user"];
                bot.reply(message,'<@'+user.name+'> has reserved the dev server');
            } else {
                bot.reply(message,'No one is currently reserving the dev server.');
            }
        });
    });

controller.hears([
    "I'?m (using|on|borrowing) dev",
    "I'?m (using|on|borrowing) dev server",
    "I (using|on|borrowing) dev",
    "I (using|on|borrowing) dev server"
],'direct_message,direct_mention,mention',function(bot, message) {
        console.log('Message User: ');
        console.log(message.user);
        bot.api.users.info({ user:message.user }, function (err,response) {
            // if we got a user, read id
            if (response && response["user"]) {
                var user = response["user"];
                bot.reply(message,'Reserving dev server for <@'+user.name+'>!');
                devServerManager.setCurrentOwnerId(message.user);
            } else {
                bot.reply(message,"I couldn't find you on slack so I can't reserve it for you.");
            }
        });
    });
controller.hears([
    "I'?m (finished|done) (using|borrowing) dev",
    "I'?ve finished (using|borrowing) dev",
],'direct_message,direct_mention,mention',function(bot, message) {
        console.log('Message User: ');
        console.log(message.user);
        if (message.user === devServerManager.getCurrentOwnerId()) {
            bot.reply(message,"You are no longer using dev");
            devServerManager.setCurrentOwnerId();
        }
    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minutes';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hours';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
