const mongoose = require('mongoose');
const logger = require('../helpers/logging');
const AuditLogService = require('../services/auditLog.services');

const writeChunk = async (res, value) => {
  if (res.destroyed) throw new Error('Database export download was interrupted.');
  if (!res.write(value)) {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        res.off('drain', handleDrain);
        res.off('close', handleClose);
        res.off('error', handleError);
      };
      const handleDrain = () => { cleanup(); resolve(); };
      const handleClose = () => { cleanup(); reject(new Error('Database export download was interrupted.')); };
      const handleError = (error) => { cleanup(); reject(error); };
      res.once('drain', handleDrain);
      res.once('close', handleClose);
      res.once('error', handleError);
    });
  }
};

const exportDatabase = async (req, res) => {
  const database = mongoose.connection.db;
  if (!database) {
    return res.status(503).json({ data: null, message: 'Database connection is not ready.' });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `LeadFronter-database-backup-${timestamp}.mongosh.js`;
  const ejson = mongoose.mongo.BSON.EJSON;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    const appCollections = collections
      .map(({ name }) => name)
      .filter((name) => name && !name.startsWith('system.'))
      .sort((a, b) => a.localeCompare(b));

    await AuditLogService.create({
      userId: req.userId,
      action: 'Database Backup Exported',
      resource: 'Database',
      resourceId: database.databaseName,
      metadata: { collectionCount: appCollections.length },
      ip: req.ip,
    }).catch((error) => logger.error('Database export audit log failed', error));

    await writeChunk(res, [
      '// LeadFronter MongoDB backup',
      `// Created: ${new Date().toISOString()}`,
      `// Source database: ${JSON.stringify(database.databaseName)}`,
      '// Restore with: mongosh "<mongodb-connection-string>" --file <this-file>',
      '// WARNING: Import clears the contents of each collection listed below before restoring it.',
      '// Review the target database and keep this backup in a private, secure location.',
      '',
      `const restoreDb = db.getSiblingDB(${JSON.stringify(database.databaseName)});`,
      '',
      'await (async () => {',
    ].join('\n') + '\n');

    let documentCount = 0;
    for (const name of appCollections) {
      const collection = database.collection(name);
      await writeChunk(res, [
        `  // Application collection ${documentCount + 1}`,
        `  const collection_${documentCount}_name = ${JSON.stringify(name)};`,
        `  const collection_${documentCount} = restoreDb.getCollection(collection_${documentCount}_name);`,
        `  await collection_${documentCount}.deleteMany({});`,
        `  let batch_${documentCount} = [];`,
      ].join('\n') + '\n');

      const cursor = collection.find({}, { noCursorTimeout: true });
      let batchSize = 0;
      try {
        for await (const document of cursor) {
          const serialized = ejson.stringify(document, { relaxed: false });
          await writeChunk(res, `  batch_${documentCount}.push(EJSON.parse(${JSON.stringify(serialized)}));\n`);
          batchSize += 1;
          if (batchSize === 250) {
            await writeChunk(res, `  await collection_${documentCount}.insertMany(batch_${documentCount}); batch_${documentCount} = [];\n`);
            batchSize = 0;
          }
        }
      } finally {
        await cursor.close().catch(() => {});
      }

      await writeChunk(res, `  if (batch_${documentCount}.length) await collection_${documentCount}.insertMany(batch_${documentCount});\n\n`);
      const indexes = await collection.indexes();
      for (const index of indexes.filter((item) => item.name !== '_id_')) {
        const options = { ...index };
        delete options.key;
        delete options.ns;
        delete options.v;
        delete options.background;
        const serializedKey = ejson.stringify(index.key, { relaxed: false });
        const serializedOptions = ejson.stringify(options, { relaxed: false });
        await writeChunk(res, [
          `  await collection_${documentCount}.createIndex(EJSON.parse(${JSON.stringify(serializedKey)}), EJSON.parse(${JSON.stringify(serializedOptions)}));`,
        ].join('\n') + '\n');
      }
      await writeChunk(res, '\n');
      documentCount += 1;
    }

    await writeChunk(res, '})();\n');
    res.end();
  } catch (error) {
    logger.error('Database export failed', error);
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    res.status(500).json({ data: null, message: 'Database export could not be completed.' });
  }
};

module.exports = { exportDatabase };
