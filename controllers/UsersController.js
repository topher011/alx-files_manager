const { ObjectId } = require('mongodb');
const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const isUser = await dbClient.users.findOne(
      { email },
    );

    if (isUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const sha1Password = sha1(password);
    let result;
    try {
      result = await dbClient.users.insertOne(
        { email, password: sha1Password },
      );
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const user = { id: result.insertedId, email };
    return res.status(201).send(user);
  }

  // Returns the current user based on the token given
  static async getMe(req, res) {
    const token = req.header('X-Token') || '';

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userObj = await dbClient.users.findOne({ _id: ObjectId(userId) });

    const userData = {
      id: userObj._id.toString(),
      email: userObj.email,
    };

    return res.json(userData);
  }
}

module.exports = UsersController;
