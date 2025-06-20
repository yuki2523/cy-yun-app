from datetime import datetime
from flask import Blueprint, send_file, make_response, g, render_template
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Cloudfiles, Filecontent, UserStorageQuota, Users
from extensions import db, redis_client
from utils.oss_access import get_temp_access_token, get_temp_url, delete_file
from utils.utils import get_folder_path, unset_folder_path_cache, invalidate_recent_files_cache, get_path_from_parent_folder, json_response_creator, get_file_suffix, encrypt_key, decrypt_key
from utils.filed_check import validate_request, InputValidator
import uuid
import json
import io
import secrets
from urllib.parse import quote

file_management = Blueprint('file_management', __name__, url_prefix='/file-management')

"""
获取当前用户指定目录下的文件和文件夹列表。
Returns:
    JSON响应，包含 file_and_folder_list。
"""
@file_management.route('/file-list/')
@jwt_required()
@validate_request(
    required_fields=[],
    field_validators={
        "parent_id": InputValidator.validate_file_id,
        "type_id": InputValidator.validate_select_code,
        "editable_id": InputValidator.validate_select_code
    }
)
def file_list():
    user_id = get_jwt_identity()
    parent_id = g.validated_data.get('parent_id') # 找该父目录下的目录和文件，不传值则找根目录
    type_id = g.validated_data.get('type_id') # 1:文件 2:文件夹 不传值:全部
    editable_id = g.validated_data.get('editable_id') # 1:可在线编辑 2:不可在线编辑 不传值:全部
    file_and_folder = Cloudfiles.query.filter_by(user_id=user_id, parent_id=parent_id, deleted_at=None)
    if type_id == '1':
        file_and_folder = file_and_folder.filter_by(is_folder=False)
    elif type_id == '2':
        file_and_folder = file_and_folder.filter_by(is_folder=True)
    if editable_id == '1':
        file_and_folder = file_and_folder.filter(
            db.or_(
                Cloudfiles.is_folder == True,
                db.and_(Cloudfiles.is_folder == False, Cloudfiles.online_editable == True)
            )
        )
    elif editable_id == '2':
        file_and_folder = file_and_folder.filter(
            db.or_(
                Cloudfiles.is_folder == True,
                db.and_(Cloudfiles.is_folder == False, Cloudfiles.online_editable == False)
            )
        )

    file_and_folder = file_and_folder.order_by(Cloudfiles.is_folder, Cloudfiles.updated_at).all()
    file_and_folder_list = [
        f.to_dict() for f in file_and_folder
    ]
    return json_response_creator(
        "1",
        "success",
        {"file_and_folder_list": file_and_folder_list}
    )


"""
获取逻辑删除（移动至回收站）的文件或文件夹列表。
Returns:
    JSON响应，包含被删除文件信息。
"""
@file_management.route('/recycle-bin/', methods=['GET'])
@jwt_required()
@validate_request(
    required_fields=[],
    field_validators={
        "offset": InputValidator.validate_positive_int,
        "limit": InputValidator.validate_positive_int
    }
)
def recycle_bin():
    try:
        user_id = get_jwt_identity()
        offset = int(g.validated_data.get('offset', 0))
        limit = int(g.validated_data.get('limit', 10))
        total_count = Cloudfiles.query.filter(
            Cloudfiles.user_id == user_id,
            Cloudfiles.deleted_at.isnot(None)
        ).count()
        # 查询被逻辑删除的文件或文件夹（deleted_at 不为空）
        deleted_items = Cloudfiles.query.filter(
            Cloudfiles.user_id == user_id,
            Cloudfiles.deleted_at.isnot(None)
        ).order_by(Cloudfiles.deleted_at.desc()).offset(offset).limit(limit).all()
        result = []
        for item in deleted_items:
            # 获取完整路径（使用 parent_id 获取路径）
            path_info = get_folder_path(item.parent_id)
            result.append({
                'id': item.id,
                'name': item.name,
                'size': item.size,
                'is_folder': item.is_folder,
                'oss_path': item.oss_path,
                'online_editable': item.online_editable,
                'deleted_at': item.deleted_at,
                'path': path_info.get('filePath', [])
            })
        return json_response_creator(
            '1',
            'success',
            {
                'items': result,
                'total': total_count
            }
        )
    except Exception as e:
        print(e)
        return json_response_creator(
            '9',
            'Failed to load recycle bin'
        )

"""
获取当前用户最近修改的20个文件，支持Redis缓存加速。
Returns:
    JSON响应，包含 recent_files 列表。
"""
@file_management.route('/get-recent-files/', methods=['GET'])
@jwt_required()
def get_recent_files():
    user_id = get_jwt_identity()
    redis_key = f"recent_files:{user_id}"
    redis_data = redis_client.get(redis_key)

    if redis_data:
        recent_files = json.loads(redis_data)
        for recent_file in recent_files:
            if recent_file['updated_at']:
                recent_file['updated_at'] = datetime.fromisoformat(recent_file['updated_at'])
        return json_response_creator(
            '1',
            'success (from redis)',
            recent_files
        )

    # Fallback：从数据库查询
    files = Cloudfiles.query.filter_by(
        user_id=user_id,
        is_folder=False,
        deleted_at=None
    ).order_by(Cloudfiles.updated_at.desc()).limit(20).all()

    recent_files = []
    for f in files:
        path_list = get_folder_path(f.parent_id).get("filePath", [])
        full_path = f"{'/ ' if len(path_list) > 0 else ''}{' / '.join(p['name'] for p in path_list)} /"
        recent_files.append({
            'id': str(f.id),
            'parent_id': str(f.parent_id),
            'name': f.name,
            'size': f.size,
            'updated_at': f.updated_at.isoformat() if f.updated_at else None,
            'online_editable': f.online_editable,
            'oss_path': f.oss_path,
            'path': [{'id': p['id'], 'name': p['name']} for p in path_list],
            'full_path': full_path
        })

    redis_client.set(redis_key, json.dumps(recent_files), ex=3600)  # 1小时有效

    return json_response_creator(
        '1',
        'success (from db)',
        recent_files
    )

"""
根据文件ID或文件名模糊查找当前用户的文件或文件夹。
Returns:
    JSON响应，包含 filePath 和当前文件信息。
"""
@file_management.route('/find-file/')
@validate_request(
    required_fields=["fileName"],
    field_validators={
        "fileName": InputValidator.validate_file_name
    }
)
@jwt_required()
def find_file():
    try:
        user_id = get_jwt_identity()
        file_or_folder_name = g.validated_data.get('fileName')
        file_or_folder = (Cloudfiles.query.filter_by(user_id=user_id, deleted_at=None, is_folder=False)
                          .filter(Cloudfiles.name.ilike(f'%{file_or_folder_name}%')).all())
        if not file_or_folder:
            return json_response_creator(
                '9',
                'File or folder not found'
            )
        result = []
        for item in file_or_folder:
            item_dict = item.to_dict()
            item_dict['path'] = get_folder_path(item.parent_id).get("filePath", [])
            result.append(item_dict)
        return json_response_creator(
            '1',
            'success',
            result
        )
    except Exception as e:
        print(e)
        return json_response_creator(
            '9',
            'Database error'
        )

"""
获取用于访问OSS的临时访问Token（STS）。
Returns:
    JSON响应，包含 access_token。
"""
@file_management.route('/get-sts/')
@jwt_required()
def get_sts():
    user_id = get_jwt_identity()
    redis_key = f"sts_count:{user_id}"
    # 获取当前次数
    count = redis_client.get(redis_key)
    count = int(count) if count else 0
    if count >= 5:
        return json_response_creator("9", "3分钟内调用次数已达上限")
    # 增加次数并设置3分钟有效期
    redis_client.incr(redis_key)
    redis_client.expire(redis_key, 180)
    access_token = get_temp_access_token()
    if access_token is None:
        return json_response_creator(
            "9",
            "please check oss control service log"
        )
    return json_response_creator(
        "1",
        "success",
        {"access_token": access_token}
    )

"""
新增文件记录。
Returns:
    JSON响应，保存结果。
"""
@file_management.route('/insert-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["fileName", "ossPath", "fileSize"],
    field_validators={
        "fileName": InputValidator.validate_file_name,
        "parentId": InputValidator.validate_file_id,
        "ossPath": InputValidator.validate_file_path,
        "fileSize": InputValidator.validate_positive_int
    }
)
def insert_file():
    try:
        user_id = get_jwt_identity()
        data = g.validated_data
        file_name = data.get('fileName')
        parent_id = data.get('parentId', None)
        oss_path = data.get('ossPath')
        file_size = int(data.get('fileSize', 0))
        file_suffix = get_file_suffix(file_name)
        cloud_file = Cloudfiles(
            user_id=user_id,
            name=file_name,
            is_folder=False,
            parent_id=parent_id,
            oss_path=oss_path,
            size=file_size,
            file_suffix=file_suffix
        )
        user_storage_quota = UserStorageQuota.query.filter_by(user_id=user_id).first()
        if not user_storage_quota.increase_upload_used(file_size):
            db.session.rollback()
            return json_response_creator(
                '9',
                'user storage quota not enough'
            )
        db.session.add(cloud_file)
        db.session.commit()
        invalidate_recent_files_cache(user_id)
        return json_response_creator(
            '1',
            'saved success'
        )
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator(
            '9',
            'saved failed'
        )

"""
获取在线编辑文件的内容和父目录ID。
Returns:
    JSON响应，包含 fileContent 和 parentId。
"""
@file_management.route('/get-online-edit-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["fileId"],
    field_validators={
        "fileId": InputValidator.validate_file_id_not_none
    }
)
def get_online_edit_file():
    try:
        user_id = get_jwt_identity()
        file_id = g.validated_data.get('fileId')
        file_content = Filecontent.query.filter_by(id=file_id, user_id=user_id).first()
        cloud_file = Cloudfiles.query.filter_by(id=file_id, user_id=user_id).first()
        if cloud_file is None or file_content is None:
            return json_response_creator(
                '9',
                'file not found'
            )
        return json_response_creator(
            '1',
            'success',
            {
                'fileId': file_id,
                'fileContent': file_content.to_dict(),
                'parentId': cloud_file.parent_id
            }
        )
    except Exception as e:
        print(e)
        return json_response_creator(
            '9',
            'server error'
        )

"""
创建在线编辑文件（如Markdown），同时写入文件内容表。
Returns:
    JSON响应，包含 file_info。
"""
@file_management.route('/insert-online-edit-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["fileName", "fileSize"],
    field_validators={
        "fileName": InputValidator.validate_file_name,
        "folderId": InputValidator.validate_file_id,
        "content": InputValidator.validate_file_content,
        "fileSize": InputValidator.validate_positive_int
    }
)
def insert_online_edit_file():
    try:
        user_id = get_jwt_identity()
        data = g.validated_data
        file_name = data.get('fileName')
        folder_id = data.get('folderId', None)
        content = data.get('content', '')
        file_size = data.get('fileSize')

        file_suffix = get_file_suffix(file_name)
        cloud_file = Cloudfiles(
            id=uuid.uuid4(),
            user_id=user_id,
            name=file_name,
            is_folder=False,
            parent_id=folder_id if folder_id else None,
            size=file_size,
            file_suffix=file_suffix,
            online_editable=True
        )
        file_content = Filecontent(
            id=cloud_file.id,
            user_id=user_id,
            name=file_name,
            content=content,
            file_suffix=file_suffix
        )
        user_storage_quota = UserStorageQuota.query.filter_by(user_id=user_id).first()
        if not user_storage_quota.increase_online_edit_used(file_size):
            db.session.rollback()
            return json_response_creator(
                '9',
                'user storage quota not enough'
            )
        db.session.add_all([cloud_file, file_content])
        db.session.commit()
        invalidate_recent_files_cache(user_id)
        return json_response_creator(
            '1',
            'saved success',
            {
                'file_info': {
                    'id': file_content.id,
                    'name': file_content.name,
                    'parent_id': cloud_file.parent_id,
                    'updated_at': file_content.updated_at
                }
            }
        )
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator(
            '9',
            'saved failed'
        )

"""
更新在线编辑文件内容和元信息（更新时间、大小）。
Returns:
    JSON响应，更新结果。
"""
@file_management.route('/update-online-edit-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["fileId", "fileSize"],
    field_validators={
        "fileId": InputValidator.validate_file_id_not_none,
        "content": InputValidator.validate_file_content,
        "fileSize": InputValidator.validate_positive_int
    }
)
def update_online_edit_file():
    try:
        user_id = get_jwt_identity()
        data = g.validated_data
        file_id = data.get('fileId')
        content = data.get('content', '')
        file_size = data.get('fileSize')
        cloud_file = Cloudfiles.query.filter_by(id=file_id, user_id=user_id).first()
        file_content = Filecontent.query.filter_by(id=cloud_file.id, user_id=user_id).first()
        if cloud_file is None or file_content is None:
            return json_response_creator(
                '9',
                'file not found'
            )
        user_storage_quota = UserStorageQuota.query.filter_by(user_id=user_id).first()
        if not user_storage_quota.replace_online_upload_used(cloud_file.size, file_size):
            db.session.rollback()
            return json_response_creator(
                '9',
                'user storage quota not enough'
            )
        current_time = datetime.now()
        cloud_file.updated_at = current_time
        cloud_file.size = file_size
        file_content.updated_at = current_time
        file_content.content = content
        db.session.add_all([cloud_file, file_content])
        db.session.commit()
        invalidate_recent_files_cache(user_id)
        return json_response_creator(
            '1',
            'updated success',
            {
                'file_info': {
                    'id': file_content.id,
                    'name': file_content.name,
                    'parent_id': cloud_file.parent_id,
                    'updated_at': current_time
                }
            }
        )
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator(
            '9',
            'updated failed'
        )

"""
获取指定 OSS 文件路径的临时预览URL。
Returns:
    JSON响应，包含 tempUrl。
"""
@file_management.route('/get-preview-temp-path/')
@jwt_required()
@validate_request(
    required_fields=["ossPath"],
    field_validators={
        "ossPath": InputValidator.validate_file_path
    }
)
def get_preview_temp_path():
    oss_path = g.validated_data.get('ossPath')
    temp_url = get_temp_url(oss_path)
    if temp_url is None:
        return json_response_creator(
            '9',
            'temp_path is none, please check oss control service log'
        )
    return json_response_creator(
        '1',
        'success',
        {'tempUrl': temp_url}
    )

"""
逻辑删除文件或文件夹（设置 deleted_at 字段），支持递归。
Returns:
    JSON响应，删除结果。
"""
@file_management.route('/delete-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["id"],
    field_validators={
        "id": InputValidator.validate_file_id_not_none
    }
)
def logical_delete_file():
    try:
        user_id = get_jwt_identity()
        file_id = g.validated_data.get('id')
        if not file_id:
            return json_response_creator('9', 'Missing file ID')
        now = datetime.now()
        def recursive_logical_delete(fid):
            item = Cloudfiles.query.filter_by(id=fid, user_id=user_id).first()
            if not item:
                return
            item.deleted_at = now
            db.session.add(item)
            if not item.is_folder and item.online_editable: # 在线编辑文件
                content_record = Filecontent.query.filter_by(id=fid, user_id=user_id).first()
                if content_record:
                    content_record.deleted_at = now
                    db.session.add(content_record)
            if item.is_folder: # 文件夹递归删除
                children = Cloudfiles.query.filter_by(parent_id=fid, user_id=user_id).all()
                for child in children:
                    recursive_logical_delete(child.id)
        recursive_logical_delete(file_id)
        db.session.commit()
        invalidate_recent_files_cache(user_id)
        return json_response_creator('1', 'Logical delete success')
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator('9', 'Logical delete failed')

"""
物理删除文件或文件夹（彻底从数据库中删除），支持递归。
Returns:
    JSON响应，删除结果。
"""
@file_management.route('/hard-delete-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["id"],
    field_validators={
        "id": InputValidator.validate_file_id_not_none
    }
)
def hard_delete_file():
    try:
        user_id = get_jwt_identity()
        file_id = g.validated_data.get('id')
        if not file_id:
            return json_response_creator('9', 'Missing file ID')
        def recursive_hard_delete(fid):
            item = Cloudfiles.query.filter_by(id=fid, user_id=user_id).first()
            if not item:
                return
            if item.is_folder:
                children = Cloudfiles.query.filter_by(parent_id=fid, user_id=user_id).all()
                for child in children:
                    recursive_hard_delete(child.id)
            else:
                # 删除 file_content 中的内容（如果是文件）
                user_storage_quota = UserStorageQuota.query.filter_by(user_id=user_id).first()
                if item.online_editable:
                    Filecontent.query.filter_by(id=fid, user_id=user_id).delete()
                    user_storage_quota.decrease_online_edit_used(item.size)
                else:
                    if delete_file(item.oss_path):  # 删除OSS文件
                        print(f'{item.oss_path}删除成功')
                    user_storage_quota.decrease_upload_used(item.size)
            db.session.delete(item)
        recursive_hard_delete(file_id)
        db.session.commit()
        return json_response_creator('1', 'Hard delete success')
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator('9', 'Hard delete failed')

"""
创建一个新的文件夹（文件夹记录）到指定目录中。
请求参数 (JSON):
    name (str): 新文件夹的名称。
    parentId (str | None): 父文件夹ID；如果为 None，则表示在根目录创建。
功能说明:
    - 获取当前用户身份；
    - 检查是否提供了文件夹名称；
    - 检查该目录下是否已有同名文件夹（防止重名）；
    - 创建文件夹记录并保存到数据库；
    - 返回新建文件夹的基本信息。
返回:
    JSON响应:
        成功：{
            'code': '1',
            'message': 'Folder created successfully',
            'data': {
                'id': 新文件夹ID,
                'name': 文件夹名称,
                'parent_id': 父文件夹ID,
                'updated_at': 更新时间
            }
        }
        失败：{'code': '9', 'message': 错误信息}
"""
@file_management.route('/create-folder/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["name"],
    field_validators={
        "name": InputValidator.validate_file_name,
        "parentId": InputValidator.validate_file_id
    }
)
def create_folder():
    try:
        user_id = get_jwt_identity()
        folder_name = g.validated_data.get('name')
        parent_id = g.validated_data.get('parentId', None)  # None 表示根目录
        if not folder_name:
            return json_response_creator('9', 'Missing folder name')
        # 检查是否重名（user_id + parent_id + name）唯一约束已在模型中设定
        existing = Cloudfiles.query.filter_by(
            user_id=user_id,
            parent_id=parent_id,
            name=folder_name,
            deleted_at=None
        ).first()
        if existing:
            return json_response_creator('9', 'Folder already exists with the same name')
        new_folder = Cloudfiles(
            user_id=user_id,
            name=folder_name,
            is_folder=True,
            parent_id=parent_id
        )
        db.session.add(new_folder)
        db.session.commit()
        return json_response_creator(
            '1',
            'Folder created successfully',
            {
                'id': new_folder.id,
                'name': new_folder.name,
                'parent_id': new_folder.parent_id,
                'updated_at': new_folder.updated_at
            }
        )
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator('9', 'Folder create failed')

"""
移动当前用户的文件或文件夹至指定目录。
请求参数 (JSON):
    id (str): 目标文件或文件夹ID。
    newParentId (str | None): 新的父文件夹ID，None表示移动到根目录。
功能说明:
    - 验证文件或文件夹存在；
    - 若 newParentId 不为 None，验证目标父目录存在且为文件夹；
    - 防止文件夹移动到自身或其子孙节点中；
    - 检查目标目录中是否存在重名项；
    - 更新文件或文件夹的 parent_id，实现移动；
    - 清理路径缓存，更新最近文件缓存。
返回:
    JSON响应:
        成功：{'code': '1', 'message': 'Move success'}
        失败：{'code': '9', 'message': 错误信息}
"""
@file_management.route('/move-file/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["id"],
    field_validators={
        "id": InputValidator.validate_file_id_not_none,
        "newParentId": InputValidator.validate_file_id
    }
)
def move_file():
    try:
        user_id = get_jwt_identity()
        file_id = g.validated_data.get('id')  # 要移动的文件或文件夹ID
        new_parent_id = g.validated_data.get('newParentId', None)  # 新的父文件夹ID，None表示移动到根目录
        if not file_id:
            return json_response_creator('9', 'Missing file ID')
        # 查找目标文件或文件夹
        target = Cloudfiles.query.filter_by(id=file_id, user_id=user_id, deleted_at=None).first()
        if not target:
            return json_response_creator('9', 'File or folder not found')
        # 验证新父文件夹存在且为文件夹（允许 new_parent_id 为 None）
        if new_parent_id is not None:
            new_parent = Cloudfiles.query.filter_by(id=new_parent_id, user_id=user_id, is_folder=True, deleted_at=None).first()
            if not new_parent:
                return json_response_creator('9', 'Target folder not found or is not a folder')
        # 防止移动到自身或其子孙节点中（只针对文件夹）
        if target.is_folder and new_parent_id:
            def is_descendant(child_id, potential_ancestor_id):
                while child_id:
                    current = Cloudfiles.query.filter_by(id=child_id, user_id=user_id).first()
                    if not current:
                        break
                    if current.parent_id == potential_ancestor_id:
                        return True
                    child_id = current.parent_id
                return False
            if file_id == new_parent_id or is_descendant(new_parent_id, file_id):
                return json_response_creator('9', 'Cannot move a folder into itself or its subfolder')
        # 检查是否存在命名冲突
        conflict = Cloudfiles.query.filter_by(
            user_id=user_id,
            parent_id=new_parent_id,
            name=target.name,
            deleted_at=None
        ).first()
        if conflict:
            return json_response_creator('9', 'A file or folder with the same name already exists in the target folder')
        # 执行移动操作
        old_parent_id = target.parent_id
        target.parent_id = new_parent_id
        target.updated_at = datetime.now()
        db.session.commit()
        # 清除路径缓存（旧的父路径、新的父路径、当前对象）
        unset_folder_path_cache(old_parent_id)
        unset_folder_path_cache(new_parent_id)
        unset_folder_path_cache(target.id)
        invalidate_recent_files_cache(user_id)
        return json_response_creator('1', 'Move success')
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator('9', 'Move failed')

"""
恢复逻辑删除的文件或文件夹。
请求参数 (JSON):
    id (str): 要恢复的文件或文件夹 ID。
功能说明:
    - 文件夹：递归恢复所有子文件夹及文件；
    - 文件：恢复自身，如果原父文件夹被逻辑删除，则递归恢复该文件的所有父文件夹；
    - 恢复路径按 parent_id 恢复，无视路径变更；
    - 返回恢复路径详情，供前端确认。
返回:
    成功：{
        'code': '1',
        'message': 'Restore success',
        'data': {
            'path': '/路径/到/文件或文件夹',
            'restored_ids': [恢复的所有文件/夹 Name]
        }
    }
    失败：{
        'code': '9',
        'message': 'Restore failed'
    }
"""
@file_management.route('/restore/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["id"],
    field_validators={
        "id": InputValidator.validate_file_id_not_none
    }
)
def restore_item():
    try:
        user_id = get_jwt_identity()
        target_id = g.validated_data.get('id')
        if not target_id:
            return json_response_creator('9', 'Missing ID')
        target = Cloudfiles.query.filter_by(id=target_id, user_id=user_id).first()
        if not target or target.deleted_at is None:
            return json_response_creator('9', 'File or folder not found or not deleted')
        restored_ids = []
        # 恢复文件夹及其所有子内容
        def restore_folder_recursive(folder):
            folder.deleted_at = None
            restored_ids.append(folder.name)
            children = Cloudfiles.query.filter_by(user_id=user_id, parent_id=folder.id).all()
            for child in children:
                if child.deleted_at is not None:
                    if child.is_folder:
                        restore_folder_recursive(child)
                    else:
                        child.deleted_at = None
                        restored_ids.append(child.name)
        # 恢复文件（递归恢复其父文件夹）
        def restore_file(file):
            current = file
            while current:
                if current.deleted_at is not None:
                    current.deleted_at = None
                    restored_ids.append(current.name)
                current = Cloudfiles.query.filter_by(id=current.parent_id, user_id=user_id).first()
        if target.is_folder:
            restore_folder_recursive(target)
        else:
            restore_file(target)
        db.session.commit()
        # 获取恢复后的路径
        full_path = get_path_from_parent_folder(target)
        return json_response_creator(
            '1',
            'Restore success',
            {
                'path': full_path,
                'restored_ids': restored_ids
            }
        )
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator('9', 'Restore failed')

"""
重命名文件或文件夹。
请求参数 (JSON):
    fileId (str): 要重命名的文件或文件夹 ID。
    newName (str): 新的名称。
功能说明:
    - 验证文件或文件夹存在；
    - 检查同目录下是否有同名文件或文件夹；
    - 更新文件或文件夹的名称和更新时间。
返回:
    JSON响应:
        成功：{'code': '1', 'message': 'Rename success', 'data': 文件或文件夹信息}
        失败：{'code': '9', 'message': 错误信息}
"""
@file_management.route('/rename/', methods=['POST'])
@jwt_required()
@validate_request(
    required_fields=["fileId", "newName"],
    field_validators={
        "fileId": InputValidator.validate_file_id_not_none,
        "newName": InputValidator.validate_file_name
    }
)
def rename_file_or_folder():
    try:
        user_id = get_jwt_identity()
        file_id = g.validated_data.get('fileId')
        new_name = g.validated_data.get('newName')
        if not file_id or not new_name:
            return json_response_creator('9', 'Missing fileId or newName')
        target = Cloudfiles.query.filter_by(id=file_id, user_id=user_id, deleted_at=None).first()
        if not target:
            return json_response_creator('9', 'File or folder not found')
        # 检查同目录下是否有同名文件/文件夹
        conflict = Cloudfiles.query.filter_by(
            user_id=user_id,
            parent_id=target.parent_id,
            name=new_name
        ).first()
        if conflict:
            return json_response_creator('9', 'A file or folder with the same name already exists in the target folder')
        target.name = new_name
        target.updated_at = datetime.now()
        if not target.is_folder:
            target.file_suffix = get_file_suffix(new_name)
        # 如果是在线编辑文件，同时更新Filecontent表
        if target.online_editable:
            file_content = Filecontent.query.filter_by(id=target.id, user_id=user_id).first()
            if file_content:
                file_content.name = new_name
                file_content.updated_at = datetime.now()
                file_content.file_suffix = get_file_suffix(new_name)
        db.session.commit()
        return json_response_creator('1', 'Rename success', target.to_dict())
    except Exception as e:
        print(e)
        db.session.rollback()
        return json_response_creator('9', 'Rename failed')

@file_management.route('/download-generate/', methods=['GET'])
@jwt_required()
@validate_request(
    required_fields=["fileId"],
    field_validators={
        "fileId": InputValidator.validate_file_id_not_none
    }
)
def download_generate():
    user_id = get_jwt_identity()
    file_id = g.validated_data.get("fileId")
    file = Cloudfiles.query.filter_by(id=file_id, user_id=user_id, deleted_at=None).first()
    if not file:
        return json_response_creator('9', '文件不存在')
    if file.is_folder:
        return json_response_creator('9', '不能下载文件夹')
    # 判断是否为在线编辑文件
    if not file.online_editable:
        # 非在线编辑文件，走OSS临时下载
        temp_url = get_temp_url(file.oss_path, expires=600, download_flag=1, file_name=file.name)  # 10分钟有效
        if not temp_url:
            return json_response_creator('9', '获取临时下载链接失败')
        return json_response_creator('1', 'success', {'tempUrl': temp_url})
    else:
        # 在线编辑文件，生成key，存redis
        raw_key = secrets.token_urlsafe(16)
        redis_client.set(raw_key, str(file_id), ex=600)
        enc_key = encrypt_key(raw_key)
        return json_response_creator('1', 'success', {'tempUrl': f'https://ying2233.cn/cy-yun/file-management/download-file/?key={enc_key}'})

@file_management.route('/download-file/', methods=['GET'])
@validate_request(
    required_fields=["key"],
    field_validators={
        "key": lambda x: isinstance(x, str) and len(x) > 0
    }
)
def download_file():
    enc_key = g.validated_data.get("key")
    try:
        raw_key = decrypt_key(enc_key)
    except Exception as e:
        print(e)
        return json_response_creator('9', 'Key解密失败')
    file_id = redis_client.get(raw_key)
    redis_client.delete(raw_key)
    if not file_id:
        return json_response_creator('9', 'Invalid or expired key')
    file_id = file_id.decode() if hasattr(file_id, "decode") else file_id
    file_content = Filecontent.query.filter_by(id=file_id, deleted_at=None).first()
    if not file_content:
        return json_response_creator('9', 'File not found')
    # 以文件下载方式返回
    file_stream = io.BytesIO(file_content.content.encode("utf-8"))
    response = make_response(send_file(
        file_stream,
        as_attachment=True,
        download_name=file_content.name or "download.txt",
        mimetype="application/octet-stream"
    ))
    response.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{quote(file_content.name) or 'download.txt'}"
    return response

@file_management.route('/share-file/', methods=['GET'])
@jwt_required()
@validate_request(
    required_fields=["fileId"],
    field_validators={
        "fileId": InputValidator.validate_file_id_not_none
    }
)
def share_file():
    """
    生成分享链接，返回加密的key。
    7天有效
    """
    user_id = get_jwt_identity()
    file_id = g.validated_data.get("fileId")
    file = Cloudfiles.query.filter_by(id=file_id, user_id=user_id, deleted_at=None).first()
    if not file:
        return json_response_creator('9', '文件不存在')
    if file.is_folder:
        return json_response_creator('9', '不能下载文件夹')
    # 生成key，存redis
    raw_key = secrets.token_urlsafe(16)
      # 生成一个唯一的key
    redis_client.set(
        raw_key,
        json.dumps({'fileId': str(file_id), 'type': 'shared-key'}),
        ex=60 * 60 * 24 * 7
    )  # 7天有效
    enc_key = encrypt_key(raw_key)
    return json_response_creator('1', 'success', {
        'shareUrl': f'https://ying2233.cn/cy-yun/file-management/share-page/?key={enc_key}'})

@file_management.route('/share-page/', methods=['GET'])
@validate_request(
    required_fields=["key"],
    field_validators={
        "key": lambda x: isinstance(x, str) and len(x) > 0
    }
)
def share_page():
    enc_key = g.validated_data.get("key")
    try:
        raw_key = decrypt_key(enc_key)
    except Exception as e:
        print(e)
        return render_template('share_page.html', message='Key解密失败')
    try:
        cached = redis_client.get(raw_key)
        if cached is None:
            return render_template('share_page.html', message='Invalid or expired key')
        cached_data = json.loads(cached.decode())
        if cached_data.get('type') != 'shared-key':
            return render_template('share_page.html', message='Invalid key type')
        file_id = cached_data.get('fileId')
    except Exception as e:
        print(e)
        return render_template('share_page.html', message='Invalid key type')
    file = Cloudfiles.query.filter_by(id=file_id, deleted_at=None).first()
    if not file:
        return render_template('share_page.html', message='File not found')
    user = Users.query.filter_by(user_id=file.user_id).first()
    if file.online_editable:
        file_content = Filecontent.query.filter_by(id=file_id, deleted_at=None).first()
        if not file_content:
            return render_template('share_page.html', message='File not found')
        raw_key = secrets.token_urlsafe(16)
        redis_client.set(raw_key, str(file_id), ex=600)
        enc_key = encrypt_key(raw_key)
        return render_template('share_page.html',
                               message=f'这是来自{user.user_name}的文件分享，请点击下方按钮下载文件:{file.name}，若无法下载，请刷新页面。',
                               temp_url=f'https://ying2233.cn/cy-yun/file-management/download-file/?key={enc_key}')
    else:
        temp_url = get_temp_url(file.oss_path, expires=600, download_flag=1, file_name=file.name)  # 10分钟有效
        if not temp_url:
            return render_template('share_page.html', message='获取临时下载链接失败')
        return render_template('share_page.html',
                               message=f'这是来自{user.user_name}的文件分享，请点击下方按钮下载文件:{file.name}，若无法下载，请刷新页面。',
                               temp_url=temp_url)

