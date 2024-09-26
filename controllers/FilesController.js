const fs = require('fs');
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    const path = process.env.FOLDER_PATH || '/tmp/files_manager';
    const error = { error: 'Unauthorized' };
    const acceptedTypes = ['folder', 'file', 'image'];
    const token = req.header('X-token');

    if (!token) return res.status(401).json(error);

    const userId = await redisClient.get(`auth_${token}`);

    const userObj = await dbClient.users.findOne({ _id: ObjectId(userId) });

    if (!userObj) return res.status(401).json(error);

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });

    if (!type || !acceptedTypes.includes(type)) return res.status(400).json({ error: 'Missing type' });

    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });

    if (parentId) {
      const fileObj = await dbClient.files.findOne({ _id: ObjectId(parentId) });
      if (!fileObj) return res.status(400).json({ error: 'Parent not found' });
      if (fileObj.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    if (type === 'folder') {
      const file = {
        name, type, userId, parentId, isPublic, data,
      };
      await dbClient.files.insertOne(file);
      file.id = file._id;
      delete file._id;
      return res.status(201).json(file);
    }

    // creates the file storage directory if it does not exist
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }

    const filename = uuidv4();
    const clearData = Buffer.from(data, 'base64').toString('utf-8');
    const localPath = `${path}/${filename}`;

    const file = {
      name, type, userId, parentId, isPublic, localPath,
    };

    fs.writeFile(localPath, clearData, { flag: 'wx' }, async (err) => {
      if (err) return res.status(400).json({ error: err.message });
      await dbClient.files.insertOne(file);
      file.id = file._id;
      delete file._id;
      delete file.localPath;
      return res.status(201).json(file);
    });
    return 0;
  }

  static async getShow(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-token');

    const userId = await redisClient.get(`auth_${token}`);
    const userObj = await dbClient.users.findOne({ _id: ObjectId(userId) });

    // Verify the auth token sent by user
    if (!userObj) return res.status(401).json({ error: 'Unauthorized' });

    const fileObj = await dbClient.files.findOne({
      _id: ObjectId(fileId),
      userId,
    });

    // If the file is not found
    if (!fileObj) return res.status(404).json({ error: 'Not found' });

    delete fileObj.localPath;
    fileObj.id = fileObj._id;
    delete fileObj._id;
    return res.status(200).json(fileObj);
  }

  static async getIndex(req, res) {
    const token = req.header('X-token');

    const { parentId = 0, page = 0 } = req.query;

    const userId = await redisClient.get(`auth_${token}`);
    const userObj = await dbClient.users.findOne({ _id: ObjectId(userId) });

    // Verify the auth token sent by user
    if (!userObj) return res.status(401).json({ error: 'Unauthorized' });

    let query;
    if (parentId !== 0) {
      query = { userId, parentId };
    } else {
      query = { userId };
    }

    const filesPage = dbClient.files.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
	{ $skip: parseInt(page) * 20 },
      { $limit: 20 },
    ]);

    const pageData = await filesPage.toArray();
    const filteredData = pageData.map((current) => {
      const obj = current;
      obj.id = obj._id;
      delete obj._id;
      delete obj.localPath;
      return obj;
    });
    console.log(filteredData);

    return res.json(filteredData);
  }
}

module.exports = FilesController;
