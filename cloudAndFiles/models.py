from sqlalchemy import text
from extensions import db
from datetime import datetime
from decimal import Decimal


class Cloudfiles(db.Model):
    __tablename__ = 'cloudfiles'
    __table_args__ = (
        db.PrimaryKeyConstraint('id', name='files_pkey'),
        db.Index('idx_files_deleted_at', 'deleted_at'),
        db.Index('idx_files_parent_id', 'parent_id'),
        db.Index('idx_files_user_deleted', 'user_id', 'deleted_at'),
        db.Index('idx_files_user_id', 'user_id'),
        db.Index('uq_files_path_name', 'user_id', 'parent_id', 'name', unique=True),
        {'comment': '云盘文件表'}
    )

    id = db.Column(db.Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    user_id = db.Column(db.Text)
    name = db.Column(db.Text)
    is_folder = db.Column(db.Boolean)
    parent_id = db.Column(db.Uuid, nullable=True)
    oss_path = db.Column(db.Text, nullable=True)
    size = db.Column(db.BigInteger, nullable=True)
    created_at = db.Column(db.DateTime, server_default=text('now()'))
    updated_at = db.Column(db.DateTime, server_default=text('now()'))
    deleted_at = db.Column(db.DateTime, nullable=True)
    file_suffix = db.Column(db.Text, nullable=True)
    online_editable = db.Column(db.Boolean, nullable=False, server_default=text('false'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'is_folder': self.is_folder,
            'parent_id': self.parent_id,
            'oss_path': self.oss_path,
            'size': self.size,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'deleted_at': self.deleted_at,
            'file_suffix': self.file_suffix,
            'online_editable': self.online_editable
        }

class Filecontent(db.Model):
    __tablename__ = 'filecontent'
    __table_args__ = (
        db.PrimaryKeyConstraint('id', name='filecontent_pkey'),
        db.Index('idx_filecontent_deleted_at', 'deleted_at'),
        db.Index('idx_filecontent_file_suffix', 'file_suffix'),
        db.Index('idx_filecontent_id', 'id'),
        db.Index('idx_filecontent_user_id', 'user_id')
    )

    id = db.Column(db.Uuid, primary_key=True)
    name = db.Column(db.Text)
    user_id = db.Column(db.Text)
    content = db.Column(db.Text)
    file_suffix = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, server_default=text('now()'))
    created_at = db.Column(db.DateTime, server_default=text('now()'))
    deleted_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'content': self.content,
            'file_suffix': self.file_suffix,
            'updated_at': self.updated_at,
            'created_at': self.created_at,
            'deleted_at': self.deleted_at
        }


class Users(db.Model):
    __tablename__ = 'users'
    __table_args__ = (
        db.PrimaryKeyConstraint('user_id', name='users_pkey'),
        db.UniqueConstraint('email', name='users_email_key'),
        db.Index('idx_users_deleted_at', 'deleted_at'),
        db.Index('idx_users_email', 'email'),
        db.Index('idx_users_is_active', 'is_active'),
        db.Index('idx_users_user_group', 'user_group'),
        db.Index('idx_users_user_id', 'user_id')
    )

    user_id = db.Column(db.Text, primary_key=True)
    email = db.Column(db.Text)
    password = db.Column(db.Text)
    is_active = db.Column(db.Boolean, server_default=text('true'))
    user_group = db.Column(db.Text)
    created_at = db.Column(db.DateTime, server_default=text('now()'))
    updated_at = db.Column(db.DateTime, server_default=text('now()'))
    deleted_at = db.Column(db.DateTime)
    user_name = db.Column(db.Text)

class UserStorageQuota(db.Model):
    __tablename__ = 'user_storage_quota'
    __table_args__ = (
        db.PrimaryKeyConstraint('user_id', name='user_storage_quota_pkey'),
        db.Index('idx_user_storage_quota_user_id', 'user_id')
    )

    user_id = db.Column(db.Text, primary_key=True)
    online_edit_limit = db.Column(db.Text, server_default=text("'134217728'::text"))
    upload_limit = db.Column(db.Text, server_default=text("'1073741824'::text"))
    online_edit_used = db.Column(db.Text, server_default=text("'0'::text"))
    upload_used = db.Column(db.Text, server_default=text("'0'::text"))
    created_at = db.Column(db.DateTime, server_default=text('now()'))
    updated_at = db.Column(db.DateTime, server_default=text('now()'))

    def update_limits(self, online_edit_limit=None, upload_limit=None):
        if online_edit_limit is not None:
            self.online_edit_limit = str(Decimal(online_edit_limit))
        if upload_limit is not None:
            self.upload_limit = str(Decimal(upload_limit))
        self.updated_at = datetime.now()
        return True

    def increase_online_edit_used(self, amount): # 内存不足则返回False
        new_value = Decimal(self.online_edit_used) + Decimal(amount)
        if new_value > Decimal(self.online_edit_limit):
            return False
        self.online_edit_used = str(new_value)
        self.updated_at = datetime.now()
        return True

    def decrease_online_edit_used(self, amount):
        self.online_edit_used = str(max(Decimal(self.online_edit_used) - Decimal(amount), Decimal('0')))
        self.updated_at = datetime.now()
        return True

    def replace_online_upload_used(self, old_value, new_value): # 内存不足则返回False
        current = Decimal(self.online_edit_used)
        updated = current - Decimal(old_value) + Decimal(new_value)
        if updated > Decimal(self.online_edit_limit):
            return False
        self.online_edit_used = str(max(updated, Decimal('0')))
        self.updated_at = datetime.now()
        return True

    def increase_upload_used(self, amount): # 内存不足则返回False
        new_value = Decimal(self.upload_used) + Decimal(amount)
        if new_value > Decimal(self.upload_limit):
            return False
        self.upload_used = str(new_value)
        self.updated_at = datetime.now()
        return True

    def decrease_upload_used(self, amount):
        self.upload_used = str(max(Decimal(self.upload_used) - Decimal(amount), Decimal('0')))
        self.updated_at = datetime.now()
        return True

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'online_edit_limit': self.online_edit_limit,
            'upload_limit': self.upload_limit,
            'online_edit_used': self.online_edit_used,
            'upload_used': self.upload_used,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

class SystemConfig(db.Model):
    __tablename__ = 'system_config'
    __table_args__ = (
        db.PrimaryKeyConstraint('config_key', name='system_config_pkey'),
        db.Index('idx_system_config_config_key', 'config_key')
    )

    config_key = db.Column(db.Text, primary_key=True)
    config_value = db.Column(db.Text) # '1':许可 , '0':禁止
    created_at = db.Column(db.DateTime, server_default=text('now()'))
    updated_at = db.Column(db.DateTime, server_default=text('now()'))

    def update_value(self, new_value):
        self.config_value = str(new_value)
        self.updated_at = datetime.now()
