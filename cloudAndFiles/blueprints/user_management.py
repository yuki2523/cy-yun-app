from flask import Blueprint, request, g
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
    get_jwt,
    get_jwt_identity
)
from extensions import redis_client, db
from models import Users, UserStorageQuota, SystemConfig
from utils.utils import verify_password_hash, json_response_creator, check_captcha, set_captcha, send_captcha_email, email_usable_validator, generate_password_hash, generate_mail_html, generate_base64_id
from datetime import datetime
from utils.filed_check import validate_request, InputValidator
import uuid

user_management = Blueprint('user_management', __name__, url_prefix='/user-management')

@user_management.route("/login/", methods=["POST"])
@validate_request(
    required_fields=["email", "password"],
    field_validators={
        "email": InputValidator.validate_email,
        "password": lambda x: isinstance(x, str) and 8 <= len(x) <= 50
    }
)
def login():
    email = g.validated_data.get("email")
    password = g.validated_data.get("password")
    if not email or not password:
        return json_response_creator("9", "Missing email or password")
    user = Users.query.filter_by(email=email, deleted_at=None).first()
    if not user or not verify_password_hash(user.password, password):
        return json_response_creator("99", "login failed")
    if not user.is_active:
        return json_response_creator("9", "user is not active")
    access_token = create_access_token(
        user.user_id,
        additional_claims={"user_group": user.user_group}
    )
    response = json_response_creator(
        "1",
        "login success",
        {
            "yunId": user.user_id,
            "userName": user.user_name,
            "email": user.email,
            "userGroup": user.user_group
        }
    )
    set_access_cookies(response, access_token)
    return response

@user_management.route("/logout/", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    expires_at = get_jwt()["exp"]
    remaining_time = expires_at - int(datetime.now().timestamp())
    redis_client.set(f"jwt_blacklist:{jti}", "true", ex=remaining_time)
    response = json_response_creator(
        "1",
        "logout success"
    )
    unset_jwt_cookies(response)
    return response

@user_management.route("/register/", methods=["POST"])
@validate_request(
    required_fields=["captchaId", "captchaCode", "email", "password", "password2"],
    field_validators={
        "captchaCode": InputValidator.validate_captcha_code,
        "email": InputValidator.validate_email,
        "password": InputValidator.validate_password,
        "password2": InputValidator.validate_password
    }
)
def register():
    try:
        # 注册许可判断
        system_config = SystemConfig.query.filter_by(config_key="register_enable").first()
        if system_config is None or (system_config and system_config.config_value != "1"):
            return json_response_creator("9", "register is disabled by admin")

        data = g.validated_data
        captcha_id = data.get('captchaId')
        captcha_code = data.get('captchaCode')
        user_email = data.get('email')
        password = data.get('password')
        password2 = data.get('password2')
        if not check_captcha(captcha_id, user_email, captcha_code):
            return json_response_creator("2", "captcha is wrong or expired")
        if not email_usable_validator(user_email):
            return json_response_creator("2", "email is not usable")
        if password != password2:
            return json_response_creator("2", "password and password2 are not the same")
        user_id = f"USERID-{str(uuid.uuid4())}"
        user =  Users(
            user_id=user_id,
            email=user_email,
            password=generate_password_hash(password),
            is_active=True,
            user_group="user",  # 默认角色为普通用户
            user_name= user_email.split('@')[0]  # 默认用户名为邮箱前缀
        )
        user_storage_quota =  UserStorageQuota(user_id=user_id)
        db.session.add_all([user, user_storage_quota])
        db.session.commit()
        access_token = create_access_token(
            user_id,
            additional_claims={"user_group": user.user_group}
        )
        response = json_response_creator(
            "1",
            "register success",
            {
                "yunId": user_id,
                "userName": user.user_name,
                "email": user_email,
                "userGroup": user.user_group
            }
        )
        set_access_cookies(response, access_token)
        return response
    except Exception as e:
        db.session.rollback()
        print(f"Error during registration: {e}")
        return json_response_creator("9", "register failed due to an error")


@user_management.route("/get-captcha/")
@validate_request(
    required_fields=["email"],
    field_validators={
        "email": InputValidator.validate_email
    }
)
def get_captcha():
    try:
        user_email = g.validated_data.get('email')
        captcha = set_captcha(user_email, ex=600)
        if captcha["result"]:
            send_captcha_email(user_email, "Captcha Code", generate_mail_html(1, captcha))  # 邮件发送
            # print(f"captchaId: {captcha['captcha_id']}, captchaCode: {captcha['captcha_code']}")
            return json_response_creator("1", "captcha send success", {
                "captchaId": captcha["captcha_id"]
            })
        return json_response_creator("2", "captcha set failed")
    except Exception as e:
        print(f"Error during captcha generation: {e}")
        return json_response_creator("9", "captcha generation failed due to an error")

@user_management.route("/user-get-captcha/")
@jwt_required()
def user_get_captcha():
    try:
        user_id = get_jwt_identity()
        user = Users.query.filter_by(user_id=user_id, deleted_at=None).first()
        if not user:
            return json_response_creator("9", "User not found")
        user_email = user.email
        captcha = set_captcha(user_email, ex=600)
        if captcha["result"]:
            send_captcha_email(user_email, "Captcha Code", generate_mail_html(1, captcha))  # 邮件发送
            # print(f"captchaId: {captcha['captcha_id']}, captchaCode: {captcha['captcha_code']}")
            return json_response_creator("1", "captcha send success", {
                "captchaId": captcha["captcha_id"]
            })
        return json_response_creator("2", "captcha set failed")
    except Exception as e:
        print(f"Error during captcha generation: {e}")
        return json_response_creator("9", "captcha generation failed due to an error")

@user_management.route("/user-storage-quota/", methods=["GET"])
@jwt_required()
def get_user_storage_quota():
    user_id = get_jwt_identity()
    quota = UserStorageQuota.query.filter_by(user_id=user_id).first()
    if not quota:
        return json_response_creator("9", "User storage quota not found")
    return json_response_creator("1", "success", quota.to_dict())

@user_management.route("/user-profile/", methods=["GET"])
@jwt_required()
def user_profile():
    user_id = get_jwt_identity()
    user = Users.query.filter_by(user_id=user_id, deleted_at=None).first()
    if not user:
        return json_response_creator("9", "User not found")
    return json_response_creator("1", "success", {
        "email": user.email,
        "userName": user.user_name
    })

@user_management.route("/update-email/", methods=["POST"])
@jwt_required()
@validate_request(
    required_fields=["newEmail", "captchaId", "captchaCode"],
    field_validators={
        "newEmail": InputValidator.validate_email,
        "captchaCode": InputValidator.validate_captcha_code
    }
)
def update_email():
    try:
        user_id = get_jwt_identity()
        data = g.validated_data
        new_email = data.get("newEmail")
        captcha_id = data.get("captchaId")
        captcha_code = data.get("captchaCode")
        user = Users.query.filter_by(user_id=user_id, deleted_at=None).first()
        if not user:
            return json_response_creator("9", "User not found")
        if not email_usable_validator(new_email):
            return json_response_creator("9", "Email is not usable")
        if not check_captcha(captcha_id, user.email, captcha_code):
            return json_response_creator("2", "captcha is wrong or expired")
        user.email = new_email
        user.updated_at = datetime.now()
        db.session.commit()
        return json_response_creator("1", "Email updated successfully", {"email": new_email})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating email: {e}")
        return json_response_creator("9", "Error updating email")

@user_management.route("/update-user-info/", methods=["POST"])
@jwt_required()
@validate_request(
    required_fields=["userName"],
    field_validators={
        "userName": InputValidator.validate_user_name
    }
)
def update_user_info():
    try:
        user_id = get_jwt_identity()
        new_name = g.validated_data.get("userName")
        user = Users.query.filter_by(user_id=user_id, deleted_at=None).first()
        if not user:
            return json_response_creator("9", "User not found")
        user.user_name = new_name
        user.updated_at = datetime.now()
        db.session.commit()
        return json_response_creator("1", "User name updated successfully", {"userName": new_name})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating user info: {e}")
        return json_response_creator("9", "Error updating user info")

@user_management.route("/user-list/", methods=["GET"])
@jwt_required()
@validate_request(
    required_fields=[],
    field_validators={
        "offset": InputValidator.validate_positive_int,
        "limit": InputValidator.validate_positive_int
    }
)
def user_list():
    jwt_data = get_jwt()
    if jwt_data.get("user_group") != "admin":
        return json_response_creator("9", "Permission denied")
    offset = int(g.validated_data.get('offset', 0))
    limit = int(g.validated_data.get('limit', 10))
    query = Users.query.filter_by(deleted_at=None)
    total_count = query.count()
    users = query.order_by(Users.updated_at.desc()).offset(offset).limit(limit).all()
    user_ids = [u.user_id for u in users]
    quotas = {q.user_id: q.to_dict() for q in UserStorageQuota.query.filter(UserStorageQuota.user_id.in_(user_ids)).all()}
    result = []
    for user in users:
        quota = quotas.get(user.user_id)
        result.append({
            "id": user.user_id,
            "email": user.email,
            "userName": user.user_name,
            "isActive": user.is_active,
            "storageUsed": quota if quota else None,
            "updatedAt": user.updated_at,
            "deletedAt": user.deleted_at
        })
    return json_response_creator("1", "success", {
        "items": result,
        "total": total_count
    })

@user_management.route("/update-user-storage-quota/", methods=["POST"])
@jwt_required()
@validate_request(
    required_fields=["userId", "onlineEditLimit", "uploadLimit"],
    field_validators={
        "userId": InputValidator.validate_user_id,
        "onlineEditLimit": InputValidator.validate_positive_int,
        "uploadLimit": InputValidator.validate_positive_int
    }
)
def update_user_storage_quota():
    try:
        jwt_data = get_jwt()
        if jwt_data.get("user_group") != "admin":
            return json_response_creator("9", "Permission denied")
        data = g.validated_data
        user_id = data.get("userId")
        online_edit_limit = data.get("onlineEditLimit")
        upload_limit = data.get("uploadLimit")
        quota = UserStorageQuota.query.filter_by(user_id=user_id).first()
        if not quota:
            return json_response_creator("9", "User storage quota not found")
        quota.update_limits(online_edit_limit=online_edit_limit, upload_limit=upload_limit)
        db.session.commit()
        return json_response_creator("1", "User storage quota updated", quota.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"Error updating user storage quota: {e}")
        return json_response_creator("9", "Error updating user storage quota")

@user_management.route("/update-user-active/", methods=["POST"])
@jwt_required()
@validate_request(
    required_fields=["userId", "isActive"],
    field_validators={
        "userId": InputValidator.validate_user_id,
        "isActive": lambda x: x in ("0", "1")
    }
)
def update_user_active():
    try:
        jwt_data = get_jwt()
        if jwt_data.get("user_group") != "admin":
            return json_response_creator("9", "Permission denied")
        data = g.validated_data
        user_id = data.get("userId")
        is_active = True if data.get("isActive") == "1" else False
        user = Users.query.filter_by(user_id=user_id).first()
        if not user:
            return json_response_creator("9", "User not found")
        user.is_active = is_active
        user.updated_at = datetime.now()
        db.session.commit()
        return json_response_creator("1", "User active status updated", {"userId": user_id, "isActive": is_active})
    except Exception as e:
        db.session.rollback()
        print(f"Error updating user active status: {e}")
        return json_response_creator("9", "Error updating user active status")

@user_management.route("/forget-password/", methods=["POST"])
@validate_request(
    required_fields=["captchaId", "captchaCode", "email"],
    field_validators={
        "captchaCode": InputValidator.validate_captcha_code,
        "email": InputValidator.validate_email,
    }
)
def forget_password():
    data = g.validated_data
    captcha_id = data.get('captchaId')
    captcha_code = data.get('captchaCode')
    user_email = data.get('email')
    if not check_captcha(captcha_id, user_email, captcha_code):
        return json_response_creator("2", "captcha is wrong or expired")
    user = Users.query.filter_by(email=user_email, deleted_at=None).first()
    if user is None:
        return json_response_creator("2", "user is not found")
    user_token = generate_base64_id()
    redis_client.set(user_token, user.email, ex=600)
    return json_response_creator("1", "forget password successfully, please check your email for reset password", {
        "email": user.email,
        "token": user_token
    })

@user_management.route("/reset-password/", methods=["POST"])
@validate_request(
    required_fields=["token", "email", "password", "password2"],
    field_validators={
        "email": InputValidator.validate_email,
        "password": InputValidator.validate_password,
        "password2": InputValidator.validate_password
    }
)
def reset_password():
    data = g.validated_data
    user_token = data.get('token')
    user_email = data.get('email')
    password = data.get('password')
    password2 = data.get('password2')
    check_email = redis_client.get(user_token)
    if check_email is None:
        return json_response_creator("2", "token is wrong or expired")
    check_email = check_email.decode() if hasattr(check_email, "decode") else check_email
    if user_email != check_email:
        return json_response_creator("2", "email is not match")
    if password != password2:
        return json_response_creator("2", "password and password2 are not the same")
    user = Users.query.filter_by(email=user_email, deleted_at=None).first()
    if user is None:
        return json_response_creator("2", "user is not found")
    user.password = generate_password_hash(password)
    user.updated_at = datetime.now()
    db.session.commit()
    send_captcha_email(user.email, "Password Reset", generate_mail_html(3, {
        "userName": user.user_name
    }))
    return json_response_creator("1", "reset password successfully")
