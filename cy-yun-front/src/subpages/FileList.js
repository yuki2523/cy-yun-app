import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Flex, Space, Tree, Alert, Dropdown, Popconfirm } from 'antd';
import { MoreOutlined, DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { formatDate } from '../utils/utils';
import axiosInstance from '../utils/axiosInstance';
import { Base64 } from 'js-base64';
import { GlobalContext } from '../App';
import '../css/fileTree.css';
import Components from '../components';
const {
  FileUploadModal,
  NewFolderModal,
  FilePreviewModal,
  PreviewerModal,
  FileFinderModal,
  FileRenameModal,
  NewFileModal,
} = Components;

const fetchFolderContents = async (parentId = null) => {
  try {
    const response = await axiosInstance.get('/file-management/file-list/', {
      params: {
        parent_id: parentId, // 根目录为null
      }
    });
    console.log(response)
    let list;
    if (response.status === 200) {
      let code = response.data.code;
      let data = response.data.data;
      if (code === '1') {
        list = data.file_and_folder_list;
      }
    }
    return list?.map(item => ({
      key: item.id,
      title: item.name,
      size: item.size,
      updatedAt: item.updated_at,
      isLeaf: !item.is_folder,
      raw: item
    }));
  } catch (error) {
    console.error('加载文件夹内容失败：', error);
    return [];
  }
};

const updateTreeData = (list, key, children) => list.map(node => {
  if (node.key === key) {
    return { ...node, children };
  }
  if (node.children) {
    return { ...node, children: updateTreeData(node.children, key, children) };
  }
  return node;
});

// 只找路径
const findPathByKey = (nodes, targetKey, path = []) => {
  for (let node of nodes) {
    const newPath = [...path, node];
    if (node.key === targetKey) {
      return newPath;
    }
    if (node.children) {
      const found = findPathByKey(node.children, targetKey, newPath);
      if (found) return found;
    }
  }
  return null;
};

// 找到节点
const findNodeByKey = (nodes, key) => {
  for (let node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNodeByKey(node.children, key);
      if (found) return found;
    }
  }
  return null;
};

const ROOT_NODE_KEY = 'root-key';
const ROOT_NODE_TITLE = '/';

const FileList = () => {
  const navigate = useNavigate();
  const { messageApi, notificationApi, setEditableFileInfo, setAppLoading, fileTreeExpandedKeys, setFileTreeExpandedKeys } = useContext(GlobalContext);
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [parentFolder, setParentFolder] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [treeKey, setTreeKey] = useState(Date.now());
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [moveConfirm, setMoveConfirm] = useState({
    visible: false,
    dragNode: null,
    dragKey: null,
    newParentId: null,
    fromFolderName: '',
    targetFolderName: '',
  });
  const [onlineEditPreviewModalOpen, setOnlineEditPreviewModalOpen] = useState(false);
  const [onlineEditPreviewContent, setOnlineEditPreviewContent] = useState('');
  const [fileFinderModalOpen, setFileFinderModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState({ fileId: null, originalName: '' });
  const [renameLoading, setRenameLoading] = useState(false);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);

  useEffect(() => {
    if (fileTreeExpandedKeys && fileTreeExpandedKeys.length) { // 从MainPage传递过来需要展开的keys，这种使用方式得时刻注意全局状态的fileTreeExpandedKeys
      fetchData(fileTreeExpandedKeys);
      setSelectedKeys([fileTreeExpandedKeys[fileTreeExpandedKeys.length - 1]]); // 默认选中最后一个展开的节点
      setFileTreeExpandedKeys([]); // 清空已展开的keys，避免重复加载
    } else {
      fetchData();
      setSelectedKeys([ROOT_NODE_KEY])
    }
  }, []);

  const fetchData = async (keys = []) => {
    setAppLoading(true);
    let data = await fetchFolderContents();
    if (keys && keys.length > 0) {
      for (const key of keys) {
        if (key === ROOT_NODE_KEY) continue; // 跳过根节点
        let childrenData = await fetchFolderContents(key);
        data = updateTreeData(data, key, childrenData)
      }
    }
    // 包一层根目录节点，key为null
    const rootNode = {
      key: ROOT_NODE_KEY,
      title: ROOT_NODE_TITLE,
      isLeaf: false,
      size: '-',
      updatedAt: '',
      raw: { is_folder: true, parent_id: null },
      children: data || [],
    };
    setTreeData([rootNode]);
    setExpandedKeys([ROOT_NODE_KEY, ...keys]);
    setAppLoading(false);
  };

  const onExpandNode = (node) => {
    // 展开当前节点（如果未展开）
    if (!expandedKeys.includes(node.key)) {
      setExpandedKeys(prev => [...prev, node.key]);
    }
  };

  const buildTitle = (node) => {
    const menuLabelStyle = { display: 'inline-block', width: '4.5rem', fontSize: 13 };
    const menuItems = [
      node.raw?.online_editable && {
        key: 'edit',
        label: <span style={{ ...menuLabelStyle, color: '#1677ff' }}>编辑</span>,
        onClick: () => onlineEditFile(node, '1'),
      },
      (!node.raw?.is_folder && !node.raw?.online_editable) && {
        key: 'view',
        label: <span style={{ ...menuLabelStyle, color: '#52c41a' }}>新页面打开</span>,
        onClick: () => viewFile(node),
      },
      node.raw.is_folder && {
        key: 'upload',
        label: <span style={{ ...menuLabelStyle, color: '#faad14' }}>上传</span>,
        onClick: () => uploadFileToFolder(node),
      },
      node.raw.is_folder && {
        key: 'newFolder',
        label: <span style={{ ...menuLabelStyle, color: '#13c2c2' }}>新建文件夹</span>,
        onClick: () => newFolder(node),
      },
      node.raw.is_folder && {
        key: 'newFile',
        label: <span style={{ ...menuLabelStyle, color: '#722ed1' }}>新建文件</span>,
        onClick: () => newFile(node),
      },
      node.key !== ROOT_NODE_KEY && {
        key: 'rename',
        label: <span style={{ ...menuLabelStyle, color: '#ff4d4f' }}>重命名</span>,
        onClick: () => rename(node),
      },
      !node.raw.is_folder && {
        key: 'downloadFile',
        label: <span style={{ ...menuLabelStyle, color: '#2f54eb' }}>下载</span>,
        onClick: () => downloadFile(node),
      },
      !node.raw.is_folder && {
        key: 'shareFile',
        label: <span style={{ ...menuLabelStyle, color: '#fa8c16' }}>分享</span>,
        onClick: () => shareFile(node),
      },
    ];
    return (
      <Flex className="tree-node-row" justify="space-between" align="center" style={{ minHeight: 38, padding: '0 8px', gap: 8 }}>
        <Flex className="tree-filename-ellipsis" align="center" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => node.isLeaf
            ? (node.raw?.online_editable ? handleOnlineEditFilePreview(node) : previewFile(node))
            : onExpandNode(node)
          }
        >
          <span style={{ marginRight: 6, fontSize: 18 }}>
            {node.isLeaf ? '📄' : '📁'}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="tree-filename-ellipsis-inner">
              <span title={node.title} style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}>{node.title}</span>
            </span>
          </span>
        </Flex>
        <Flex className="tree-col size node" justify="flex-end" style={{ width: 80, color: '#888', fontSize: 13 }}>{node.size || '-'}</Flex>
        <Flex className="tree-col time node" justify="flex-end" style={{ width: 140, color: '#888', fontSize: 13 }}>{formatDate(node.updatedAt)}</Flex>
        <Flex className="tree-col actions node" justify="flex-end" style={{ minWidth: 60 }}>
          {node.key !== ROOT_NODE_KEY && (
            <Popconfirm
              title="Delete the file"
              description="Are you sure to delete this file?"
              onConfirm={() => deleteFile(node)}
              icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
            >
              <Button type="link" size="small" danger><DeleteOutlined /></Button>
            </Popconfirm>
          )}
          <Dropdown menu={{ items: menuItems.filter(Boolean) }}>
            <Button type="link" size="small"><MoreOutlined /></Button>
          </Dropdown>
        </Flex>
      </Flex>
    )
  };

  // 节点操作函数
  const previewFile = async (node) => {
    try {
      const response = await axiosInstance.get(`/file-management/get-preview-temp-path/`, {
        params: {
          ossPath: node.raw.oss_path
        }
      });
      let tempUrl;
      if (response.status === 200) {
        let code = response.data.code;
        let data = response.data.data;
        if (code === '1') {
          tempUrl = data.tempUrl;
        }
      }
      if (tempUrl) {
        setPreviewUrl(`/cy-yun/file-preview/onlinePreview?url=${encodeURIComponent(Base64.encode(tempUrl))}`);
        setPreviewModalOpen(true);
      } else {
        messageApi.open({
          type: 'error',
          content: `预览失败`,
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: `预览失败`,
      });
    }
  }

  const viewFile =  async (node) => {
    console.log('查看', node)
    const previewWindow = window.open('', '_blank');
    previewWindow.document.writeln(`
      <html>
        <head>
          <title>加载中...</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; }
          </style>
        </head>
        <body>
          <h2>正在加载预览，请稍候...</h2>
        </body>
      </html>
    `);
    previewWindow.document.close();
    try {
      const response = await axiosInstance.get(`/file-management/get-preview-temp-path/`, {
        params: {
          ossPath: node.raw.oss_path,
        },
      });
      console.log(response);
      let tempUrl;
      if (response.status === 200 && response.data.code === '1') {
        tempUrl = response.data.data.tempUrl;
      }
      if (tempUrl) {
        previewWindow.location.href = `/cy-yun/file-preview/onlinePreview?url=${encodeURIComponent(Base64.encode(tempUrl))}`;
      } else {
        previewWindow.close(); // 没有内容就关闭新窗口
        messageApi.open({
          type: 'error',
          content: `预览失败`,
        });
      }
    } catch (err) {
      previewWindow.close(); // 请求失败也关闭
      messageApi.open({
        type: 'error',
        content: `预览失败: ${err.message}`,
      });
    }
  }

  const uploadFileToFolder = (node) => {
    console.log('uploadFileToFolder', node);
    const pathNodes = findPathByKey(treeData, node.key)?.filter(item => item.key !== ROOT_NODE_KEY); // 过滤掉根节点
    setParentFolder({
      id: node.key === ROOT_NODE_KEY ? null : node.key,
      name: pathNodes && pathNodes.length ? `/ ${pathNodes.map(item => item.title).join(' / ')} /` : '/',
    });
    setFileUploadModalOpen(true);
  }

  const newFolder = (node) => {
    console.log('newFolder', node);
    const pathNodes = findPathByKey(treeData, node.key)?.filter(item => item.key !== ROOT_NODE_KEY);
    setParentFolder({
      id: node.key === ROOT_NODE_KEY ? null : node.key,
      name: pathNodes && pathNodes.length ? `/ ${pathNodes.map(item => item.title).join(' / ')} /` : '/',
    });
    setNewFolderModalOpen(true);
  }

  const newFile = (node) => {
    setParentFolder({
      id: node.key === ROOT_NODE_KEY ? null : node.key,
    });
    setNewFileModalOpen(true);
  }

  const rename = (node) => {
    setRenameTarget({ fileId: node.key, originalName: node.title });
    setRenameModalOpen(true);
  }

  const downloadFile = async (node) => {
    try {
      const res = await axiosInstance.get('/file-management/download-generate/', {
        params: { fileId: node.key }
      });
      if (res.status === 200 && res.data.code === '1') {
        const tempUrl = res.data.data.tempUrl;
        if (!tempUrl) {
          messageApi.error('获取下载链接失败');
          return;
        }
        const a = document.createElement('a');
        a.href = tempUrl;
        a.target = '_blank'; // 防止覆盖当前页面
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        messageApi.error(res.data?.msg || '下载失败');
      }
    } catch (e) {
      messageApi.error('下载失败');
    }
  };

  const shareFile = async (node) => {
    try {
      const res = await axiosInstance.get('/file-management/share-file/', {
        params: { fileId: node.key }
      });
      if (res.status === 200 && res.data.code === '1') {
        const shareUrl = res.data.data.shareUrl;
        if (!shareUrl) {
          messageApi.error('获取分享链接失败');
          return;
        }
        // window.alert(`分享链接已生成：\n${shareUrl}\n请复制链接后分享给他人。`);
        notificationApi.open({
          message: '分享链接已生成',
          description: (
            <div>
              <div style={{ wordBreak: 'break-all', marginBottom: 8 }}>{shareUrl}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => notificationApi.destroy()}>关闭</Button>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    messageApi.success('已复制到剪贴板');
                  }}
                >
                  复制
                </Button>
              </div>
            </div>
          ),
          duration: 0,
          key: 'share-link',
        });
      } else {
        messageApi.error(res.data?.msg || '获取分享链接失败');
      }
    } catch (e) {
      messageApi.error('获取分享链接失败');
    }
  };

  const onlineEditFile = (node, editMode) => {
    console.log('编辑', node);
    const pathNodes = findPathByKey(treeData, node.key)?.filter(item => item.key !== ROOT_NODE_KEY);
    pathNodes.pop();
    setEditableFileInfo({
      fileId: node.key,
      filePath: pathNodes && pathNodes.length ? `/ ${pathNodes.map(item => item.title).join(' / ')} ` : '',
      fileName: node.title,
      folderId: node.raw.parent_id,
      editMode,
    });
    navigate('/online-editor');
  };

  const handleOnlineEditFilePreview = async (node) => {
    if (node.key) {
      try {
        setAppLoading(true);
        const res = await axiosInstance.post('/file-management/get-online-edit-file/', { fileId: node.key });
        if (res.status === 200 && res.data.code === '1') {
          setOnlineEditPreviewContent(res.data.data.fileContent.content || '');
          setOnlineEditPreviewModalOpen(true);
        } else {
          messageApi.open({ type: 'error', content: '获取文件内容失败' });
        }
      } catch {
        messageApi.open({ type: 'error', content: '获取文件内容失败' });
      } finally {
        setAppLoading(false);
      }
    }
  };
  
  const deleteFile = async (node) => {
    try {
      const response = await axiosInstance.post('/file-management/delete-file/', {
        id: node.key,
      });
      if (response.status === 200 && response.data.code === '1') {
        messageApi.open({
          type: 'success',
          content: '删除成功',
        });
        let keys = [...expandedKeys].filter(item => item !== node.key);
        setExpandedKeys([]);
        setTreeKey(Date.now()); // 强制Tree组件重置
        fetchData(keys);
      } else {
        messageApi.open({
          type: 'error',
          content: response.data?.msg || '删除失败',
        });
      }
    } catch (error) {
      messageApi.open({
        type: 'error',
        content: '删除失败',
      });
    }
  };

  const refreshFileTree = async () => {
    let keys = [...expandedKeys];
    setExpandedKeys([]);
    setTreeKey(Date.now()); // 强制Tree组件重置
    await fetchData(keys);
  }

  const onLoadData = async ({ key, children }) => {
    if (children) return;
    const childrenData = await fetchFolderContents(key);
    setTreeData(origin => updateTreeData(origin, key, childrenData));
  };

  const renderTreeNodes = (data) => {
    console.log('renderTreeNodes', data);
    return data.map(item => {
      const node = {
        ...item,
        title: buildTitle(item),
      };
      // 只在有children且非空时递归赋值children字段
      if (item.children && item.children.length > 0) {
        node.children = renderTreeNodes(item.children);
      }
      return node;
    });
  }

  const handleMoveAccept = async () => {
    const { dragKey, newParentId } = moveConfirm;
    setMoveConfirm({ ...moveConfirm, visible: false });
    setAppLoading(true);
    try {
      const response = await axiosInstance.post('/file-management/move-file/', {
        id: dragKey,
        newParentId,
      });
      if (response.status === 200 && response.data.code === '1') {
        messageApi.success('移动成功');
        await refreshFileTree();
      } else {
        messageApi.error(response.data?.msg || '移动失败');
      }
    } catch (e) {
      messageApi.error('移动失败');
    }
    setAppLoading(false);
  };

  const handleMoveDecline = () => {
    setMoveConfirm({ ...moveConfirm, visible: false });
  };

  const onDrop = async (info) => {
    const dropKey = info.node.key; // 目标节点
    const dragKey = info.dragNode.key; // 被拖动节点

    // 找到拖动节点和目标节点的原始数据
    const dragNode = findNodeByKey(treeData, dragKey);
    const dropNode = findNodeByKey(treeData, dropKey);
    console.log('拖动节点:', dragNode, '目标节点:', dropNode);

    // 不能拖到自己或自己子孙节点下
    const isDescendant = (parent, childKey) => {
      if (!parent.children) return false;
      for (let c of parent.children) {
        if (c.key === childKey) return true;
        if (isDescendant(c, childKey)) return true;
      }
      return false;
    };
    if (dragKey === dropKey || isDescendant(dragNode, dropKey)) {
      messageApi.warning('不能拖到自身或子文件夹下');
      return;
    }

    // 计算新父ID
    let newParentId;
    let targetFolderName;
    if (dropKey === ROOT_NODE_KEY) {
      // 拖到根目录
      newParentId = null;
      targetFolderName = ROOT_NODE_TITLE;
    } else if (!dropNode.isLeaf) {
      // 拖到文件夹
      newParentId = dropNode.key;
      targetFolderName = dropNode.title;
    } else {
      // 拖到文件，父ID为文件的父ID
      newParentId = dropNode.raw.parent_id;
      // 找到父文件夹名
      const parentPath = findPathByKey(treeData, dropNode.raw.parent_id);
      targetFolderName = parentPath ? parentPath[parentPath.length - 1]?.title : '/';
    }
    if (dragNode.raw.parent_id === newParentId) {
      return;
    }
    // 找到原父文件夹名
    const fromPath = findPathByKey(treeData, dragNode.raw.parent_id);
    const fromFolderName = fromPath ? fromPath[fromPath.length - 1]?.title : '/';
    console.log(`确定将【${dragNode.title}】从【${fromFolderName}】移动到【${targetFolderName}】吗？`);
    setMoveConfirm({
      visible: true,
      dragNode,
      dragKey,
      newParentId,
      fromFolderName,
      targetFolderName,
    });
  };

  return (
    <Flex justify='center' align='flex-start' vertical>
      <h1>FileList</h1>
      <Flex justify='center' align='center'>
        <Button type="primary" onClick={() => setFileFinderModalOpen(true)} size='large' style={{ width: '7rem' }}>
          Find File
        </Button>
      </Flex>
      <Flex justify='center' align='flex-start' vertical style={{ width: '100%', maxWidth: '80rem', marginTop: '2rem' }}>
        <div className="file-tree-responsive">
          <Tree
            key={treeKey}
            loadData={onLoadData}
            treeData={renderTreeNodes(treeData)}
            defaultExpandAll={false}
            blockNode={true}
            showLine={{ showLeafIcon: false }}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            onExpand={setExpandedKeys}
            draggable
            onDrop={onDrop}
            style={{ minWidth: 320 }}
          />
        </div>
      </Flex>
      <FileUploadModal
        parentFolder={parentFolder}
        modalOpen={fileUploadModalOpen}
        updateModalOpen={() => {setFileUploadModalOpen(false)}}
        refreshParent={() => {console.log(`refreshParent`);refreshFileTree()}} />
      <NewFolderModal
        parentFolder={parentFolder}
        modalOpen={newFolderModalOpen}
        updateModalOpen={() => {setNewFolderModalOpen(false)}}
        refreshParent={() => {console.log(`refreshParent`);refreshFileTree()}} />
      <FilePreviewModal
        open={previewModalOpen}
        onCancel={() => { setPreviewModalOpen(false); setPreviewUrl(''); }}
        previewUrl={previewUrl}
      />
      {moveConfirm.visible && (
        <div style={{
          position: 'fixed',
          top: '10%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2000,
          minWidth: 760,
        }}>
          <Alert
            message="确认移动"
            description={
              <>
                确定将【{moveConfirm.dragNode?.title}】
                从【{moveConfirm.fromFolderName}】
                移动到【{moveConfirm.targetFolderName}】吗？
              </>
            }
            type="warning"
            action={
              <Space direction="vertical">
                <Button size="small" type="primary" onClick={handleMoveAccept}>
                  确认
                </Button>
                <Button size="small" danger ghost onClick={handleMoveDecline}>
                  取消
                </Button>
              </Space>
            }
            showIcon
            closable
            onClose={handleMoveDecline}
          />
        </div>
      )}
      <PreviewerModal
        open={onlineEditPreviewModalOpen}
        onCancel={() => setOnlineEditPreviewModalOpen(false)}
        content={onlineEditPreviewContent}
      />
      <FileFinderModal
        open={fileFinderModalOpen}
        onCancel={() => setFileFinderModalOpen(false)}
        onExpandFolder={record => {
          // 展开文件夹逻辑：将路径上的所有id都加入expandedKeys并高亮最后一个
          if (record.path && record.path.length) {
            const keys = record.path.map(item => item.id);
            setExpandedKeys([ROOT_NODE_KEY, ...keys]);
            setSelectedKeys([record.id]);
            setFileFinderModalOpen(false);
          }
        }}
        onEdit={record => {
          setEditableFileInfo({
            fileId: record.id,
            filePath: record.path && record.path.length ? `/ ${record.path.map(item => item.name).join(' / ')} ` : '',
            fileName: record.name,
            folderId: record.parent_id,
            editMode: '1'
          });
          setFileFinderModalOpen(false);
          navigate('/online-editor');
        }}
        onPreview={record => {
          if (record.online_editable) {
            handleOnlineEditFilePreview({
              key: record.id,
              title: record.name
            });
          } else {
            previewFile({
              key: record.id,
              title: record.name,
              raw: { oss_path: record.oss_path }
            });
          }
        }}
      />
      <FileRenameModal
        open={renameModalOpen}
        onCancel={() => setRenameModalOpen(false)}
        onOk={async (newName) => {
          setRenameLoading(true);
          try {
            const res = await axiosInstance.post('/file-management/rename/', {
              fileId: renameTarget.fileId,
              newName,
            });
            if (res.status === 200 && res.data.code === '1') {
              messageApi.success('重命名成功');
              setRenameModalOpen(false);
              await refreshFileTree();
            } else {
              messageApi.error(res.data?.msg || '重命名失败');
            }
          } catch {
            messageApi.error('重命名失败');
          }
          setRenameLoading(false);
        }}
        originalName={renameTarget.originalName}
        loading={renameLoading}
      />
      <NewFileModal
        parentFolder={parentFolder}
        modalOpen={newFileModalOpen}
        updateModalOpen={() => setNewFileModalOpen(false)}
        refreshParent={() => {console.log(`refreshParent`);refreshFileTree()}}
      />
    </Flex>
  );
};

export default FileList;