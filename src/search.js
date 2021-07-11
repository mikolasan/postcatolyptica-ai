const Engine = require('./CatSearchEngine');

let engineReady = false;
let engine = new Engine((err, data) => {
  if (!err) {
    engineReady = true;
  } else {
    logger.error(err);
  }
})

exports.handler = async (event, context) => {
  const query = event.queryStringParameters.q;
  if (query && query.length > 0 && engineReady) {
    let results = engine.search(query);
    return {
      statusCode: 200,
      body: JSON.stringify(results),
      headers: {
        "access-control-allow-origin": "*"
      }
    }
  } else {
    return {
      statusCode: 400,
      body: 'Bad request',
      headers: {
        "access-control-allow-origin": "*"
      }
    }
  }
};