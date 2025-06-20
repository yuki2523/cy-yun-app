from flask import request, g
from functools import wraps
from utils.utils import json_response_creator
import re
import uuid

# 请求字段验证器
# 使用例如下
#  POST请求
# @app.route('/login', methods=['POST'])
# @validate_request(
#     required_fields=["userId", "password"],
#     field_validators={
#         "userId": InputValidator.validate_user_id,
#         "password": InputValidator.validate_password
#     }
# )
# def login():
#  GET请求
# @app.route('/check-email', methods=['GET'])
# @validate_request(
#     required_fields=["email"],
#     field_validators={"email": InputValidator.validate_email}
# )
# def check_email():
def validate_request(required_fields, field_validators=None):
    if field_validators is None:
        field_validators = {}

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # 解析数据来源
            if request.method in ['POST', 'PUT', 'PATCH']:
                try:
                    data = request.get_json(force=True)
                    if not isinstance(data, dict):
                        raise ValueError("Invalid JSON")
                except Exception as e:
                    print(e)
                    return json_response_creator("2", "Invalid or missing JSON data")
            elif request.method == 'GET':
                data = request.args.to_dict()
            else:
                return json_response_creator("2", f"Unsupported request method: {request.method}")

            # 检查必填字段
            for field in required_fields:
                if field not in data or not str(data[field]).strip():
                    return json_response_creator("2", f"{field} is required and cannot be empty")

            # 校验字段合法性
            for field, validator in field_validators.items():
                if field in data and not validator(data[field]):
                    return json_response_creator("2", f"{field} is invalid")

            # 存入全家变量 g 以供视图函数使用
            g.validated_data = data

            return func(*args, **kwargs)

        return wrapper
    return decorator

# 字段验证
class InputValidator:
    @staticmethod
    def validate_user_name(user_name):
        """
        验证用户名是否合法：不允许特殊字符，仅允许汉字、字母、数字、下划线，限制长度 3 到 50
        """
        if not isinstance(user_name, str) or not 3 <= len(user_name) <= 50:
            return False
        return re.match(r"^[\u4e00-\u9fa5_a-zA-Z0-9]+$", user_name) is not None

    @staticmethod
    def validate_positive_int(value):
        """
        验证数字字段是否合法：仅允许数字，大于等于0
        """
        if isinstance(value, int):
            return value >= 0
        if isinstance(value, str) and value.isdigit():
            return int(value) >= 0
        return False

    @staticmethod
    def validate_email(email):
        """
        验证邮箱是否合法：使用基本正则匹配邮箱格式，限制最大长度 100
        """
        if not isinstance(email, str) or len(email) > 100:
            return False
        email_pattern = re.compile(r"^[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}$")
        return email_pattern.match(email) is not None

    @staticmethod
    def validate_password(password):
        """
        验证密码是否合法：长度 8 到 50，且不允许有可能产生SQL注入的特殊字符
        允许字母、数字和常见符号（不允许 ' " ; \ 空格）
        """
        if not isinstance(password, str) or not 8 <= len(password) <= 50:
            return False
        # 禁止出现 ' " ; \ 和空格
        if re.search(r"[\'\";\\\s]", password):
            return False
        return True

    @staticmethod
    def validate_introduction(introduction):
        """
        验证用户简介是否合法：限制长度 0 到 100，防止 SQL 注入的特殊字符
        `introduction` 可以是空字符串或 None（验证通过）。
        """
        if introduction is None or introduction == "":  # 如果为空值，返回 True
            return True
        if not isinstance(introduction, str) or len(introduction) > 100:
            return False
        safe_pattern = re.compile(r"[^a-zA-Z0-9\s.,!?\"'；：，。！？、\-()（）]+")  # 允许的字符
        return safe_pattern.search(introduction) is None

    @staticmethod
    def validate_user_id(user_id):
        """
        验证 userId 是否合法：必须以 'USERID-' 开头，后面跟一个 UUID 字符串f"USERID-{str(uuid.uuid4())}"，还有一个特别的字段，"admin"。
        """
        if user_id == "admin":
            return True
        if isinstance(user_id, str) and user_id.startswith("USERID-"):
            uuid_part = user_id[7:]
            try:
                uuid.UUID(uuid_part)
                return True
            except Exception:
                return False
        return False

    @staticmethod
    def validate_captcha_code(captcha_code):
        """
        验证 captchaCode 是否合法：必须为 6 位数字。
        """
        if not isinstance(captcha_code, str) or len(captcha_code) != 6:  # 长度必须为 6
            return False
        return re.match(r"^\d{6}$", captcha_code) is not None

    @staticmethod
    def validate_file_id(file_id):
        """
        验证 file_id/parent_id 是否合法：UUID，或None。
        """
        if file_id is None:
            return True
        if isinstance(file_id, str):
            try:
                uuid.UUID(file_id)
                return True
            except ValueError:
                return False
        return False

    @staticmethod
    def validate_file_id_not_none(file_id):
        """
        验证 file_id/parent_id 是否合法：UUID，或None。
        """
        if file_id is None:
            return False
        if isinstance(file_id, str):
            try:
                uuid.UUID(file_id)
                return True
            except ValueError:
                return False
        return False

    @staticmethod
    def validate_select_code(select_code):
        """
        验证 type_id/editable_id 是否合法："1", "2"，或None。
        """
        if select_code is None:
            return True
        return select_code in ("1", "2")

    @staticmethod
    def validate_file_name(file_name):
        """
        验证文件名是否合法：
        - 不能为空
        - 不能全是空格（包括全角空格）
        - 不能只包含单个空格
        - 不能包含SQL注入高危字符
        """
        if not isinstance(file_name, str):
            return False
        # 去除所有空格（半角和全角）
        stripped = file_name.replace(' ', '').replace('\u3000', '')
        if not stripped:
            return False
        # 不能只包含一个空格或全角空格
        if file_name.strip() in ('', ' ', '\u3000'):
            return False
        # 禁止SQL注入高危字符
        if re.search(r"[\'\";\\]|--|/\*|\*/|xp_|exec|union|select|insert|update|delete|drop|alter|create|truncate",
                     file_name, re.IGNORECASE):
            return False
        return True

    @staticmethod
    def validate_file_path(file_path):
        """
        验证文件路径是否合法：
        - 不能为空
        - 不能全是空格（包括全角空格）
        - 不能只包含单个空格
        - 允许/作为路径分隔符
        - 不能包含SQL注入高危字符
        """
        if not isinstance(file_path, str):
            return False
        # 去除所有空格（半角和全角）
        stripped = file_path.replace(' ', '').replace('\u3000', '').replace('/', '')
        if not stripped:
            return False
        # 不能只包含空格或全角空格或斜杠
        if file_path.strip() in ('', ' ', '\u3000', '/'):
            return False
        # 禁止SQL注入高危字符
        if re.search(r"[\'\";\\]|--|/\*|\*/|xp_|exec|union|select|insert|update|delete|drop|alter|create|truncate",
                     file_path, re.IGNORECASE):
            return False
        return True

    @staticmethod
    def validate_file_content(content):
        # 必须是字符串
        if not isinstance(content, str):
            return False
        # 最大 10MB（10485760 字节）
        if len(content.encode("utf-8")) > 10485760:
            return False
        return True