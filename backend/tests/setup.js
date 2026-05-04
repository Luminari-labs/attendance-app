const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../test.db');
process.env.DB_PATH = DB_PATH;
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.QR_SECRET = 'test_qr_secret';

const app = require('../index');

afterAll((done) => {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  done();
});

module.exports = { request, app, bcrypt, jwt };
