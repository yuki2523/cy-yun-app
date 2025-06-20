from extensions import jwt, redis_client
from flask_jwt_extended import (
    create_access_token,
    jwt_required, set_access_cookies, unset_jwt_cookies, get_jwt
)
from flask import jsonify

@jwt.token_in_blocklist_loader
def check_if_token_in_blacklist(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return redis_client.get(f"jwt_blacklist:{jti}") is not None

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    return jsonify({
        "code": "8", # 登陆错误
        "message": "The token has expired",
        "error_code": "TOKEN_EXPIRED"
    }), 401

@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    return jsonify({
        "code": "8", # 登陆错误
        "message": f"Invalid token: {error_string}",
        "error_code": "INVALID_TOKEN"
    }), 401

@jwt.unauthorized_loader
def missing_token_callback(error_string):
    return jsonify({
        "code": "8", # 登陆错误
        "message": f"Authentication required: {error_string}",
        "error_code": "AUTHENTICATION_REQUIRED"
    }), 401

@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_data):
    return jsonify({
        "code": "8", # 登陆错误
        "message": "Token has been revoked",
        "error_code": "TOKEN_REVOKED"
    }), 401