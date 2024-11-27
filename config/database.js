const mysql = require('mysql2');
const { Client } = require('ssh2');
require('dotenv').config();

const sshClient = new Client();

// SSH connection configuration
const sshConfig = {
  host: process.env.SSH_HOST,
  port: process.env.SSH_PORT || 22,  // Default SSH port is 22
  username: process.env.SSH_USER,
  password: process.env.SSH_PASSWORD
};

// Database configuration
const dbConfig = {
  host: '127.0.0.1',  // Localhost through SSH tunnel
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,  // Default MySQL port is 3306
  waitForConnections: true,
  connectionLimit: 50,  // Adjust based on actual usage
  queueLimit: 0
};

// Create a promise-based pool using SSH tunnel
const createTunnel = () => {
  return new Promise((resolve, reject) => {
    sshClient.on('ready', () => {
      sshClient.forwardOut(
        '127.0.0.1',  // Localhost on the server side
        0,
        dbConfig.host,
        dbConfig.port,
        (err, stream) => {
          if (err) {
            sshClient.end();
            return reject(`SSH Forwarding Error: ${err.message}`);
          }

          // Create MySQL pool using the SSH tunnel
          const pool = mysql.createPool({
            ...dbConfig,
            stream: stream  // Use the SSH stream for connection
          }).promise();

          resolve(pool);
        }
      );
    })
    .on('error', (err) => {
      reject(`SSH Connection Error: ${err.message}`);
    })
    .connect(sshConfig);
  });
};

// Export an async function that returns the connection pool
let poolPromise = null;
const getPool = async () => {
  if (!poolPromise) {
    poolPromise = createTunnel()
      .then((pool) => {
        console.log('SSH Tunnel and MySQL Pool established successfully.');
        return pool;
      })
      .catch((err) => {
        console.error(err);
        poolPromise = null;  // Reset to allow retry on failure
        throw err;
      });
  }
  return poolPromise;
};

module.exports = getPool;
