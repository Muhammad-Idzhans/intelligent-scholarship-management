"use client";

import { useState } from "react";
import { Layout, Menu, Typography } from "antd";
import {
  DashboardOutlined,
  UserAddOutlined,
  BookOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FundProjectionScreenOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";

const { Sider } = Layout;
const { Text } = Typography;

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Determine active menu key from current path
  const getSelectedKey = () => {
    if (pathname.startsWith("/add-applicant")) return "add-applicant";
    if (pathname.startsWith("/dashboard")) return "dashboard";
    return "dashboard";
  };

  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "add-applicant",
      icon: <UserAddOutlined />,
      label: "Tambah Pemohon",
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "dashboard") router.push("/dashboard");
    if (key === "add-applicant") router.push("/add-applicant");
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      theme="dark"
      breakpoint="lg"
      collapsedWidth={80}
      width={240}
      style={{
        overflow: "auto",
        height: "100vh",
        position: "sticky",
        top: 0,
        left: 0,
      }}
      trigger={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            color: "rgba(255,255,255,0.85)",
            fontSize: 16,
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      }
    >
      {/* App Branding */}
      <div className="d-flex align-items-center justify-content-center sidebar-logo">
        <FundProjectionScreenOutlined className="sidebar-logo-icon" />
        {!collapsed && (
          <Text
            strong
            className="sidebar-logo-text"
          >
            Scholarship Insights
          </Text>
        )}
      </div>

      {/* Navigation Menu */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </Sider>
  );
}
