const net = require('net');
const database = require('./database');
const Chatroom = require('./chatroom');
const Client = require('./client');
const Users = require('./user');
const gd = new Chatroom('General Discussion');
const moment = require('moment');

const config = require('./config');

const clientServer = net.createServer((c) => { //'connection' listener
  c.on('end', () => {
    if(c.client != null)
      c.client.cleanUp();

    console.log('Client disconnected');
  });

  c.on('close', () => {
    if(c.client != null)
      c.client.cleanUp();

    console.log('Client closed');
  });

  c.on('data', (raw) => {
    var data = JSON.parse(raw);

    switch(data.type) {
      case "auth":
        var result = c.client.authCheck(data.ident);
        if(result) {
          console.log("Connected (" + c.client.blid + ", " + data.ident + ")");
          c.write('{"type":"auth", "status":"success"}\r\n');
          c.blid = c.client.blid;
          c.user = Users.getByBlid(c.client.blid);

          if(c.user.clients.length > 0) {
            c.user.clients[0].disconnect(1);
          }

          //console.log("[debug] addClient");
          c.user.addClient(c.client);
          //console.log("[debug] setUsername");
          c.user.setUsername(c.client.username);

          c.client.sendFriendsList();
          c.client.sendFriendRequests();
        } else {
          console.log('Failed');
          c.write('{"type":"auth", "status":"failed"}\r\n');
          return;
        }
        gd.addUser(c.client);

        // TODO send friend requests
        // TODO send pub room listing

        //gd.sendMessage(c.client, "hey guys!!!");
        break;

      //================================
      // rooms
      //================================

      case "roomChat":
        gd.sendMessage(c.client, data.message);
        break;

      case "roomLeave":
        gd.removeUser(c.client, 0);
        break;

      case "roomJoin":
        gd.addUser(c.client);
        break;

      case "roomAwake":
        dat = {
          "type": "roomAwake",
          "id": gd.id,
          "user": c.blid,
          "awake": data.bool
        };
        gd.transmit(JSON.stringify(dat));
        break;

      case "roomCommand":
        gd.onCommand(c.client, data.message);
        break;

      //================================
      // messages
      //================================

      case "message":
        target = Users.getByBlid(data.target);
        if(target.isOnline()) {
          obj = {
            "type": "message",
            "message": data.message,
            "sender": c.client.username,
            "sender_id": c.blid,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          target.messageClients(JSON.stringify(obj));
        } else {
          obj = {
            "type": "messageNotification",
            "message": "User is offline.",
            "chat_blid": data.target,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          c.write(JSON.stringify(obj) + '\r\n');
        }
        break;

        case "messageTyping":
          target = Users.getByBlid(data.target);
          obj = {
            "type": "messageTyping",
            "typing": data.typing,
            "sender": c.blid,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          target.messageClients(JSON.stringify(obj));
          break;

        case "messageClose":
          target = Users.getByBlid(data.target);
          obj = {
            "type": "messageNotification",
            "message": "User closed chat window.",
            "chat_blid": data.target,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          target.messageClients(JSON.stringify(obj));
          break;

      //================================
      // friends
      //================================

      case "locationUpdate":
        if(data.action == "playing") {
          c.client.setLocation(data.action, data.location);
        } else {
          c.client.setLocation(data.action);
        }
        break;

      case "locationGet":
        // TODO privacy settings
        target = Users.getByBlid(data.target);
        obj = {
          "type": "location",
          "blid": c.client.blid,
          "activity": c.client.activity,
          "location": c.client.location
        };
        target.messageClients(JSON.stringify(obj));
        break;

      case "friendRequest":
        target = Users.getByBlid(data.target);
        target.newFriendRequest(c.user);
        break;

      case "friendAccept":
        c.user.acceptFriend(data.blid);
        break;

      case "friendDecline":
        c.user.declineFriend(data.blid);
        break;

      default:
        console.log("unhandled: " + data.type);
    }
      //pushNotification(c, "Connected", "Connected to Glass Notification server", "star", "5000", "");
      //pushNotification(c, "Blockoworld", "Blockoworld is happening RIGHT NOW! Click me for more information.", "bricks", "0", "");
  });

  c.on('error', (err) => {
    if(err == 'EPIPE' || err == 'ECONNRESET') {
      //not really an error, just a disconnect we didnt catch
    } else {
      console.error('Caught error', err);
    }
    c.client.cleanUp();
  });

  c.client = new Client(c);
});

const noteServer = net.createServer((c) => { //'connection' listener
  console.log('note connected');
  c.on('end', () => {
    console.log('note disconnected');
  });

  c.on('data', (data) => {
    obj = JSON.parse(data);

    if(obj.type == 'notification') {
      user = Users.getByBlid(obj.target);
      dat = {
        "type":"notification",
        "title":obj.title,
        "text":obj.text,
        "image":obj.image,
        "duration":obj.duration,
        "callback":obj.callback
      };
      user.messageClients(JSON.stringify(dat));
    }
  });

  c.on('error', (err) => {
    //console.error('Caught error', err);
  });
});

clientServer.listen(config.basePort, () => { //'listening' listener
  console.log('Bound ' + config.basePort);
});

noteServer.listen(config.basePort+1, () => { //'listening' listener
  console.log('Bound ' + (config.basePort+1) + '\r\n');
});

function pushNotification(con, title, text, image, duration, callback) {
  dat = {
    "type":"notification",
    "title":title,
    "text":text,
    "image":image,
    "duration":duration,
    "callback":callback
  };

  str = JSON.stringify(dat);
  //console.log(str);
  con.write(str + '\r\n');
}
