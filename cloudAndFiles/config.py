from datetime import timedelta

class Config:
    JWT_SECRET_KEY = "super-secret"
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_CSRF_PROTECT = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    SQLALCHEMY_DATABASE_URI = "postgresql+psycopg2://username:password@127.0.0.1:5432/dbname"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    REDIS_URL = "redis://localhost:6379/3"