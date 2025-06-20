from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_redis import FlaskRedis

db = SQLAlchemy()
jwt = JWTManager()
redis_client = FlaskRedis()


def init_extensions(app):
    db.init_app(app)
    jwt.init_app(app)
    redis_client.init_app(app)