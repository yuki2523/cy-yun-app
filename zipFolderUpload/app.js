require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const Redis = require('ioredis');
const { Client } = require('pg');
const yauzl = require('yauzl');

const ossClient = new OSS({
  region: process.env.REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.BUCKET
});

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  db: process.env.REDIS_DB
});

const pgClient = new Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT
});
pgClient.connect();

const MAX_UNCOMPRESSED_FILE_SIZE = 500 * 1024 * 1024; // 单个文件500MB上限

// ZIP文件大小Check
async function checkZipSizeBeforeExtract(zipPath, maxUncompressedSize) {
  const zipfile = await new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      resolve(zipfile);
    });
  });

  let totalUncompressedSize = 0n;

  return await new Promise((resolve, reject) => {
    function readNext() {
      zipfile.readEntry();
    }

    zipfile.on('entry', (entry) => {
      totalUncompressedSize += BigInt(entry.uncompressedSize);
      if (totalUncompressedSize > maxUncompressedSize || entry.uncompressedSize > MAX_UNCOMPRESSED_FILE_SIZE) {
        zipfile.close();
        return reject(new Error('Uncompressed size exceeds limit.'));
      }
      readNext();
    });

    zipfile.on('end', () => {
      resolve(totalUncompressedSize);
    });

    zipfile.on('error', (err) => {
      reject(err);
    });

    readNext();
  });
}

// 消费者逻辑
async function consumer() {
  console.log('ZIP文件上传消费者已启动，等待任务...');
  while (true) {
    const message = await redisClient.blpop('zip_import', 0);
    if (message) {
      console.log('接收到任务:', message[1]);
      const task = JSON.parse(message[1]);
      const { taskId, userId, folderId, zipFileName } = task;
      const ZIP_DIR = `/var/zip_temp/upload/${taskId}/`;
      try {
        // 1. 查询任务表，获取oss_path
        const res = await pgClient.query('SELECT oss_path FROM tasks_register WHERE task_id = $1', [taskId]);
        if (!res.rows.length || !res.rows[0].oss_path) {
          throw new Error('任务未找到或oss_path为空');
        }
        await pgClient.query('UPDATE tasks_register SET status=$1, message=$2, updated_at=NOW() WHERE task_id=$3', ['processing', '任务正在处理中', taskId]);
        const ossPath = res.rows[0].oss_path;

        // 2. 下载zip文件到ZIP_DIR
        if (!fs.existsSync(ZIP_DIR)) fs.mkdirSync(ZIP_DIR, { recursive: true });
        const localZipPath = path.join(ZIP_DIR, zipFileName);
        const ossStream = await ossClient.getStream(ossPath);
        await new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(localZipPath);
          ossStream.stream.pipe(writeStream);
          ossStream.stream.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        // 3. 校验zip包大小，查用户配额表
        const quotaRes = await pgClient.query('SELECT upload_limit, upload_used FROM user_storage_quota WHERE user_id = $1', [userId]);
        if (!quotaRes.rows.length) {
          throw new Error('未找到用户存储配额信息');
        }
        const uploadLimit = BigInt(quotaRes.rows[0].upload_limit);
        const uploadUsed = BigInt(quotaRes.rows[0].upload_used);
        const maxUncompressedSize = uploadLimit - uploadUsed;
        if (maxUncompressedSize <= 0n) {
          throw new Error('用户存储空间已用尽');
        }
        await checkZipSizeBeforeExtract(localZipPath, maxUncompressedSize);

        // 4. 解压到 ZIP_DIR/zipFileNameWithoutExt/，解压完后删除zip文件
        const zipBaseName = path.parse(zipFileName).name;
        const extractDir = path.join(ZIP_DIR, zipBaseName);
        if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });
        await new Promise((resolve, reject) => {
          yauzl.open(localZipPath, { lazyEntries: true }, (err, zipfile) => {
            if (err) return reject(err);
            zipfile.readEntry();
            zipfile.on('entry', (entry) => {
              if (entry.fileName.endsWith('/')) {
                // 文件夹
                const dirPath = path.join(extractDir, entry.fileName);
                fs.mkdirSync(dirPath, { recursive: true });
                zipfile.readEntry();
              } else {
                // 文件
                const filePath = path.join(extractDir, entry.fileName);
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                zipfile.openReadStream(entry, (err, readStream) => {
                  if (err) return reject(err);
                  const writeStream = fs.createWriteStream(filePath);
                  readStream.pipe(writeStream);
                  writeStream.on('finish', () => zipfile.readEntry());
                  writeStream.on('error', reject);
                });
              }
            });
            zipfile.on('end', resolve);
            zipfile.on('error', reject);
          });
        });
        // 删除zip文件
        fs.unlinkSync(localZipPath);

        // 5. 递归导入到cloudfiles表并上传到OSS（事务模式，出错回滚）
        await pgClient.query('BEGIN');
        let importSuccess = false;
        try {
          async function importDirToCloudfiles(localDir, parentId) {
            const items = fs.readdirSync(localDir, { withFileTypes: true });
            for (const item of items) {
              const itemPath = path.join(localDir, item.name);
              const isFolder = item.isDirectory();
              // 插入cloudfiles
              const insertRes = await pgClient.query(
                `INSERT INTO cloudfiles (user_id, name, is_folder, parent_id, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
                [userId, item.name, isFolder, parentId]
              );
              const newId = insertRes.rows[0].id;
              if (isFolder) {
                await importDirToCloudfiles(itemPath, newId);
              } else {
                // 上传到OSS
                const now = new Date();
                const ossUploadPath = `${userId}/${now.getFullYear()}/${now.getMonth() < 9 ? '0' : ''}${now.getMonth() + 1}/${now.getDate()}/${Date.now()}-${item.name}`;
                await ossClient.multipartUpload(ossUploadPath, itemPath);
                const stat = fs.statSync(itemPath);
                // 更新cloudfiles记录
                await pgClient.query(
                  `UPDATE cloudfiles SET oss_path=$1, size=$2, file_suffix=$3 WHERE id=$4`,
                  [ossUploadPath, stat.size, path.extname(item.name), newId]
                );
                // 更新user_storage_quota.upload_used
                await pgClient.query(
                  `UPDATE user_storage_quota SET upload_used = (upload_used::bigint + $1)::text, updated_at = NOW() WHERE user_id = $2`,
                  [stat.size, userId]
                );
              }
            }
          }
          await importDirToCloudfiles(extractDir, folderId);
          importSuccess = true;
        } finally {
          if (importSuccess) {
            await pgClient.query('COMMIT');
          } else {
            await pgClient.query('ROLLBACK');
          }
        }

        // 6. 更新任务状态为successed
        await pgClient.query('UPDATE tasks_register SET status=$1, message=$2, updated_at=NOW() WHERE task_id=$3', ['successed', '任务成功', taskId]);

        // 清除缓存
        await redisClient.del(`recent_files:${userId}`);
      } catch (err) {
        // 任务失败，更新状态
        await pgClient.query('UPDATE tasks_register SET status=$1, message=$2, updated_at=NOW() WHERE task_id=$3', ['failed', err.message, taskId]);
        console.error('处理任务失败:', err);
      } finally {
        // 7.删除临时目录ZIP_DIR
        if (fs.existsSync(ZIP_DIR)) {
          fs.rmSync(ZIP_DIR, { recursive: true, force: true });
        }
        console.log('任务处理完成，等待下一个任务...');
      }
    }
  }
}

consumer();