
var Layout = require("Layout");

process.on('uncaughtException', function (e) {
  console.log(e, e.stack ? "\n" + e.stack : "");
});

const METER_SERVICE = "1BC5FFA0-0200-62AB-E411-F254E005DBD4";
const METER_SERIN = "1BC5FFA1-0200-62AB-E411-F254E005DBD4";
const METER_SEROUT = "1BC5FFA2-0200-62AB-E411-F254E005DBD4";

function MeterSerializer(p, meter, callback) {
  this.P = p;
  this.meter = meter;
  this.service = null;
  this.reader = null;
  this.writer = null;
  this.gatt = null;
  this.sendq = Promise.resolve();

  E.showMenu();
  E.showMessage("connecting");

  this.P.on('gattserverdisconnected', () => showScanMenu());

  this.P.gatt.connect().then((g) => {
    this.gatt = g;
    return this.gatt.getPrimaryService(METER_SERVICE);
  }).then((sv) => {
    this.service = sv;
    return this.service.getCharacteristic(METER_SERIN);
  }).then((ch) => {
    this.writer = ch;
    return this.service.getCharacteristic(METER_SEROUT);
  }).then((ch) => {
    this.reader = ch;
    ch.on('characteristicvaluechanged', (event) => {
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
    showScanMenu();
  });
}

MeterSerializer.prototype.write = function (bytes) {
  this.sendq = this.sendq.then(() => {
    //console.log("sent: ",bytes);
    return this.writer.writeValue(bytes);
  });
};

MeterSerializer.prototype.handleError = function (err) {
  if (err) {
    console.log("Error: " + err);
  }
};

MeterSerializer.prototype.disconnect = function () {
  console.log("Disconnect");
  this.gatt.disconnect();
  this.gatt = {};
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
  v.forEach((b) => this.putByte(b));
};

BytePack.prototype.putInt = function (v, b) {
  b = (typeof (b) == "undefined") ? 1 : b;
  while (b) {
    this.putByte(v & 0xFF);
    v >>= 8;
    b -= 1;
  }
};

BytePack.prototype.putFloat = function (v) {
  var barr = new Uint8Array(4);
  new DataView(barr.buffer).setFloat32(0, v, true);
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
  this.response_handler = default_handler;
  children.forEach((c) => {
    if (typeof (c) == "string") {
      this.children.push(new ConfigNode(NTYPE.PLAIN, c));
    }
    else {
      this.children.push(c);
      this[c.name] = c;
    }
  });
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

ConfigNode.prototype.update = function () {
  "ram";
  if (this.code == -1) {
    if (this.needsShortCode()) {
      console.log('This command does not have a value associated.');
    }
  }

  m.writeToMeter([this.code]);

  return new Promise((resolve, reject) => {
    this.response_handler = (value) => {
      resolve(value);
      this.response_handler = default_handler;
    };
    m.root.ADMIN.DIAGNOSTIC.notification_handler = (obj, msg) => {
      reject(String.fromCharCode.apply(null, msg));
    };
  });
};

ConfigNode.prototype.send = function (p) {
  "ram";
  p = (typeof (p) == "undefined") ? "" : p;

  if (this.code == -1) {
    if (this.needsShortCode()) {
      console.log('This command does not have a value associated.');
    }
  }
  var b = new BytePack();
  if (p === "") {
    b.putByte(this.code);
  }
  else {
    b.putByte(this.code + 0x80);

    switch (this.ntype) {
      case NTYPE.CHOOSER:
        b.putInt(p);
        break;
      case NTYPE.VAL_U8:
        b.putInt(p);
        break;
      case NTYPE.VAL_S8:
        b.putInt(p);
        break;
      case NTYPE.VAL_U16:
        b.putInt(p, 2);
        break;
      case NTYPE.VAL_S16:
        b.putInt(p, 2);
        break;
      case NTYPE.VAL_U32:
        b.putInt(p, 4);
        break;
      case NTYPE.VAL_S32:
        b.putInt(p, 4);
        break;
      case NTYPE.VAL_FLT:
        b.putFloat(p);
        break;
      case NTYPE.VAL_STR:
        b.putInt(p.length, 2);
        b.putBytes(p);
        break;
      default:
        console.log("This command doesn't accept a payload");
        return;
    }
  }

  m.writeToMeter(b.bytes);

  return new Promise((resolve, reject) => {
    m.root.ADMIN.DIAGNOSTIC.notification_handler = (obj, msg) => {
      reject(String.fromCharCode.apply(null, msg));
    };
    this.response_handler = (value) => resolve(value);
  });
};

//////////////////////////////////////////////////////////////

function ConfigTree(root) {
  this.root = root;
}

// ConfigTree.prototype.enumerate = function (n, indent) {
//   if (typeof (n) == "undefined")
//     n = this.root;
//   if (typeof (indent) == "undefined")
//     indent = 0;
//   console.log("  ".repeat(indent) + n.toString());
//   for (var i = 0; i < n.children.length; i++) {
//     var c = n.children[i];
//     this.enumerate(c, indent + 1);
//   }
//   if (!indent)
//     console.log("");
// };

ConfigTree.prototype.deserialize = function (buffer, offset) {
  var bytes = Uint8Array(buffer, offset);
  var ntype = bytes[0];
  var nlen = bytes[1];
  var name = nlen > 0 ? String.fromCharCode.apply(null, Uint8Array(buffer, 2 + offset, nlen)) : "";
  var n_children = bytes[2 + nlen];
  offset += 3 + nlen;
  var children = [];
  for (var i = 0; i < n_children; i++) {
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
  // Too expensive to decompress supplied tree, so supply it and CRC32 ourselves
  // will need rechecking after a firmware update, but the last was years ago
  var data = require("heatshrink").decompress(atob("AAMNgEFoNEptJp0DgsFodSoczmUAhUEqlSotFgEJhVEpNBo9Op9TqlJocAgcLqFDoVfq1FqVTpNPpwaBglOoNNEIMFhAaBAwNfqtUD4MEhYKHr9NqcAhcFoVBqgtBgECgxIBoVPp9UgUAgxHBqVNoNMNoMIqdIpNQptPog9BBQREBqFMPANHgcCglSF4NFg5lBmMymoXBgYEBmAFCAgIFCgkxAoIGDmQGFmgGFnAGDgUFIgNQqlIggIBWYQEBm00GYQ/BnA/EmwPBg7EBpNHo6wBgYPBp9GowVBgy5BNINMOwUKobBBVgNOqtPqqoBDYNMp9Hg5/BaYUEhATBQYNSqykCgYrBqiPBDwUDg9Qp9MplEpNSDoMGNgI8BD4J8CEwNGp8DgkFAwIRBrEAgsIooHBr77DBQMHp1foVZEQJVCH4T4BbgIlJgyCCqY+BPYMEohYBoJ2CodImMIUQNNoNQqD/DgEHodVqQxBP4MBW4LwBMYRFBptQBYMDmc1BgMBJgNIoIbBoiMCqVBFYNFr9JEYMIBAKmBrLQBqY5Bgh5BBgJQCqVNO4dCqpnBYYMAhcFYwVVSQMLO5EDDIRBCAoSjBqApBhcOBIdMqdCmRIBXgNWawSRCmSRMqz5BVIJuBgRtBmyRCgYEBS/6X0gRlGKAMFoNVrFfqwHBgcwl0xK4QFBmYFCmMumQFBhQfBOQSsBp1DosFNQMxVAIbBVYUHBAYJEhAJEBQkJBQoLEhQLGBgkFolJp9EoraCKIcLhBRBU4NfqFXWII="));
  var obj = this.deserialize(data, 0);
  this.root = obj.node;
  this.assignShortCodes();
  return 0xE9B18BB4;
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

function Mooshimeter() {
  this.seq_n = -1;
  this.seq_wr = 0;
  this.aggregate = new Uint8Array([]);
  this.sendPromise = Promise.resolve();
  this.tree = new ConfigTree();
}

Mooshimeter.prototype.connect = function (serializer, callback) {
  E.showMessage("initializing");

  this.serializer = serializer;
  var crc = this.tree.unpack();
  this.root = this.tree.root;
  this.code_list = this.tree.getShortCodeList();
  this.root.ADMIN.CRC32.send(crc).then(() => {
    callback(true);
  });
};

// Mooshimeter.prototype.disconnect = function () {
//   this.serializer.disconnect();
// };

Mooshimeter.prototype.writeToMeter = function (bytes) {
  if (bytes.length > 19)
    Error("Payload too long!");
  // Put in the sequence number
  var b = new Uint8Array(bytes.length + 1);
  b[0] = this.seq_wr;
  this.seq_wr += 1;
  b.set(bytes, 1);
  return this.serializer.write(b);
};

function bufferCat(a, b) {
  var c = new (b.constructor)(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

Mooshimeter.prototype.readFromMeter = function (err, bytes) {
  "ram";
  if (bytes.length == 0)
    return;
  var b = new ByteUnpack(bytes);
  var seq_n = b.get(1) & 0xFF;
  if (this.seq_n != -1 && seq_n != (this.seq_n + 1) % 0x100) {
    console.log('Received out of order packet!');
    console.log('Expected: ' + this.seq_n + 1);
    console.log('Got     : ' + seq_n);
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
        console.log('Received an unrecognized shortcode!');
        return;
      }

      switch (node.ntype) {
        case NTYPE.PLAIN:
        case NTYPE.LINK:
          console.log("bad ntype");
          break;
        case NTYPE.CHOOSER:
        case NTYPE.VAL_U8:
          value = b.get(1);
          break;
        case NTYPE.VAL_U16:
          value = b.get(2);
          break;
        case NTYPE.VAL_U32:
          value = b.get(4);
          break;
        case NTYPE.VAL_S8:
          value = b.get(1, true);
          break;
        case NTYPE.VAL_S16:
          value = b.get(2, true);
          break;
        case NTYPE.VAL_S32:
          value = b.get(4, true);
          break;
        case NTYPE.VAL_STR:
        case NTYPE.VAL_BIN:
          var expecting_bytes = b.get(2);
          if (b.getBytesRemaining() < expecting_bytes)
            return; //abort!
          value = b.getBytes(expecting_bytes);
          if (node.ntype == NTYPE.VAL_STR)
            value = String.fromCharCode.apply(null, value);
          break;
        case NTYPE.VAL_FLT:
          value = b.get(4, true, "float");
          break;
        default:
          console.log('Unknown');
      }

      if (value != undefined) {
        if (node.ntype == NTYPE.CHOOSER)
          if (node.children[value].ntype == NTYPE.LINK)
            node.choice = m.root.SHARED.choice;
          else
            node.choice = node.children[value];
        node.value = value;
        //console.log("Recv: ",node,value);
        node.response_handler(this,value);
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

var layout = new Layout({
  type: "v", c: [
    { type: "txt", font: "10%", label: "Channel 1:", id: "ch1label" },
    { type: "txt", font: "10%", label: "--", id: "ch1map", bgCol: g.theme.bg, fillx: 1  },
    { type: "txt", font: "20%", label: "--", id: "ch1", bgCol: g.theme.bg, fillx: 1 },
    { type: "txt", font: "10%", label: "Channel 2:", id: "ch2label" },
    { type: "txt", font: "10%", label: "--", id: "ch2map", bgCol: g.theme.bg, fillx: 1  },
    { type: "txt", font: "20%", label: "--", id: "ch2", bgCol: g.theme.bg, fillx: 1 },
  ]
}, { lazy: true });

function run(m) {
  console.log("Running");

  var updateList = [
    //m.root.NAME,
    m.root.SAMPLING.RATE,
    m.root.SAMPLING.DEPTH,
    m.root.SAMPLING.TRIGGER,
    m.root.SHARED,
    m.root.CH1.MAPPING,
    m.root.CH1.RANGE_I,
    m.root.CH1.ANALYSIS,
    m.root.CH1.OFFSET,
    m.root.CH2.MAPPING,
    m.root.CH2.RANGE_I,
    m.root.CH2.ANALYSIS,
    m.root.CH2.OFFSET,
  ];

  updateList.reduce((p,i) => p.then(() => i.update()), Promise.resolve()).then(() =>
  m.root.SAMPLING.TRIGGER.send(2)).then(() => {
    g.clear();
    layout.render();
    Bangle.drawWidgets();
    setInterval(periodic.bind(this, m), 4000);
    setInterval(updateLayout.bind(this), 500);

    m.root.CH1.RANGE_I.notification_handler = updateRange.bind(m.root.CH1, layout.ch1map);
    m.root.CH2.RANGE_I.notification_handler = updateRange.bind(m.root.CH2, layout.ch2map);
    m.root.CH1.MAPPING.notification_handler = m.root.CH1.RANGE_I.notification_handler;
    m.root.CH2.MAPPING.notification_handler = m.root.CH2.RANGE_I.notification_handler;

    m.root.CH1.MAPPING.notification_handler.call(m.root.CH1, layout.ch1map);
    m.root.CH2.MAPPING.notification_handler.call(m.root.CH2, layout.ch2map);

    m.root.CH1.VALUE.notification_handler = updateChValue.bind(m.root.CH1, layout.ch1);
    m.root.CH2.VALUE.notification_handler = updateChValue.bind(m.root.CH2, layout.ch2);
  }).catch((msg) => {
    console.log(msg);
  });
}

function updateChValue(widget) {
  if (this.VALUE.max && this.VALUE.value > this.VALUE.max)
    widget.label = "--";
  else
    widget.label = Math.round(this.VALUE.value * 100) / 100;
}

function updateRange(widget) {
  try {
    this.VALUE.max = 1.1 * parseInt(this.MAPPING.choice.children[this.RANGE_I.value].name);
    widget.label = this.MAPPING.choice.name;
  }
  catch(err) {
    console.log(err);
  }
}

function periodic(m) {
  m.root.PCB_VERSION.update();
}

function updateLayout() {
  layout.render();
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

let scanMenu = {};

function showScanMenu() {
  return E.showMenu(scanMenu);
}

function scan() {
  scanMenu = {
    "": { "title": "Mooshimeter DMM" },
  };

  E.showMenu();
  E.showMessage("scanning");

  NRF.findDevices(devices => {
    devices.forEach(device => {
      let deviceName = device.id.substring(0, 17);

      if (device.name) {
        deviceName = device.name;
      }

      scanMenu[deviceName] = () => connectMeter(device);
    });
    scanMenu["Re-scan"] = () => scan();
    scanMenu["< Back"] = () => load();
    showScanMenu();
  },
  {
    filters: [{ services: [METER_SERVICE] }],
    active: true
  });
}

function start() {
  scanMenu['20:cd:39:a0:b2:35']();
}

Bangle.loadWidgets();
Bangle.drawWidgets();

scan();
