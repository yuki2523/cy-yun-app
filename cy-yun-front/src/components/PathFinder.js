import { useEffect, useState } from 'react';
import { Tree, Flex, Modal, Button, Input } from 'antd';
import axiosInstance from '../utils/axiosInstance';

const fetchFolderContents = async (fileFinderParams = {}) => {
  try {
    const response = await axiosInstance.get('/file-management/file-list/', {
      params: {
        // parent_id: parentId, // 根目录为null
        // type_id: 2 // 1:文件 2:文件夹
        ...fileFinderParams
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

const updateTreeData = (list, key, children) => list.map(node => {
  if (node.key === key) {
    return { ...node, children };
  }
  if (node.children) {
    return { ...node, children: updateTreeData(node.children, key, children) };
  }
  return node;
});

// fileFinderParams
//  parentId: folder id
//  type_id: 2 // 1:文件 2:文件夹
// 
// updatePathInfo
//  pathList: [{key, title, size, updatedAt, isLeaf, raw}]
//  currentFileInfo: {fileId, fileName, parentId}
//    fileId: null则为新建文件
//    fileName: 文件名一定得传
//    parentId: 文件夹id
const PathFinder = ({ modalOpen, updateModalOpen, updatePathInfo, fileFinderParams = {}, inputEnabled = true }) => {
  const [loading, setLoading] = useState(false);
  const [currentFileInfo, setCurrentFileInfo] = useState({
    fileId: null,
    fileName: '',
    parentId: null
  });
  const [pathList, setPathList] = useState([]);
  const [treeData, setTreeData] = useState([]);

  useEffect(() => {
    if (!modalOpen) return;
    setCurrentFileInfo({});
    setPathList([]);
    setTreeData([]);
    const fetchData = async () => {
      setLoading(true);
      const data = await fetchFolderContents(fileFinderParams);
      console.log('fetchData', data);
      setTreeData(data);
      setLoading(false);
    };
    fetchData();
  }, [modalOpen])

  const onLoadData = async ({ key, children }) => {
    if (children) return;
    fileFinderParams.parent_id = key;
    const childrenData = await fetchFolderContents(fileFinderParams);
    setTreeData(origin => updateTreeData(origin, key, childrenData));
  };

  return (
    <Modal
      title={<h2>Path Finder</h2>}
      footer={
        <div>
          <Button onClick={() => updateModalOpen(false)} size='large' style={{marginRight: 10, width: '4rem'}}>
            Cancel
          </Button>
          <Button type="primary" onClick={() => {updatePathInfo(pathList, currentFileInfo);updateModalOpen(false)}} size='large' style={{width: '4rem'}}>
            OK
          </Button>
        </div>
      }
      loading={loading}
      width={740}
      open={modalOpen}
      onCancel={() => updateModalOpen(false)}
    >
      <Flex justify='center' align='flex-start' vertical>
        <Tree
          treeData={treeData}
          onSelect={(selectedKeys, info) => {
              console.log('selectedKeys', selectedKeys);
              console.log('info', info);
              if (selectedKeys.length === 0) return;

              const selectedKey = selectedKeys[0];
              const pathNodes = findPathByKey(treeData, selectedKey);
              
              if (pathNodes) {
                console.log('pathNodes', pathNodes);
                if (info.node.isLeaf) {
                  setCurrentFileInfo({
                    fileId: selectedKey,
                    fileName: info.node.title,
                    parentId: info.node.raw.parent_id
                  });
                  pathNodes.pop(); // Remove the file node from the path
                } else {
                  setCurrentFileInfo({
                    fileId: null,
                    fileName: '',
                    parentId: selectedKey
                  });
                }
                setPathList(pathNodes);
              }
          }}
          loadData={onLoadData}
        />
        <Flex justify='center' align='flex-start'>
          <div style={{ paddingTop: '3px', paddingRight: '10px' }}>
            Folder: /  {pathList.length > 0 ? pathList.map((item, index) => (
              <span key={item.key}>
                {item.title}
                {index < pathList.length - 1 ? ' / ' : ''}
              </span>
            )) : ''}
          </div>
        </Flex>
        <Flex justify='center' align='flex-start'>
          <div style={{ paddingTop: '3px', paddingRight: '10px' }}>
            File Name: 
            <Input 
              placeholder="Please input File Name"
              value={currentFileInfo?.fileName}
              onChange={(e) => setCurrentFileInfo({
                ...currentFileInfo,
                fileName: e.target.value
              })}
              style={{ height: '2.5vh', lineHeight: '2.5vh', width: '11rem', marginLeft: '0.5rem' }}
              disabled={inputEnabled} />
          </div>
        </Flex>
      </Flex>
    </Modal>
  );
};

export default PathFinder;