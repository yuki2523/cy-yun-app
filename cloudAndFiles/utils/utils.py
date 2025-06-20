from argon2 import PasswordHasher
import base64
import uuid
import secrets
import json
from extensions import redis_client
from models import Cloudfiles, Users
from datetime import datetime
from flask import jsonify
import requests
from cryptography.fernet import Fernet

def json_response_creator(code, message, data=None):
    return jsonify({
        "code": code,
        "message": message,
        "data": data
    })

# 密码hash值生成
def generate_password_hash(password):
    ph = PasswordHasher()
    hash_value = ph.hash(password)
    return hash_value

# 密码hash值验证
def verify_password_hash(hash_data, password):
    ph = PasswordHasher()
    try:
        ph.verify(hash_data, password)  # 如果密码匹配，不会抛出异常
        return True
    except Exception as e:
        print(e)
        return False

# 随机ID，保证唯一性，用于captchaId，默认16位
def generate_base64_id(length=16):
    unique_bytes = uuid.uuid4().bytes  # 获取 UUID 的字节表示
    encoded = base64.urlsafe_b64encode(unique_bytes).decode('utf-8')  # Base64 编码
    return encoded[:length]

# 随机6位数字，用于验证码
def generate_secure_numeric_code():
    return ''.join(secrets.choice('0123456789') for _ in range(6))

# 设置验证码，默认10分钟有效期，返回字典
#   captcha_id：16位随机id，
#   captcha_code：6位随机数字，验证码
#   result：True 成功
def set_captcha(user_email, ex=600):
    captcha_id = generate_base64_id()
    captcha_code = generate_secure_numeric_code()
    return {
        "captcha_id": captcha_id,
        "captcha_code": captcha_code,
        "result": redis_client.set(captcha_id, json.dumps({
            "email": user_email,
            "code": captcha_code
        }), ex=ex)
    }

# 验证验证码，返回 True or False
def check_captcha(captcha_id, user_email, captcha_code):
    result = redis_client.get(captcha_id)
    redis_client.delete(captcha_id)
    if result is None:
        return False
    result = json.loads(result.decode())
    return result["email"] == user_email and result["code"] == captcha_code

def email_usable_validator(email):
    """
    检查邮箱是否可用（未被注册）。
    存在返回 False，不存在返回 True。
    """
    return Users.query.filter_by(email=email).first() is None

# 取消缓存最近文件列表
def invalidate_recent_files_cache(user_id):
    redis_key = f"recent_files:{user_id}"
    redis_client.delete(redis_key)

# 取消路径缓存
def unset_folder_path_cache(folder_id):
    try:
        redis_client.delete(f"path-cache-id:{folder_id}")
    except Exception as e:
        print(f"Redis delete error: {e}")

# 路径查找，加缓存，folder_id传文件的parent_id
def get_folder_path(folder_id, ex=600):
    cache_key = f"path-cache-id:{folder_id}"
    try:
        cached = redis_client.get(cache_key)
        if cached is not None:
            cached_data = json.loads(cached.decode())
            # 将字符串格式的 updated_at 转换回 datetime 对象
            for folder in cached_data['filePath']:
                if folder['updated_at']:
                    folder['updated_at'] = datetime.fromisoformat(folder['updated_at'])
            return cached_data
    except Exception as e:
        print(f"Redis get error: {e}")
    file_path = []
    current_id = folder_id
    while current_id:
        folder = Cloudfiles.query.filter_by(id=current_id).first()
        if not folder:
            break
        file_path.insert(0, {
            'id': str(folder.id),
            'name': folder.name,
            'updated_at': folder.updated_at.isoformat() if folder.updated_at else None
        })
        current_id = folder.parent_id
    result = {'filePath': file_path}
    try:
        redis_client.set(cache_key, json.dumps(result), ex=ex)
    except Exception as e:
        print(f"Redis set error: {e}")
    return result

def get_path_from_parent_folder(file):
    # 用 parent_id 查找路径
    path_info = get_folder_path(file.parent_id)
    path = path_info.get('filePath', [])

    # 拼接 full_path
    full_path = '/'.join(folder['name'] for folder in path)  # 父路径
    if full_path:
        full_path += '/' + file.name
    else:
        full_path = file.name

    # 加入 full_path 字段
    path_info['full_path'] = full_path
    return path_info

def get_file_suffix(file_name):
    """
    获取文件后缀名，并返回后缀名字符串。
    如果没有后缀名，返回空字符串。
    """
    if '.' in file_name:
        return file_name.rsplit('.', 1)[-1]
    else:
        return ''

# 邮件发送
def send_captcha_email(to, subject, html):
    api_url = "http://127.0.0.1:8080/send-email"  # 邮件服务地址

    # 准备请求数据
    data = {
        "to": to,
        "subject": subject,
        "html": html
    }

    try:
        # 发送 POST 请求
        response = requests.post(api_url, json=data)

        # 检查响应状态
        if response.status_code == 202:
            print("邮件发送请求已接收，正在处理中。")
            print("响应内容:", response.json())
        else:
            print(f"邮件请求失败，状态码: {response.status_code}")
            print("错误信息:", response.text)
    except requests.exceptions.RequestException as e:
        print(f"邮件请求发生错误: {e}")

# 邮件HTML内容生成
# mail_type
#   1：验证码
#   2：新用户通知
#   3：密码已重置通知
def generate_mail_html(mail_type, data):
    if mail_type == 1:
        return f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Captcha</title>
            </head>
            <body>
              <h1>Captcha Code</h1>
              <p>Your captcha code is: <strong>{data["captcha_code"]}</strong></p>
              <p>Please complete the verification within 10 minutes</p>
            </body>
            </html>
        """
    if mail_type == 2:
        return f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>New User</title>
            </head>
            <body>
              <h1>Welcome</h1>
              <p>Your userId is: <strong>{data["user_id"]}</strong></p>
              <p>Your password is: <strong>{data["password"]}</strong></p>
              <p>Please login <a href="https://www.ying2233.cn/react-app/user-list">User Management System</a></p>
            </body>
            </html>
        """
    if mail_type == 3:
        return f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>New User</title>
            </head>
            <body>
              <h1>Password has been reset</h1>
              <p>Your userId is: <strong>{data["userName"]}</strong></p>
              <p>Please login <a href="https://ying2233.cn/cy-yun-app/">User Management System</a></p>
            </body>
            </html>
        """
    return ""

# 固定密钥
FERNET_KEY = b'sxKsYesy6K3UxwR4lwZqslQDCgfgCMQi3Tl5s_JS3fE='
fernet = Fernet(FERNET_KEY)

def encrypt_key(raw_key: str) -> str:
    return fernet.encrypt(raw_key.encode()).decode()

def decrypt_key(enc_key: str) -> str:
    return fernet.decrypt(enc_key.encode()).decode()
