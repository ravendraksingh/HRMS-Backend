// db.js
const mysql = require("mysql2/promise");

const poolConfig = {
  host: "localhost",
  user: "root",
  password: "password",
  database: "ems",
};

const pool = mysql.createPool(poolConfig);

module.exports = pool;
