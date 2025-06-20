import { useState, useEffect, useContext } from 'react';
import { Button, Modal, Flex, Input, Upload, Divider, List } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axiosInstance from '../utils/axiosInstance';
import { GlobalContext } from '../App';
import OSS from 'ali-oss';

const FileUploadModal = ({ parentFolder, modalOpen, updateModalOpen, refreshParent }) => {
  const { messageApi } = useContext(GlobalContext);
  const [fileList, setFileList] = useState([]);
  const [filePath, setFilePath] = useState('/');
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const uploadProps = {
    customRequest: async ({ file, onProgress, onSuccess, onError }) => {
      try {
        if (file.size > 1024 * 1024 * 200) { // 限制文件大小为200MB
          messageApi.open({
            type: 'error',
            content: `文件 ${file.name} 大小超过限制 (200MB)`,
          });
          return;
        }
        // 获取STS临时密钥
        let response = await axiosInstance.get(`/file-management/get-sts/`);
        console.log(response)
        let accessToken;
        if (response.status === 200) {
          let code = response.data.code;
          let data = response.data.data;
          if (code === '1') {
            accessToken = data.access_token;
          }
          if (code === '99') {
            messageApi.open({
              type: 'error',
              content: response.data.message,
            });
            new Error('获取临时密钥失败');
            return;
          }
        }
        if (!accessToken) {
          messageApi.open({
            type: 'error',
            content: `获取临时密钥失败`,
          });
          new Error('获取临时密钥失败');
          return;
        }
        // 创建OSS客户端
        const client = new OSS({
          region: 'oss-cn-shanghai',
          accessKeyId: accessToken.accessKeyId,
          accessKeySecret: accessToken.accessKeySecret,
          stsToken: accessToken.securityToken,
          bucket: 'cy-files-yun'
        });

        // 初始化
        const yunId = window.localStorage.getItem('yunId')
        const date = new Date();
        const fileOssPath = `${yunId}/${date.getFullYear()}/${date.getMonth() < 9 ? '0' : ''}${date.getMonth() + 1}/${date.getDate()}/${Date.now()}-${file.name}`;
        const uploadId = (await client.initMultipartUpload(fileOssPath)).uploadId;
        const partSize = 1024 * 1024; // 分片大小，1MB
        const totalSize = file.size;
        const parts = []; // 存储分片信息的数组
        for (let partNumber = 1, start = 0; start < totalSize; partNumber++) {
          const end = Math.min(start + partSize, totalSize);
          const blob = file.slice(start, end); // 切割文件
          const partResult = await client.uploadPart(
            fileOssPath, 
            uploadId,
            partNumber,
            blob,
            0,
            blob.size
          );
          parts.push({ number: partNumber, etag: partResult.etag });
          onProgress({
            percent: Math.round((end / totalSize) * 100),
            file
          });
          console.log(`Part uploaded:`, partResult);
          start += partSize;
        }
        // 完成分片上传
        console.log(`All parts uploaded, ${JSON.stringify(parts)}`);
        const completeResult = await client.completeMultipartUpload(fileOssPath, uploadId, parts);
        console.log('Upload result:', completeResult);
        // 上传成功后，更新文件列表
        response = await axiosInstance.post(`/file-management/insert-file/`, {
          fileName: file.name,
          parentId: parentFolder.id,
          ossPath: fileOssPath,
          fileSize: file.size
        });
        if (response.status === 200) {
          let code = response.data.code;
          let message = response.data.message;
          if (code === '1') {
            onSuccess(completeResult, file);
            messageApi.open({
              type: 'success',
              content: `文件上传成功 ${file.name}->${parentFolder.name}`,
            });
            // 上传成功后，移除文件列表中文件
            setFileList((prevList) => prevList.filter(item => item.uid !== file.uid));
            setUploadedFiles((prevList) => [...prevList, `${parentFolder.name} ${file.name}`]); // 添加到已上传文件列表
          } else {
            messageApi.open({
              type: 'error',
              content: `文件上传失败 ${message}`,
            });
          }
        } else {
          new Error('文件上传失败');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        onError(error);
      }
    },
    onChange: (info) => {
      setFileList(info.fileList); // 更新文件列表
    },
    fileList
  }

  useEffect(() => {
    if (modalOpen) {
      setFilePath(parentFolder.name); // 设置上传路径为当前文件夹
      setFileList([]); // 清空文件列表
      setUploadedFiles([]); // 清空已上传文件列表
    }
  }, [modalOpen])

  const closeModal = () => {
    console.log('closeModal');
    updateModalOpen(false);
    if (uploadedFiles && uploadedFiles.length > 0 && typeof refreshParent === 'function') {
      refreshParent();
    }
  }

  return (
    <Modal
      title={<h2>File Upload</h2>}
      footer={
        <div>
          <Button onClick={closeModal} size='large' style={{marginRight: 10}}>
            Cancel
          </Button>
          <Button type="primary" onClick={closeModal} size='large'>
            Submit
          </Button>
        </div>
      }
      width={740}
      open={modalOpen}
      onCancel={() => updateModalOpen(false)}
    >
      <Flex justify='center' align='flex-start' vertical>
        <Flex justify='center' align='flex-start'>
          <div style={{ paddingTop: '3px', paddingRight: '10px' }}>
            Upload Path:
          </div>
          <Input 
            placeholder="Please input Upload Path"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            style={{ marginBottom: '1rem', width: '20rem' }}
            disabled />
        </Flex>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />}>Upload</Button>
        </Upload>
        { (uploadedFiles && uploadedFiles.length > 0) && (
          <>
            <Divider orientation="left">已上传文件列表</Divider>
            <List
              size="small"
              bordered
              dataSource={uploadedFiles}
              renderItem={item => <List.Item>{item}</List.Item>}
            />
          </>
        ) }
      </Flex>
    </Modal>
  );
};

export default FileUploadModal;