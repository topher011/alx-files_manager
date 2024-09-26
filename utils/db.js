const { MongoClient } = require('mongodb');

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || 27017;
const DB = process.env.DB_DATABASE || 'files_manager';
const uri = `mongodb://${HOST}:${PORT}`;

class DBClient {
  constructor() {
    this.failed = true;
    MongoClient.connect(uri, { useUnifiedTopology: true }, (err, client) => {
      if (!err) {
        this.client = client;
        this.db = client.db(DB);
        this.files = this.db.collection('files');
        this.users = this.db.collection('users');
        this.failed = false;
      } else {
        console.log(err.message);
      }
    });
  }

  isAlive() {
    return !this.failed;
  }

  async nbUsers() {
    const collection = this.db.collection('users');
    const count = await collection.countDocuments();
    return count;
  }

  async nbFiles() {
    const collection = this.db.collection('files');
    const count = await collection.countDocuments();
    return count;
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
