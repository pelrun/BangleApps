
var pako = require('pako.js');
//var CRC = require('crc32.js');

function showLog(txt) {
  console.log(txt);
}
function showError(txt) {
  console.log(txt);
}

process.on('uncaughtException', function(e) {
  console.log(e,e.stack?"\n"+e.stack:"");
});

METER_SERVICE = "1BC5FFA0-0200-62AB-E411-F254E005DBD4";
METER_SERIN = "1BC5FFA1-0200-62AB-E411-F254E005DBD4";
METER_SEROUT = "1BC5FFA2-0200-62AB-E411-F254E005DBD4";

OAD_SERVICE_UUID = "1BC5FFC0-0200-62AB-E411-F254E005DBD4";
OAD_IMAGE_IDENTIFY = "1BC5FFC1-0200-62AB-E411-F254E005DBD4";
OAD_IMAGE_BLOCK = "1BC5FFC2-0200-62AB-E411-F254E005DBD4";
OAD_REBOOT = "1BC5FFC3-0200-62AB-E411-F254E005DBD4";

function MeterSerializer(p, meter, callback) {
  this.P = p;
  this.meter = meter;
  this.service = null;
  this.reader = null;
  this.writer = null;
  this.desc = null;
  this.gatt = null;

  E.showMenu();
  E.showMessage("connecting");

  this.P.gatt.connect().then((g) => {
    this.gatt = g;
    return this.gatt.getPrimaryService(METER_SERVICE);
  }).then((sv) => {
    service = sv;
    return service.getCharacteristic(METER_SERIN);
  }).then((ch) => {
    this.writer = ch;
    return service.getCharacteristic(METER_SEROUT);
  }).then((ch) => {
    this.reader = ch;
    ch.on('characteristicvaluechanged', (event) => {
      this.meter.readFromMeter(null, event.target.value.buffer);
    });
    return ch.startNotifications();
  }).then(() => {
    console.log("Connected!");
    return callback();
  });
  // .catch(() => {
  //     console.log("Connection failed!");
  //     if (this.gatt && this.gatt.connected) {
  //         this.gatt.disconnect();
  //     }
  // });
}

MeterSerializer.prototype.handleError = function (err) {
  if (err) {
    showLog("Error: " + err);
  }
}

MeterSerializer.prototype.disconnect = function () {
  this.gatt.disconnect();
  this.gatt = {};
}
MeterSerializer.prototype.write = function (bytes) {
  this.writer.writeValue(bytes);
}

MeterSerializer.prototype.onNotify = function (err) {
  //if(this.desc)
  //this.reader.readValue(this.meter.readFromMeter.bind(this));
}
MeterSerializer.prototype.onData = function (data, isNotification) {
  this.meter.readFromMeter(null, data.target.value.buffer);
}
/*
MeterSerializer.prototype.onDescData = function(data, isNotification) {
    //print(".\n");
    if(isNotification) {
        if(this.desc)
            this.desc.readValue(this.meter.readFromMeter.bind(this));
    }
}
*/

function NTYPE() {
}

NTYPE.PLAIN = 0;  // May be an informational node, or a choice in a chooser
NTYPE.LINK = 1;  // A link to somewhere else in the tree
NTYPE.CHOOSER = 2;  // The children of a CHOOSER can only be selected by one CHOOSER, and a CHOOSER can only select one child
NTYPE.VAL_U8 = 3;  // These nodes have readable and writable values of the type specified
NTYPE.VAL_U16 = 4;  // These nodes have rodes have readable and writable values of the type specified
NTYPE.VAL_U32 = 5;  // These nodes have readable and writable values of the type specified
NTYPE.VAL_S8 = 6;  // These nodes have readable and writable values of the type specified
NTYPE.VAL_S16 = 7;  // These nodes have readable and writable values of the type specified
NTYPE.VAL_S32 = 8;  // These nodes have readable and writable values of the type specified
NTYPE.VAL_STR = 9;  // These nodes have readable and writable values of the type specified
NTYPE.VAL_BIN = 10; // These nodes have readable and writable values of the type specified
NTYPE.VAL_FLT = 11; // These nodes have readable and writable values of the type specified

NTYPE.code_list = ['PLAIN', 'LINK', 'CHOOSER', 'VAL_U8', 'VAL_U16', 'VAL_U32', 'VAL_S8',
  'VAL_S16', 'VAL_S32', 'VAL_STR', 'VAL_BIN', 'VAL_FLT'];

NTYPE.c_type_dict = {
  CHOOSER: 'uint8',
  VAL_U8: 'uint8',
  VAL_U16: 'uint16',
  VAL_U32: 'uint32',
  VAL_S8: 'int8',
  VAL_S16: 'int16',
  VAL_S32: 'int32',
  VAL_STR: 'string_t',
  VAL_BIN: 'bin_t',
  VAL_FLT: 'float'
};

function default_handler(meter, payload) {
}

function ConfigNode(ntype, name, children) {
  if (typeof (children) == "undefined")
    children = [];
  this.code = -1;
  this.ntype = ntype;
  this.name = name;
  this.children = [];
  this.parent = null;
  this.tree = null;
  this.value = [];
  this.notification_handler = default_handler;
  for (var i = 0; i < children.length; i++) {
    var c = children[i];
    if (typeof (c) == "string") {
      this.children.push(new ConfigNode(NTYPE.PLAIN, c));
    }
    else {
      this.children.push(c);
    }
  }
}
ConfigNode.prototype.toString = function () {
  var s = '';
  if (this.code != -1)
    s += this.code.toString() + ':';
  s += NTYPE.code_list[this.ntype] + ":";
  s += this.name;
  if (this.value.length)
    s += ":" + this.value.toString();
  return s;
}
ConfigNode.prototype.getIndex = function () {
  return this.parent.children.indexOf(this);
}
ConfigNode.prototype.getPath = function (rval) {
  if (typeof (rval) == "undefined")
    rval = [];
  if (this.parent) {
    this.parent.getPath(rval);
    rval.append(self.getIndex());
  }
  return rval;
}
ConfigNode.prototype.getLongName = function (rval, sep) {
  sep = (typeof (sep) == "undefined") ? '_' : sep;

  if (typeof (rval) == "undefined")
    rval = this.name;
  else
    rval = sep.join((this.name, rval))
  if (!this.parent)
    return rval.slice(1);
  else
    return this.parent.getLongName(rval);
}
ConfigNode.prototype.needsShortCode = function () {
  if (this.ntype == NTYPE.PLAIN ||
    this.ntype == NTYPE.LINK)
    return false;
  return true;
}
ConfigNode.prototype.assignShortCode = function (code) {
  this.code = code;
}

function ConfigTree(root) {
  this.root = root;
}
ConfigTree.prototype.enumerate = function (n, indent) {
  if (typeof (n) == "undefined")
    n = this.root;
  if (typeof (indent) == "undefined")
    indent = 0;
  showLog("  ".repeat(indent) + n.toString());
  for (var i = 0; i < n.children.length; i++) {
    var c = n.children[i];
    this.enumerate(c, indent + 1);
  }
  if (!indent)
    showLog("");
}
ConfigTree.prototype.serialize = function () {
  // Decided not to use msgpack for simplicity.  We have such a reductive structure we can do it
  // more easily ourselves
  var r = new Uint8Array([]);
  this.walk((node) => {
    r.append(node.ntype);
    r.append(len(node.name));
    for (c in node.name)
      r.append(ord(c));
    r.append(node.children.length);
  });
  return r.decode('ascii');
}
ConfigTree.prototype.deserialize = function (bytes) {
  var ntype = bytes[0];
  var nlen = bytes[1];
  var name = String.fromCharCode.apply(null, new Uint8Array(bytes.slice(2, 2 + nlen)));
  var n_children = bytes[2 + nlen];
  bytes = bytes.slice(3 + nlen);
  var children = [];
  for (var i = 0; i < n_children; i++) {
    // bytes must be passed by reference for this to work.
    var obj = this.deserialize(bytes);
    children[i] = obj.node;
    bytes = obj.bytes;
  }
  return {
    node: new ConfigNode(ntype, name, children),
    bytes: bytes
  };
}
ConfigTree.prototype.pack = function () {
  var plain = this.serialize();
  var compressed = pako.deflate(plain);
  return compressed;
}

ConfigTree.prototype.unpack = function (compressed) {
  var data = pako.inflate(compressed);
  // Convert gunzipped byteArray back to ascii string:
  var bytes = new Uint8Array(data);
  var strData = String.fromCharCode.apply(null, bytes);
  //var bytes = str2ab(plain);
  //var bytes = plain;
  var obj = this.deserialize(data);
  this.root = obj.node;
  this.assignShortCodes();
}

ConfigTree.prototype.assignShortCodes = function () {
  function on_each(node) {
    node.tree = this;
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      c.parent = node;
    }
    if (node.needsShortCode()) {
      node.assignShortCode(g_code[0]);
      g_code[0] += 1;
    }
  }

  // TODO: Rename this function... it's become a general reference refresher for the tree
  var g_code = [0];
  this.walk(on_each.bind(this));
}

ConfigTree.prototype.getNodeAtLongname = function (longname) {
  var longname = longname.toUpperCase();
  var tokens = longname.split(':');
  var n = this.root;
  for (var i = 0; i < tokens.length; i++) {
    token = tokens[i];
    var found = false;
    for (var j = 0; j < n.children.length; j++) {
      c = n.children[j];
      if (c.name == token) {
        n = c;
        found = true;
        break;
      }
    }
    if (!found)
      return null;
  }
  return n;
}

ConfigTree.prototype.getNodeAtPath = function (path) {
  var n = this.root;
  for (i in path) {
    n = n.children[i];
  }
  return n;
}

ConfigTree.prototype.walk = function (call_on_each, node) {
  if (!node) {
    this.walk(call_on_each, this.root);
    return;
  }
  for (var i = 0; i < node.children.length; i++) {
    var c = node.children[i];
    call_on_each(c);
    this.walk(call_on_each, c);
  }
}

ConfigTree.prototype.getShortCodeList = function () {
  function for_each(node) {
    if (node.code != -1)
      rval[node.code] = node;
  }

  var rval = {};
  this.walk(for_each);
  return rval;
}

// Helper class to pack and unpack integers and floats from a buffer
function BytePack(bytebuf) {
  this.i = 0;
  this.bytes = (typeof (bytebuf) == "undefined") ? [] : bytebuf;
}

BytePack.prototype.putByte = function (v) {
  this.bytes.push(v);
}

BytePack.prototype.putBytes = function (v) {
  for (var i = 0; i < v.length; i++) {
    var byte = v[i];
    this.putByte(byte);
  }
}
BytePack.prototype.putInt = function (v, b) {
  b = (typeof (b) == "undefined") ? 1 : b;
  while (b) {
    this.putByte(v & 0xFF);
    v >>= 8;
    b -= 1;
  }
}
BytePack.prototype.putFloat = function (v, b) {
  b = (typeof (b) == "undefined") ? 1 : b;
  var farr = new Float32Array(b);
  for (var i = 0; i < b; i++)
    farr[i] = v[i];
  var barr = new Uint8Array(farr.buffer);
  this.putBytes(barr);
}

BytePack.prototype.get = function (b, signed, t) {
  b = (typeof (b) == "undefined") ? 1 : b;
  signed = (typeof (signed) == "undefined") ? false : signed;
  t = (typeof (t) == "undefined") ? "int" : t;

  if (t == "int") {
    if (b > this.getBytesRemaining())
      throw "UnderflowException";
    var r = 0;
    var s = 0;
    var top_b = 0;
    while (b) {
      top_b = this.bytes[this.i];
      r += top_b << s;
      s += 8;
      this.i += 1;
      b -= 1;
    }
    // Sign extend
    if (signed && top_b & 0x80) {
      r -= 1 << s;
    }
    return r;
  }
  else if (t == "float") {
    if (4 > this.getBytesRemaining())
      throw "UnderflowException";
    var barr = this.bytes.slice(this.i, this.i + 4);
    var farr = new Float32Array(barr.buffer);
    this.i += 4;
    return farr[0];
  }
  else {
    throw "bad type";
  }
};

BytePack.prototype.getBytes = function (max_bytes) {
  if (typeof (max_bytes) == "undefined")
    rval = this.bytes.slice(this.i);
  else
    rval = this.bytes.slice(this.i, this.i + max_bytes);
  this.i += rval.length;
  return rval;
};

BytePack.prototype.getBytesRemaining = function () {
  return this.bytes.length - this.i;
};

function bufferCat(a, b) {
  var c = new (a.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
  //return Buffer.concat([a,b]);
}

// Test of config tree build
function buildTree() {
  // Abbreviations
  var root = new ConfigNode(NTYPE.PLAIN, '', [
    new ConfigNode(NTYPE.PLAIN, 'ADMIN', [
      new ConfigNode(NTYPE.VAL_U32, 'CRC32'),
      new ConfigNode(NTYPE.VAL_BIN, 'TREE'),
      new ConfigNode(NTYPE.VAL_STR, 'DIAGNOSTIC')
    ]),
  ]);
  var tree = new ConfigTree(root);
  tree.assignShortCodes();
  return tree;
}

function Mooshimeter() {
  this.seq_n = 0;
  this.aggregate = new Uint8Array([]);

  function expandReceivedTree(meter, payload) {
    var payload_str = String.fromCharCode.apply(String, payload);
    this.tree.unpack(payload);
    this.code_list = this.tree.getShortCodeList();
    this.tree.enumerate();
    // Calculate the CRC32 of received tree
    crc_node = this.tree.getNodeAtLongname('ADMIN:CRC32');
    //crc_node.value = CRC.bstr(payload_str);
    crc_node.value = E.CRC32(payload_str);
  }

  // Initialize tree
  this.tree = buildTree();
  this.code_list = this.tree.getShortCodeList();
  // Assign an expander function to the tree node
  var node = this.tree.getNodeAtLongname('ADMIN:TREE');
  node.notification_handler = expandReceivedTree.bind(this);
}

Mooshimeter.isMooshimeter = function (p, callback) {
  if (p.advertisement.serviceUuids.length &&
    (p.advertisement.serviceUuids[0].toUpperCase() == METER_SERVICE ||
      p.advertisement.serviceUuids[0].toUpperCase() == METER_SERVICE.replace(/-/g, "")))
    return true;
  return false;
};

Mooshimeter.prototype.connect = function (serializer, callback) {
  function waitForConnect() {
    if (this.tree.getNodeAtLongname('SAMPLING:TRIGGER') == null) {
      setTimeout(waitForConnect.bind(this), 200);
      return;
    }
    // Unlock the meter by writing the correct CRC32 value
    // The CRC32 node's value is written when the tree is received
    this.sendCommand('admin:crc32 ' + this.tree.getNodeAtLongname('admin:crc32').value);
    callback(true);
  }

  this.serializer = serializer;
  this.loadTree();
  // Wait for us to load the command tree
  waitForConnect.call(this);
};

Mooshimeter.prototype.disconnect = function () {
  //this.serializer.disconnect();
};

Mooshimeter.prototype.sendCommand = function (cmd) {
  // cmd might contain a payload, in which case split it out
  var arr = cmd.split(' ');
  node_str = arr[0];
  payload_str = "";
  if (arr.length > 1)
    payload_str = arr[1];

  var node = this.tree.getNodeAtLongname(node_str);
  if (!node) {
    showLog('Node ' + node_str + ' not found!');
    return;
  }
  if (node.code == -1) {
    if (node.needsShortCode()) {
      showLog('This command does not have a value associated.');
      showLog('Children of this command: ');
      this.tree.enumerate(node);
      process.exit(1);
    }
  }
  var b = new BytePack();
  if (payload_str == "") {
    b.putByte(node.code);
  }
  else {
    b.putByte(node.code + 0x80);
    if (node.ntype == NTYPE.PLAIN) {
      showLog("This command doesn't accept a payload");
      return;
    }
    else if (node.ntype == NTYPE.CHOOSER) {
      b.putInt(parseInt(payload_str))
    }
    else if (node.ntype == NTYPE.LINK) {
      showLog("This command doesn't accept a payload");
      return;
    }
    else if (node.ntype == NTYPE.VAL_U8) {
      b.putInt(parseInt(payload_str))
    }
    else if (node.ntype == NTYPE.VAL_U16) {
      b.putInt(parseInt(payload_str), 2);
    }
    else if (node.ntype == NTYPE.VAL_U32) {
      b.putInt(parseInt(payload_str), 4);
    }
    else if (node.ntype == NTYPE.VAL_S8) {
      b.putInt(int(payload_str));
    }
    else if (node.ntype == NTYPE.VAL_S16) {
      b.putInt(parseInt(payload_str), 2);
    }
    else if (node.ntype == NTYPE.VAL_S32) {
      b.putInt(parseInt(payload_str), 4);
    }
    else if (node.ntype == NTYPE.VAL_STR) {
      b.putInt(payload_str.length, 2);
      b.putBytes(payload_str);
    }
    else if (node.ntype == NTYPE.VAL_BIN) {
      showLog("This command doesn't accept a payload");
      return;
    }
    else if (node.ntype == NTYPE.VAL_FLT) {
      b.putFloat(parseFloat(payload_str));
    }
    else {
      // error
    }
  }
  this.writeToMeter(b.bytes);
}

Mooshimeter.prototype.loadTree = function () {
  this.sendCommand('ADMIN:TREE');
};

Mooshimeter.prototype.attachCallback = function (node_path, notify_cb) {
  if (typeof (notify_cb) == "undefined")
    notify_cb = function (meter, val) { };
  var node = this.tree.getNodeAtLongname(node_path);
  if (!node) {
    showLog('Could not find node at ' + node_path);
    return;
  }
  node.notification_handler = notify_cb;
};

Mooshimeter.prototype.writeToMeter = function (bytes) {
  if (bytes.length > 19)
    Error("Payload too long!");
  // Put in the sequence number
  var b = new BytePack();
  b.putByte(0); // seq ntrue
  b.putBytes(bytes);
  this.serializer.write(b.getBytes());
};

Mooshimeter.prototype.readFromMeter = function (err, bytes) {
  if (bytes.length == 0)
    return;
  var b = new BytePack(bytes);
  var seq_n = b.get(1) & 0xFF;
  if (seq_n != (this.seq_n + 1) % 0x100) {
    showLog('Received out of order packet!');
    showLog('Expected: ' + this.seq_n + 1);
    showLog('Got     : ' + seq_n);
  }
  this.seq_n = seq_n;
  this.aggregate = bufferCat(this.aggregate, b.bytes.slice(1));
  // Attempt to decode a message, if we succeed pop the message off the byte queue
  while (this.aggregate.length > 0) {
    try {
      var b = new BytePack(this.aggregate);
      var shortcode = b.get();
      try {
        node = this.code_list[shortcode];
      }
      catch (KeyError) {
        showLog('Received an unrecognized shortcode!');
        return;
      }
      if (node.ntype == NTYPE.PLAIN) {
        showError("bad ntype");
      }
      else if (node.ntype == NTYPE.CHOOSER)
        node.notification_handler(this, b.get(1));
      else if (node.ntype == NTYPE.LINK)
        showError("bad ntype");
      else if (node.ntype == NTYPE.VAL_U8)
        node.notification_handler(this, b.get(1));
      else if (node.ntype == NTYPE.VAL_U16)
        node.notification_handler(this, b.get(2));
      else if (node.ntype == NTYPE.VAL_U32)
        node.notification_handler(this, b.get(4));
      else if (node.ntype == NTYPE.VAL_S8)
        node.notification_handler(this, b.get(1, true))
      else if (node.ntype == NTYPE.VAL_S16)
        node.notification_handler(this, b.get(2, true))
      else if (node.ntype == NTYPE.VAL_S32)
        node.notification_handler(this, b.get(4, true))
      else if (node.ntype == NTYPE.VAL_STR) {
        var expecting_bytes = b.get(2);
        if (b.getBytesRemaining() < expecting_bytes)
          return; //abort!
        node.notification_handler(this, b.getBytes(expecting_bytes));
      }
      else if (node.ntype == NTYPE.VAL_BIN) {
        var expecting_bytes = b.get(2);
        if (b.getBytesRemaining() < expecting_bytes)
          return; //abort!
        node.notification_handler(this, b.getBytes(expecting_bytes));
      }
      else if (node.ntype == NTYPE.VAL_FLT) {
        node.notification_handler(this, b.get(4, true, "float"));
      }
      else
        showError('Unknwn');
      this.aggregate = this.aggregate.slice(b.i);
    }
    catch (UnderflowException) {
      // An underflow exception here does not indicate anything sinister.  It just means we had to split a packet.
      // across multiple BLE connection events.
      //showLog('underflow');
      return;
    }
  }
};

function run(m) {
  m.sendCommand('sampling:rate 0');       // Rate 125Hz
  m.sendCommand('sampling:depth 2');      // Depth 256
  m.sendCommand('ch1:mapping 1');         // CH1 select current input
  m.sendCommand('ch1:range_i 0');         // CH1 10A range
  m.sendCommand('ch2:mapping 1');         // CH2 select voltage input
  m.sendCommand('ch2:range_i 1');         // CH2 Voltage 600V range
  m.sendCommand('sampling:trigger 2');    // Trigger continuous

  m.attachCallback('ch1:value', printCH1Value);
  m.attachCallback('ch2:value', printCH2Value);

  setInterval(periodic.bind(this, m), 4000);
}

function periodic(m) {
  m.sendCommand('pcb_version');
}

function connectMeter(device) {
  function connect() {
    m.connect(serializer, run.bind(this, m));
  }

  m = new Mooshimeter();
  serializer = new MeterSerializer(device, m, connect.bind(this));
}

function exit(m) {
  console.log("Disconnecting...");
  m.disconnect();
}
function printCH1Value(m, val) {
  console.log("CH1: " + val);
}
function printCH2Value(m, val) {
  console.log("CH2: " + val);
}

let menu = {
  "": { "title": "Mooshimeter" }
};

function showMainMenu() {
  menu["RE-SCAN"] = () => scan();
  menu["< Back"] = () => load();
  return E.showMenu(menu);
}

function showDeviceInfo(device) {
  const deviceMenu = {
    "": { "title": "Device Info" },
    "name": {
      value: device.name
    },
    "rssi": {
      value: device.rssi
    },
    "manufacturer": {
      value: device.manufacturer === undefined ? "-" : device.manufacturer
    }
  };

  deviceMenu[device.id] = () => { };
  deviceMenu["< Back"] = () => showMainMenu();

  return E.showMenu(deviceMenu);
}

function scan() {
  menu = {
    "": { "title": "Mooshimeter" },
  };

  waitMessage();

  NRF.findDevices(devices => {
    devices.forEach(device => {
      let deviceName = device.id.substring(0, 17);

      if (device.name) {
        deviceName = device.name;
      }

      menu[deviceName] = () => connectMeter(device);
    });
    showMainMenu();
  },
    {
      filters: [{ services: ["1bc5ffa0-0200-62ab-e411-f254e005dbd4"] }],
      active: true
    });
}

function waitMessage() {
  E.showMenu();
  E.showMessage("scanning");
}

scan();
