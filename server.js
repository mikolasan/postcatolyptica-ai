const Engine = require('./CatSearchEngine');

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

const winston = require('winston');
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'postcatolyptica' },
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log` 
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// 
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

let engine = new Engine((err, data) => {
  if (!err) {
    engineReady = true;
  } else {
    logger.error(err);
  }
})

app.get('/search', cors(), (req, res) => {
  const query = req.query.q
  if (query.length > 0 && engineReady) {
    let results = engine.search(query);
    logger.debug('search results', query, results.length);
    res.json(results);
  } else {
    res.status(400).send('Bad request')
  }
})

app.listen(port, () => logger.info(`PostCATolyptica listening on port ${port}!`))

