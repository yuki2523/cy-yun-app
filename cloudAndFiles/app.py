from flask import Flask, request, Response, jsonify
import requests
from flask_jwt_extended import (
    create_access_token,
    jwt_required, set_access_cookies, unset_jwt_cookies, get_jwt
)
from config import Config
from extensions import init_extensions
from blueprints.file_management import file_management
from blueprints.user_management import user_management
from blueprints.settings_management import settings_management
from utils.utils import verify_password_hash
from datetime import datetime

app = Flask(__name__)
app.config.from_object(Config)
init_extensions(app)

app.register_blueprint(file_management)
app.register_blueprint(user_management)
app.register_blueprint(settings_management)

# 加身份验证的反向代理，代理kkFileView，验证登录状态，必须同域才可完全正常使用
@app.route('/file-preview/<path:path>', methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
@jwt_required()
def proxy(path):
    local_target = "http://127.0.0.1:8012"
    # 目标 URL = 本地服务 + 原始路径（去掉 /preview）
    target_url = f"{local_target}/{path}"

    try:
        # 转发请求
        resp = requests.request(
            method=request.method,
            url=target_url,
            headers={key: value for key, value in request.headers if key.lower() != 'host'},
            params=request.args,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
        )

        # 构造响应（排除部分自动处理的 headers）
        excluded_headers = ['content-encoding', 'transfer-encoding', 'connection']
        headers = [(k, v) for k, v in resp.raw.headers.items() if k.lower() not in excluded_headers]

        return Response(resp.content, resp.status_code, headers)

    except requests.exceptions.RequestException as e:
        return f"Error forwarding request: {e}", 502

if __name__ == '__main__':
    print(app.url_map)
    app.run(host="127.0.0.1", port=5555)
