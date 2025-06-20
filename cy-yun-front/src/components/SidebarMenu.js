import { useState, useEffect } from 'react';
import { Menu, Layout } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
const { Sider } = Layout;

const SidebarMenu = ({ menuItems }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(['1']);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // console.log(location)
    let path = location.pathname.split('/').reverse()[0]
    // console.log(menuItems)
    // console.log(path)
    let menuItemsKey = menuItems.find((i) => i.path === `/${path}`);
    // console.log('menuItemsKey', menuItemsKey);
    if (menuItemsKey) {
      setSelectedKeys([menuItemsKey.key])
    }
  }, [location])

  const handleMenuClick = (e) => {
    const { key } = e;
    const item = menuItems.find((item) => item.key === key);
    const path = item?.path;
    if (path) {
      navigate(path);
      setSelectedKeys([item.key])
    }
  };

  return (
    <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
      <div className="logo-vertical">Menu</div>
      <Menu
        theme="dark"
        defaultSelectedKeys={['1']}
        mode="inline"
        items={menuItems}
        onClick={handleMenuClick}
        selectedKeys={selectedKeys}
      />
    </Sider>
  );
};

export default SidebarMenu;