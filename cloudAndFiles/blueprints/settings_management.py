from flask import Blueprint, request, g
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import SystemConfig
from extensions import db
from utils.utils import json_response_creator
from utils.filed_check import validate_request
from utils.oss_access import get_bucket_stat

settings_management = Blueprint('settings_management', __name__, url_prefix='/settings-management')

@settings_management.route('/get-register-enable/', methods=['GET'])
@jwt_required()
def get_register_enable():
    """
    获取用户注册许可状态。
    返回 system_config 表中 config_key='register_enable' 的值。
    需要管理员权限。
    """
    try:
        if get_jwt()["user_group"] != "admin":
            return json_response_creator("9", "Permission denied")
        config = SystemConfig.query.filter_by(config_key="register_enable").first()
        if not config:
            json_response_creator("9", "Configuration not found")
        return json_response_creator("1", "success", {"registerEnable": config.config_value})
    except Exception as e:
        print(e)
        return json_response_creator("9", "Error getting register enable")

@settings_management.route('/set-register-enable/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["registerEnable"],
    field_validators={
        "registerEnable": lambda x: isinstance(x, str) and len(x) == 1
    }
)
def set_register_enable():
    """
    设置用户注册许可状态。
    请求参数: {"enable": "1" 或 "0"}
    需要管理员权限。
    """
    try:
        enable = g.validated_data.get("registerEnable")
        if get_jwt()["user_group"] != "admin":
            return json_response_creator("9", "Permission denied")
        if enable not in ("0", "1"):
            return json_response_creator("9", "Invalid enable value")
        config = SystemConfig.query.filter_by(config_key="register_enable").first()
        if not config:
            json_response_creator("9", "Configuration not found")
        else:
            config.update_value(enable)
        db.session.commit()
        return json_response_creator("1", "Register enable updated", {"register_enable": enable})
    except Exception as e:
        db.session.rollback()
        print(e)
        return json_response_creator("9", "Error updating register enable")

@settings_management.route('/oss-stat/', methods=['GET'])
@jwt_required()
def get_oss_info():
    """
    获取 OSS 全部参数信息。
    需要管理员权限。
    """
    try:
        if get_jwt()["user_group"] != "admin":
            return json_response_creator("9", "Permission denied")
        info = get_bucket_stat()
        if info is None:
            return json_response_creator("9", "Failed to get OSS info")
        return json_response_creator("1", "success", info)
    except Exception as e:
        print(e)
        return json_response_creator("9", "Error getting OSS info")
