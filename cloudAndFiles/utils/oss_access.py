import requests

# 获取临时访问URL，有效期为一小时，在node端配置
# download_flag = 1时，需设置file_name，浏览器默认事件为下载
def get_temp_url(oss_filepath, expires = 3600, download_flag = 0, file_name = ''):
    try:
        response = requests.get('http://127.0.0.1:8081/get-url', params={
            'filePath': oss_filepath,
            'expires': expires,
            'downloadFlag': download_flag,
            'fileName': file_name
        })
        return response.json()['url']
    except Exception as e:
        print(e)
        return None

# 获取临时accessKeyL，有效期为一小时，在node端配置
def get_temp_access_token(expires = 3600):
    try:
        response = requests.get('http://localhost:8081/get-sts', params={'expires': expires})
        response_json = response.json()
        return {
            'accessKeyId': response_json['accessKeyId'],
            'accessKeySecret': response_json['accessKeySecret'],
            'securityToken': response_json['securityToken']
        }
    except Exception as e:
        print(e)
        return None

# 获取BUCKET容量和剩余可使用容量
def get_bucket_stat():
    try:
        response = requests.get('http://localhost:8081/get-bucket-stat')
        response_json = response.json()
        return {
            # 'storage': response_json['storage'], # 总容量
            'storageUsed': response_json['storageUsed'], # 已使用容量
            'objectCount': response_json['objectCount']  # 文件个数
        }
    except Exception as e:
        print(e)
        return None

def delete_file(oss_filepath):
    try:
        response = requests.get('http://127.0.0.1:8081/delete-file', params={
            'filePath': oss_filepath
        })
        if response.json()['result']['res']['statusCode'] == 204:
            return True
        return False
    except Exception as e:
        print(e)
        return False
