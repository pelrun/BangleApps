
function showLog(txt) {
  console.log(txt);
}
function showError(txt) {
  console.log(txt);
}

process.on('uncaughtException', function (e) {
  console.log(e, e.stack ? "\n" + e.stack : "");
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
      //console.log(event);
      this.meter.readFromMeter(null, event.target.value.buffer);
    });
    return ch.startNotifications();
  }).then(() => {
    console.log("Connected!");
    return callback();
  }).catch((err) => {
    console.log("Connection failed! " + err);
    if (this.gatt && this.gatt.connected) {
      this.gatt.disconnect();
    }
    E.showMenu(menu);
  });
}

//////////////////////////////////////////////////////////////

MeterSerializer.prototype.handleError = function (err) {
  if (err) {
    showLog("Errar: " + err);
  }
};

MeterSerializer.prototype.disconnect = function () {
  this.gatt.disconnect();
  this.gatt = {};
};

MeterSerializer.prototype.write = function (bytes) {
  this.writer.writeValue(bytes);
};

MeterSerializer.prototype.onNotify = function (err) {
  //if(this.desc)
  //this.reader.readValue(this.meter.readFromMeter.bind(this));
};

MeterSerializer.prototype.onData = function (data, isNotification) {
  this.meter.readFromMeter(null, data.target.value.buffer);
};

//////////////////////////////////////////////////////////////

function NTYPE() {
}

NTYPE.PLAIN = 0;
NTYPE.LINK = 1;
NTYPE.CHOOSER = 2;
NTYPE.VAL_U8 = 3;
NTYPE.VAL_U16 = 4;
NTYPE.VAL_U32 = 5;
NTYPE.VAL_S8 = 6;
NTYPE.VAL_S16 = 7;
NTYPE.VAL_S32 = 8;
NTYPE.VAL_STR = 9;
NTYPE.VAL_BIN = 10;
NTYPE.VAL_FLT = 11;

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

//////////////////////////////////////////////////////////////

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
};
ConfigNode.prototype.getIndex = function () {
  return this.parent.children.indexOf(this);
};
ConfigNode.prototype.getPath = function (rval) {
  if (typeof (rval) == "undefined")
    rval = [];
  if (this.parent) {
    this.parent.getPath(rval);
    rval.append(self.getIndex());
  }
  return rval;
};
ConfigNode.prototype.getLongName = function (rval, sep) {
  sep = (typeof (sep) == "undefined") ? '_' : sep;

  if (typeof (rval) == "undefined")
    rval = this.name;
  else
    rval = sep.join((this.name, rval));
  if (!this.parent)
    return rval.slice(1);
  else
    return this.parent.getLongName(rval);
};
ConfigNode.prototype.needsShortCode = function () {
  if (this.ntype == NTYPE.PLAIN ||
    this.ntype == NTYPE.LINK)
    return false;
  return true;
};
ConfigNode.prototype.assignShortCode = function (code) {
  this.code = code;
};

//////////////////////////////////////////////////////////////

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
};

ConfigTree.prototype.deserialize = function (buffer, offset) {
  var bytes = Uint8Array(buffer, offset);
  var ntype = bytes[0];
  var nlen = bytes[1];
  var name = nlen > 0 ? String.fromCharCode.apply(null, Uint8Array(buffer, 2 + offset, nlen)) : "";
  var n_children = bytes[2 + nlen];
  offset += 3 + nlen;
  var children = [];
  for (var i = 0; i < n_children; i++) {
    // bytes must be passed by reference for this to work.
    var obj = this.deserialize(buffer, offset);
    children[i] = obj.node;
    offset = obj.offset;
  }
  return {
    node: new ConfigNode(ntype, name, children),
    offset: offset
  };
};

ConfigTree.prototype.unpack = function (compressed) {
  // Too expensive to decompress supplied tree, so supply it ourselves
  var data = require("heatshrink").decompress(atob("AAMNgEFoNEptJp0DgsFodSoczmUAhUEqlSotFgEJhVEpNBo9Op9TqlJocAgcLqFDoVfq1FqVTpNPpwaBglOoNNEIMFhAaBAwNfqtUD4MEhYKHr9NqcAhcFoVBqgtBgECgxIBoVPp9UgUAgxHBqVNoNMNoMIqdIpNQptPog9BBQREBqFMPANHgcCglSF4NFg5lBmMymoXBgYEBmAFCAgIFCgkxAoIGDmQGFmgGFnAGDgUFIgNQqlIggIBWYQEBm00GYQ/BnA/EmwPBg7EBpNHo6wBgYPBp9GowVBgy5BNINMOwUKobBBVgNOqtPqqoBDYNMp9Hg5/BaYUEhATBQYNSqykCgYrBqiPBDwUDg9Qp9MplEpNSDoMGNgI8BD4J8CEwNGp8DgkFAwIRBrEAgsIooHBr77DBQMHp1foVZEQJVCH4T4BbgIlJgyCCqY+BPYMEohYBoJ2CodImMIUQNNoNQqD/DgEHodVqQxBP4MBW4LwBMYRFBptQBYMDmc1BgMBJgNIoIbBoiMCqVBFYNFr9JEYMIBAKmBrLQBqY5Bgh5BBgJQCqVNO4dCqpnBYYMAhcFYwVVSQMLO5EDDIRBCAoSjBqApBhcOBIdMqdCmRIBXgNWawSRCmSRMqz5BVIJuBgRtBmyRCgYEBS/6X0gRlGKAMFoNVrFfqwHBgcwl0xK4QFBmYFCmMumQFBhQfBOQSsBp1DosFNQMxVAIbBVYUHBAYJEhAJEBQkJBQoLEhQLGBgkFolJp9EoraCKIcLhBRBU4NfqFXWII="));
  var obj = this.deserialize(data, 0);
  this.root = obj.node;
  this.assignShortCodes();
};

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

  var g_code = [0];
  this.walk(on_each.bind(this));
};

ConfigTree.prototype.getNodeAtLongname = function (longname) {
  longname = longname.toUpperCase();
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
};

ConfigTree.prototype.getNodeAtPath = function (path) {
  var n = this.root;
  for (var i in path) {
    n = n.children[i];
  }
  return n;
};

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
};

ConfigTree.prototype.getShortCodeList = function () {
  function for_each(node) {
    if (node.code != -1)
      rval[node.code] = node;
  }

  var rval = {};
  this.walk(for_each);
  return rval;
};

//////////////////////////////////////////////////////////////

function BytePack(bytebuf) {
  this.i = 0;
  this.bytes = [];
}

BytePack.prototype.putByte = function (v) {
  this.bytes.push(v);
};

BytePack.prototype.putBytes = function (v) {
  for (var i = 0; i < v.length; i++) {
    var byte = v[i];
    this.putByte(byte);
  }
};

BytePack.prototype.putInt = function (v, b) {
  b = (typeof (b) == "undefined") ? 1 : b;
  while (b) {
    this.putByte(v & 0xFF);
    v >>= 8;
    b -= 1;
  }
};

BytePack.prototype.putFloat = function (v, b) {
  b = (typeof (b) == "undefined") ? 1 : b;
  var farr = new Float32Array(b);
  for (var i = 0; i < b; i++)
    farr[i] = v[i];
  var barr = new Uint8Array(farr.buffer);
  this.putBytes(barr);
};

function ByteUnpack(bytebuf) {
  this.i = 0;
  this.bytes = bytebuf;
}

ByteUnpack.prototype.getBytes = function (max_bytes) {
  if (typeof (max_bytes) == "undefined")
    rval = this.bytes.slice(this.i);
  else
    rval = this.bytes.slice(this.i, this.i + max_bytes);
  this.i += rval.length;
  return rval;
};

ByteUnpack.prototype.getBytesRemaining = function () {
  return this.bytes.length - this.i;
};

ByteUnpack.prototype.get = function (b, signed, t) {
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
    var f = 0;
    if (this.bytes.buffer != undefined)
      f = DataView(this.bytes.buffer).getFloat32(this.i, true);
    this.i += 4;
    return f;
  }
  else {
    throw "bad type";
  }
};

//////////////////////////////////////////////////////////////

function bufferCat(a, b) {
  var c = new (b.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
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

//////////////////////////////////////////////////////////////

function Mooshimeter() {
  this.seq_n = 0;
  this.aggregate = new Uint8Array([]);

  // Initialize tree
  this.tree = buildTree();
  this.code_list = this.tree.getShortCodeList();
}

Mooshimeter.prototype.connect = function (serializer, callback) {
  E.showMessage("initializing");

  this.serializer = serializer;
  this.sendCommand('ADMIN:TREE').then((payload) => {
    this.tree.unpack(payload);
    this.code_list = this.tree.getShortCodeList();
    this.tree.enumerate();
    // Calculate the CRC32 of received tree
    crc_node = this.tree.getNodeAtLongname('ADMIN:CRC32');
    crc_node.value = 0xE9B18BB4; // E.CRC32(payload);
    return this.sendCommand('admin:crc32 ' + crc_node.value);
  }).then(() => {
    callback(true);
  });
};

Mooshimeter.prototype.disconnect = function () {
  //this.serializer.disconnect();
};

Mooshimeter.prototype.sendCommand = function (cmd) {
  var arr = cmd.split(' ');
  node_str = arr[0];
  payload_str = (arr.length > 1) ? arr[1] : "";

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

    switch (node.ntype) {
      case NTYPE.CHOOSER:
        b.putInt(parseInt(payload_str));
        break;
      case NTYPE.VAL_U8:
        b.putInt(parseInt(payload_str));
        break;
      case NTYPE.VAL_S8:
        b.putInt(int(payload_str));
        break;
      case NTYPE.VAL_U16:
        b.putInt(parseInt(payload_str), 2);
        break;
      case NTYPE.VAL_S16:
        b.putInt(parseInt(payload_str), 2);
        break;
      case NTYPE.VAL_U32:
        b.putInt(parseInt(payload_str), 4);
        break;
      case NTYPE.VAL_S32:
        b.putInt(parseInt(payload_str), 4);
        break;
      case NTYPE.VAL_FLT:
        b.putFloat(parseFloat(payload_str));
        break;
      case NTYPE.VAL_STR:
        b.putInt(payload_str.length, 2);
        b.putBytes(payload_str);
        break;
      default:
        showLog("This command doesn't accept a payload");
        return;
    }
  }
  this.writeToMeter(b.bytes);
  return new Promise((resolve) => { node.notification_handler = resolve; });
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
  var b = new Uint8Array(bytes.length + 1);
  b[0] = 0; // seq ntrue
  b.set(bytes, 1);
  this.serializer.write(b);
};

Mooshimeter.prototype.readFromMeter = function (err, bytes) {
  if (bytes.length == 0)
    return;
  var b = new ByteUnpack(bytes);
  var seq_n = b.get(1) & 0xFF;
  if (seq_n != (this.seq_n + 1) % 0x100) {
    showLog('Received out of order packet!');
    showLog('Expected: ' + this.seq_n + 1);
    showLog('Got     : ' + seq_n);
  }
  this.seq_n = seq_n;
  this.aggregate = bufferCat(this.aggregate, Uint8Array(bytes, 1));
  // Attempt to decode a message, if we succeed pop the message off the byte queue
  while (this.aggregate.length > 0) {
    try {
      b = new ByteUnpack(this.aggregate);
      var shortcode = b.get();
      var value;

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
        value = b.get(1);
      else if (node.ntype == NTYPE.LINK)
        showError("bad ntype");
      else if (node.ntype == NTYPE.VAL_U8)
        value = b.get(1);
      else if (node.ntype == NTYPE.VAL_U16)
        value = b.get(2);
      else if (node.ntype == NTYPE.VAL_U32)
        value = b.get(4);
      else if (node.ntype == NTYPE.VAL_S8)
        value = b.get(1, true);
      else if (node.ntype == NTYPE.VAL_S16)
        value = b.get(2, true);
      else if (node.ntype == NTYPE.VAL_S32)
        value = b.get(4, true);
      else if (node.ntype == NTYPE.VAL_STR || node.ntype == NTYPE.VAL_BIN) {
        var expecting_bytes = b.get(2);
        if (b.getBytesRemaining() < expecting_bytes)
          return; //abort!
        value = b.getBytes(expecting_bytes);
      }
      else if (node.ntype == NTYPE.VAL_FLT) {
        value = b.get(4, true, "float");
      }
      else
        showError('Unknown');

      if (value != undefined) {
        console.log(node, value);
        node.notification_handler(this, value);
      }
      this.aggregate = Uint8Array(this.aggregate.slice(b.i));
    }
    catch (e) {
      if (e == "UnderflowException") {
        // full packet not received yet
        return;
      }
      console.log(e + e.stack);
      break;
    }
  }
};

function run(m) {
  console.log("Running");

  m.attachCallback('ch1:value', printCH1Value);
  m.attachCallback('ch2:value', printCH2Value);

  m.sendCommand('sampling:rate 0').then(() => {
    return m.sendCommand('sampling:depth 2');
  }).then(() => {
    return m.sendCommand('ch1:mapping 1');
  }).then(() => {
    return m.sendCommand('ch1:range_i 0');
  }).then(() => {
    return m.sendCommand('ch2:mapping 1');
  }).then(() => {
    return m.sendCommand('ch2:range_i 1');
  }).then(() => {
    return m.sendCommand('sampling:trigger 2');
  }).then(() => {
    //setInterval(periodic.bind(this, m), 4000);
  });
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
