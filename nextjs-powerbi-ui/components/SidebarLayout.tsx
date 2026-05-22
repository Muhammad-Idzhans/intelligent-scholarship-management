"use client";

import { Layout } from "antd";
import AppSidebar from "./AppSidebar";

const { Content } = Layout;

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <AppSidebar />
      <Layout>
        <Content>{children}</Content>
      </Layout>
    </Layout>
  );
}
