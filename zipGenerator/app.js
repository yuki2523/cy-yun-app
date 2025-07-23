require('dotenv').config();
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const OSS = require('ali-oss');
const Redis = require('ioredis');
const { Client } = require('pg');

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

// 更新任务状态的通用函数
async function updateTaskStatus(taskId, status, message = null, ossPath = null) {
  const query = `
    UPDATE tasks_register
    SET status = $1,
        message = $2,
        oss_path = COALESCE($3, oss_path),
        updated_at = NOW()
    WHERE task_id = $4
  `;
  const values = [status, message, ossPath, taskId];
  await pgClient.query(query, values);
}

// 递归获取文件结构并在 ZIP_DIR 下创建目录和文件
async function buildFolderStructure(userId, parentId, targetDir) {
  // 查询当前目录下所有未删除的文件和文件夹
  const res = await pgClient.query(
    `SELECT id, name, is_folder, oss_path, online_editable FROM cloudfiles WHERE user_id = $1 AND parent_id ${parentId ? '= $2' : 'IS NULL'} AND deleted_at IS NULL`,
    parentId ? [userId, parentId] : [userId]
  );
  for (const row of res.rows) {
    const itemPath = path.join(targetDir, row.name);
    if (row.is_folder) {
      // 创建文件夹
      if (!fs.existsSync(itemPath)) {
        fs.mkdirSync(itemPath, { recursive: true });
      }
      // 递归处理子目录
      await buildFolderStructure(userId, row.id, itemPath);
    } else {
      // 文件
      if (row.online_editable) {
        // 可在线编辑文件，从 filecontent 取内容
        const contentRes = await pgClient.query(
          'SELECT content FROM filecontent WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [row.id, userId]
        );
        const content = contentRes.rows[0]?.content || '';
        fs.writeFileSync(itemPath, content, 'utf8');
      } else {
        // 不可在线编辑文件，从 OSS 下载
        if (row.oss_path) {
          const result = await ossClient.get(row.oss_path);
          fs.writeFileSync(itemPath, result.content);
        }
      }
    }
  }
}

async function createZipFile(sourceDir, outputZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 设置压缩级别
    });

    output.on('close', () => {
      console.log('ZIP文件创建完成，总大小：', archive.pointer(), '字节');
      resolve();
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('警告:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    output.on('end', () => {
      console.log('数据已写入ZIP文件');
    });

    archive.directory(sourceDir, false);
    archive.pipe(output);
    archive.finalize();
  });
}

// 消费者逻辑
async function consumer() {
  console.log('ZIP生成器消费者已启动，等待任务...');
  while (true) {
    const message = await redisClient.blpop('zip_export', 0);
    if (message) {
      console.log('接收到任务:', message[1]);
      const task = JSON.parse(message[1]);
      const { taskId, userId, folderId, zipFileName } = task;
      const ZIP_DIR = `/var/zip_temp/gen/${taskId}/`;
      try {
        // 1.更新任务状态为处理中
        await updateTaskStatus(taskId, 'processing', '任务正在处理中');

        // 2.从文件与文件夹关系表cloudfiles获取文件结构，采用递归方式
        // 构建根目录
        const rootDir = path.join(ZIP_DIR, zipFileName.replace(/\.zip$/i, ''));
        if (!fs.existsSync(rootDir)) {
          fs.mkdirSync(rootDir, { recursive: true });
        }
        await buildFolderStructure(userId, folderId, rootDir);

        // 3.将文件打包成zip文件
        // 使用 createZipFile 打包文件夹为 zip 文件
        await createZipFile(rootDir, path.join(ZIP_DIR, zipFileName));

        // 4.将zip文件上传到OSS，zip文件的OSS地址存入数据库
        // 上传zip文件到OSS
        const uploadOssPath = `archive/${userId}/${taskId}/${zipFileName}`;
        const localZipPath = path.join(ZIP_DIR, zipFileName);
        await ossClient.multipartUpload(uploadOssPath, localZipPath);

        // 5.更新任务状态为任务成功
        await updateTaskStatus(taskId, 'successed', '任务成功', uploadOssPath);
      } catch (error) {
        console.error('Error processing message:', error);
        // 6.更新任务状态为任务失败
        if (taskId) {
          await updateTaskStatus(taskId, 'failed', error.message);
        }
      } finally {
        // 7.删除临时目录ZIP_DIR
        if (fs.existsSync(ZIP_DIR)) {
          fs.rmSync(ZIP_DIR, { recursive: true, force: true });
        }
        // await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('任务处理完成，等待下一个任务...');
      }
    }
  }
}

consumer();