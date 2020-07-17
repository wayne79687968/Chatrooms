var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function(server) {
  io = socketio.listen(server); //啟動socketio
  io.set('log level', 1); //日誌輸出的最低階別，0為error，1為warn，2為info，3為debug，預設即輸出所有型別的日誌。
  io.sockets.on('connection', function (socket) {
  //socket連線成功之後觸發，用於初始化
    guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
    //分配初始名稱
    joinRoom(socket, 'Lobby');
    //加入房間
    handleMessageBroadcasting(socket, nickNames);
    //使用者講話
    handleNameChangeAttempts(socket, nickNames, namesUsed);
    //更改名稱
    handleRoomJoining(socket);
    //加入房間
    socket.on('rooms', function() {
      socket.emit('rooms', io.sockets.manager.rooms);
    });
    //
    handleClientDisconnection(socket, nickNames, namesUsed);
    //
  });
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
  var name = 'Guest' + guestNumber;
  nickNames[socket.id] = name;
  //紀錄使用者id對應的名稱
  socket.emit('nameResult', {
    success: true,
    name: name
  });
  //廣播
  namesUsed.push(name);
  //紀錄已使用過的名稱
  return guestNumber + 1;
}

function joinRoom(socket, room) {
  socket.join(room);
  //join相當於為指定的一些客戶端提供了一個名稱空間，所有在房間裡的廣播和通訊都不會影響到房間以外的客戶端。
  currentRoom[socket.id] = room;
  //紀錄目前所在房間
  socket.emit('joinResult', {room: room});
  //廣播
  socket.broadcast.to(room).emit('message', {
    text: nickNames[socket.id] + ' has joined ' + room + '.'
  });
  //廣播，誰加入此房間

  var usersInRoom = io.sockets.clients(room);
  //獲取room中所有的socket
  if (usersInRoom.length > 1) {
  //已經有使用者
    var usersInRoomSummary = 'Users currently in ' + room + ': ';
    for (var index in usersInRoom) {
      var userSocketId = usersInRoom[index].id;\
      //獲取該使用者的socket.id
      if (userSocketId != socket.id) {
        if (index > 0) {
          usersInRoomSummary += ', ';
        }
        usersInRoomSummary += nickNames[userSocketId];
      }
    }
    usersInRoomSummary += '.';
    socket.emit('message', {text: usersInRoomSummary});
    //廣播
  }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
  socket.on('nameAttempt', function(name) {
    if (name.indexOf('Guest') == 0) {
    //name為Guest
      socket.emit('nameResult', {
        success: false,
        message: 'Names cannot begin with "Guest".'
      });
    } else {
      if (namesUsed.indexOf(name) == -1) {
      //檢查是否使用過
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        //紀錄之前的名稱
        namesUsed.push(name);
        //增加使用過的名稱
        nickNames[socket.id] = name;
        //更改使用者名稱
        delete namesUsed[previousNameIndex];
        //刪除舊名稱
        socket.emit('nameResult', {
          success: true,
          name: name
        });
        //廣播
        socket.broadcast.to(currentRoom[socket.id]).emit('message', {
          text: previousName + ' is now known as ' + name + '.'
        });
        //廣播到此房間
      } else {
        socket.emit('nameResult', {
          success: false,
          message: 'That name is already in use.'
        });
        //傳送名稱已使用的訊息
      }
    }
  });
}

function handleMessageBroadcasting(socket) {
  socket.on('message', function (message) {
    socket.broadcast.to(message.room).emit('message', {
      text: nickNames[socket.id] + ': ' + message.text
    });
    //對此房間進行廣播
  });
}

function handleRoomJoining(socket) {
  socket.on('join', function(room) {
    socket.leave(currentRoom[socket.id]);
    //離開當前空間
    joinRoom(socket, room.newRoom);
    //加入新房間
  });
}

function handleClientDisconnection(socket) {
  socket.on('disconnect', function() {
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}
