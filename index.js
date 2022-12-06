var { config, app } = require("./server");

var port = process.env.PORT || config.port || 9999;

app.listen(port, null, function (err) {
  console.log("Alex Gatekeeper/portfolio backend: http://localhost:" + port);
});
