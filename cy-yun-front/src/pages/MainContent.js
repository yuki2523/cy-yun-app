import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { HomeOutlined, UserOutlined, FolderOpenOutlined, DeleteOutlined, EditOutlined, DownOutlined, SettingOutlined } from '@ant-design/icons';
import { Flex, Layout, theme, Dropdown, Space } from 'antd';
import PrivateRoute from '../PrivateRoute';
import SubPages from '../subpages';
import Components from '../components';
import axiosInstance from '../utils/axiosInstance';
import '../css/MainContent.css';
import { useEffect, useState } from 'react';

const {
  SidebarMenu,
} = Components;
const {
  RecycleBin,
  FileList,
  OnlineEditorPage,
  MainPage,
  MyProfile,
  AdminPage,
} = SubPages;
const { Header, Content } = Layout;

const MainContent = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const userName = window.localStorage.getItem('userName') || '-';
  const navigate = useNavigate();

  // 动态菜单项，避免首次渲染时userGroup为null
  const [menuItems, setMenuItems] = useState([
    {
        key: '1',
        label: 'Main Page',
        icon: <HomeOutlined />,
        path: '/main-page',
      },
      {
        key: '2',
        label: 'My Profile',
        icon: <UserOutlined />,
        path: '/my-profile',
      },
      {
        key: '3',
        label: 'File List',
        icon: <FolderOpenOutlined />,
        path: '/file-list',
      },
      {
        key: '4',
        label: 'Recycle Bin',
        icon: <DeleteOutlined />,
        path: '/recycle-bin',
      },
      {
        key: '5',
        label: 'Online Editor',
        icon: <EditOutlined />,
        path: '/online-editor',
      },
      {
        key: '6',
        label: 'Admin Page',
        icon: <SettingOutlined />,
        path: '/admin-page',
      }
  ]);

  useEffect(() => {
    const userGroup = window.localStorage.getItem('userGroup');
    if (userGroup !== 'admin') {
      setMenuItems(menuItems.filter(item => item.key !== '6'));
    }
  }, []);

  const dropdownItems = [
    {
      key: '1',
      label: 'My Profile',
      path: '/my-profile'
    },
    {
      key: '2',
      label: 'Logout',
    },
  ];

  const handleDropdownClick = async (e) => {
    const { key } = e
    const dropdownItem = dropdownItems.find((item) => item.key === key);
    const path = dropdownItem?.path;
    if (path) {
      navigate(path);
    } else if (key === '2') {
      try {
        await axiosInstance.post(`/user-management/logout/`)
      } catch (error) {
        console.error('Error logging out:', error);
      }
      localStorage.removeItem('isYunLogin');
      localStorage.removeItem('yunId');
      localStorage.removeItem('userGroup');
      localStorage.removeItem('userName');
      navigate('/login');
    }
  };

  return (
    <Layout
      style={{
        minHeight: '100vh',
      }}
    >
      {menuItems && menuItems.length && (<SidebarMenu menuItems={menuItems} />)}
      <Layout>
        <Header
          style={{
            paddingLeft: 10,
            background: colorBgContainer,
          }}
        >
          <Flex justify="space-between">
            <span>Cy-Yun File Management And Notebook System</span>
            <Dropdown menu={{ items: dropdownItems, onClick: handleDropdownClick }}>
              <a onClick={(e) => e.preventDefault()}>
                <Space>
                  { userName }
                  <DownOutlined />
                </Space>
              </a>
            </Dropdown>
          </Flex>
        </Header>
        <Content style={{ padding: '0 50px' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/file-list" />} />
            <Route
              path="/file-list"
              element={<PrivateRoute element={<FileList />} />}
            />
            <Route
              path="/recycle-bin"
              element={<PrivateRoute element={<RecycleBin />} />}
            />
            <Route
              path="/online-editor"
              element={<PrivateRoute element={<OnlineEditorPage />} />}
            />
            <Route
              path="/main-page"
              element={<PrivateRoute element={<MainPage />} />}
            />
            <Route
              path="/my-profile"
              element={<PrivateRoute element={<MyProfile />} />}
            />
            <Route
              path="/admin-page"
              element={<PrivateRoute element={<AdminPage />} />}
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainContent;