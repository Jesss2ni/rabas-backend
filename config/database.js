const mysql = require('mysql2');
const { Client } = require('ssh2');
require('dotenv').config();

const sshClient = new Client();

// SSH connection configuration
const sshConfig = {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT,
    username: process.env.SSH_USER,
    password: process.env.SSH_PASSWORD
};

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create a promise-based pool using SSH tunnel
const createTunnel = () => {
    return new Promise((resolve, reject) => {
        sshClient
            .on('ready', () => {
                sshClient.forwardOut(
                    '127.0.0.1',
                    0,
                    process.env.DB_HOST,
                    process.env.DB_PORT,
                    (err, stream) => {
                        if (err) reject(err);

                        // Create MySQL pool using the SSH tunnel
                        const pool = mysql.createPool({
                            ...dbConfig,
                            stream: stream // Use the SSH stream for connection
                        }).promise();

                        resolve(pool);
                    }
                );
            })
            .on('error', (err) => {
                console.error('SSH Connection Error:', err);
                reject(err);
            })
            .connect(sshConfig);
    });
};

// Export an async function that returns the connection pool
let poolPromise = null;
const getPool = async () => {
    if (!poolPromise) {
        poolPromise = createTunnel();
    }
    return poolPromise;
};

module.exports = getPool; 