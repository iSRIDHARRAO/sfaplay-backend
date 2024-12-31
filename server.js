const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const promClient = require('prom-client');
const config = require('./config/config.json').development;

// Initialize Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

const app = express();
const PORT = config.appPort;

app.use(cors());
app.use(bodyParser.json());

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Prometheus metric for HTTP request duration
const httpRequestDurationMilliseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5], 
});

app.use((req, res, next) => {
  const end = httpRequestDurationMilliseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.originalUrl, status_code: res.statusCode });
  });
  next();
});

// Initialize Sequelize
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  { host: config.host, dialect: config.dialect, port: config.port }
);

// Test DB connection
sequelize
  .authenticate()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch((err) => console.error('Unable to connect to PostgreSQL:', err));

// Define the Item model
const Item = sequelize.define('Item', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
  },
});

// CRUD Routes
app.get('/items', async (req, res) => {
  try {
    const items = await Item.findAll();
    res.json(items);
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).send('Error fetching items');
  }
});

app.post('/items', async (req, res) => {
  try {
    const item = await Item.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).send('Error adding item');
  }
});

app.put('/items/:id', async (req, res) => {
  try {
    const item = await Item.update(req.body, { where: { id: req.params.id } });
    res.status(200).json(item);
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).send('Error updating item');
  }
});

app.delete('/items/:id', async (req, res) => {
  try {
    await Item.destroy({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).send('Error deleting item');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
