// credit to prose/gatekeeper

var url = require("url"),
  http = require("http"),
  https = require("https"),
  fs = require("fs"),
  qs = require("querystring"),
  express = require("express"),
  app = express(),
  AWS = require("aws-sdk");

require("dotenv").config();

AWS.config.credentials = new AWS.Credentials({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
AWS.config.update({ region: "us-east-1" });
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// const params = {
//   TableName: "users",
//   Item: {
//     id: "4",
//     name: "Alex 2",
//     avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
//     profileUrl: "httpsL//github.com/bergvall95",
//     email: "bergvall95@gmail.com",
//   },
// };

// dynamoDb.put(params, (error, data) => {
//   if (error) {
//     console.log(error);
//   } else {
//     console.log("Success");
//     console.log(data);
//   }
// });

var TRUNCATE_THRESHOLD = 10,
  REVEALED_CHARS = 3,
  REPLACEMENT = "***";

// Load config defaults from JSON file.
// Environment variables override defaults.
function loadConfig() {
  var config = JSON.parse(fs.readFileSync(__dirname + "/config.json", "utf-8"));
  log("Configuration");
  for (var i in config) {
    var configItem = process.env[i.toUpperCase()] || config[i];
    if (typeof configItem === "string") {
      configItem = configItem.trim();
    }
    config[i] = configItem;
    if (i === "oauth_client_id" || i === "oauth_client_secret") {
      log(i + ":", config[i], true);
    } else {
      log(i + ":", config[i]);
    }
  }
  return config;
}

var config = loadConfig();

function authenticate(code, cb) {
  var data = qs.stringify({
    client_id: config.oauth_client_id,
    client_secret: config.oauth_client_secret,
    code: code,
  });

  var reqOptions = {
    host: config.oauth_host,
    port: config.oauth_port,
    path: config.oauth_path,
    method: config.oauth_method,
    headers: { "content-length": data.length },
  };

  var body = "";
  var req = https.request(reqOptions, function (res) {
    res.setEncoding("utf8");
    res.on("data", function (chunk) {
      body += chunk;
    });
    res.on("end", function () {
      cb(null, qs.parse(body).access_token);
    });
  });

  req.write(data);
  req.end();
  req.on("error", function (e) {
    cb(e.message);
  });
}

/**
 * Handles logging to the console.
 * Logged values can be sanitized before they are logged
 *
 * @param {string} label - label for the log message
 * @param {Object||string} value - the actual log message, can be a string or a plain object
 * @param {boolean} sanitized - should the value be sanitized before logging?
 */
function log(label, value, sanitized) {
  value = value || "";
  if (sanitized) {
    if (typeof value === "string" && value.length > TRUNCATE_THRESHOLD) {
      console.log(label, value.substring(REVEALED_CHARS, 0) + REPLACEMENT);
    } else {
      console.log(label, REPLACEMENT);
    }
  } else {
    console.log(label, value);
  }
}

// Convenience for allowing CORS on routes
// write app.all to allow get put post delete requests
app.use(express.json());
app.all("*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

app.get("/users", function (req, res) {
  const params = {
    TableName: "users",
  };

  console.log("got users");

  dynamoDb.scan(params, (error, data) => {
    if (error) {
      res.status(400).json({ error: "Could not get users" });
    }
    if (data) {
      res.json(data.Items);
    }
  });
});

// TODO: add a route for creating a new user in dynamoDB
app.put("/users/create", function (req, res) {
  const { id, name, avatarUrl, profileUrl } = req.body;
  if (typeof id !== "string") {
    res.status(400).json({ error: '"id" must be a string' });
  } else if (typeof name !== "string") {
    res.status(400).json({ error: '"name" must be a string' });
  } else if (typeof avatarUrl !== "string") {
    res.status(400).json({ error: '"avatarUrl" must be a string' });
  } else if (typeof profileUrl !== "string") {
    res.status(400).json({ error: '"profileUrl" must be a string' });
  } else {
    const params = {
      TableName: "users",
      Item: {
        id: id,
        name: name,
        avatarUrl: avatarUrl,
        profileUrl: profileUrl,
      },
    };
    dynamoDb.put(params, (error) => {
      if (error) {
        res.status(400).json({ error: "Could not create user" });
      }
      res.json({ id, name, avatarUrl, profileUrl });
    });
  }
});

/* TODO: 
1. add a route for adding a comment in dynamoDB 
2. add a route for getting all comments from dynamoDB
3. add a route for getting all comments from a specific user
*/

// getting 404 error here when trying to create a comment calling from the front end
//
// write route for creating a new comment in dynamoDB

app.post("/comments/create", function (req, res) {
  const { id, user, text, timestamp } = req.body;

  if (typeof id !== "string") {
    console.log("id is not a string");
    res.status(400).json({ error: '"id" must be a string' });
  } else if (typeof user !== "object") {
    console.log("user is not an object");
    res.status(400).json({ error: '"user" must be an object' });
  } else if (typeof text !== "string") {
    console.log("text is not a string");
    res.status(400).json({ error: '"text" must be a string' });
  } else if (typeof timestamp !== "string") {
    console.log("timestamp is not a number");
    res.status(400).json({ error: '"timestamp" must be a string' });
  } else {
    const params = {
      TableName: "Comments",
      Item: {
        id: id,
        userId: user.id,
        user: user,
        text: text,
        timestamp: timestamp,
      },
    };
    dynamoDb.put(params, (error, data) => {
      if (error) {
        console.log(params);
        console.log(error);
        console.log("error creating comment");
        res.status(400).json({ error: "Could not create comment" });
      } else {
        res.json({ message: "post created Successfully" });
      }
    });
  }
});

app.get("/comments", function (req, res) {
  const params = {
    TableName: "Comments",
  };

  dynamoDb.scan(params, (error, data) => {
    if (error) {
      res.status(400).json({ error: "Could not get comments" });
    }
    if (data) {
      res.json(data.Items);
    }
  });
});

//create a route to delete a comment by id
app.delete("/comments/delete/:id/:userId", function (req, res) {
  const params = {
    TableName: "Comments",
    Key: {
      id: req.params.id,
      userId: req.params.userId,
    },
  };
  dynamoDb.delete(params, (error, data) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: "Could not delete comment" });
    }
    if (data) {
      res.json({ message: "comment deleted successfully" });
    }
  });
});

app.get("/authenticate/:code", function (req, res) {
  log("authenticating code:", req.params.code, true);
  authenticate(req.params.code, function (err, token) {
    var result;
    if (err || !token) {
      result = { error: err || "bad_code" };
      log(result.error);
    } else {
      result = { token: token };
      log("token", result.token, true);
    }
    res.json(result);
  });
});

module.exports.config = config;
module.exports.app = app;
