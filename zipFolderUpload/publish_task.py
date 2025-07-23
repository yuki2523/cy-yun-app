import redis
import json
import uuid
import psycopg2
from datetime import datetime

# 配置 Redis 连接
REDIS_HOST = 'localhost'  # 如有需要请修改
REDIS_PORT = 6379
REDIS_DB = 3
QUEUE_NAME = 'zip_import'

# 配置 PostgreSQL 连接
PG_CONN = {
    'host': '127.0.0.1',
    'port': 5432,
    'user': 'postgres',
    'password': 'h818cy818_HCY!!',
    'dbname': 'rootdb'
}

# 生成任务参数
user_id = 'admin'
folder_id = "76a25a6d-c4b4-4d2b-a104-2a20e828ea58"
# folder_id = None
zip_file_name = '文件夹1111.zip'
task_id = str(uuid.uuid4())
# oss_path = f'zip_import/{user_id}/{task_id}/{zip_file_name}'
oss_path = f'zip_import/{user_id}/{zip_file_name}'

task = {
    'taskId': task_id,
    'userId': user_id,
    'folderId': folder_id,
    'zipFileName': zip_file_name
}

# 先插入 tasks_register 表
conn = psycopg2.connect(**PG_CONN)
cur = conn.cursor()
now = datetime.now()
cur.execute(
    '''
    INSERT INTO tasks_register (task_id, task_type, status, message, folder_id, oss_path, extra1, created_at, updated_at, user_id)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (task_id) DO NOTHING
    ''',
    (task_id, 'zip_import', 'pending', '等待处理', folder_id, oss_path, zip_file_name, now, now, user_id)
)
conn.commit()
cur.close()
conn.close()

# 发布任务到队列
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
r.lpush(QUEUE_NAME, json.dumps(task))
print(f"已发布任务: {task}")
