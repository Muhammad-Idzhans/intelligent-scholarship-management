"use client";

import { useEffect } from "react";
import { Button, Card, Typography, Space, Spin } from "antd";
import { WindowsFilled, BarChartOutlined } from "@ant-design/icons";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If already signed in, skip login and go straight to dashboard
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "100vh" }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (

    <div
      className="d-flex justify-content-center align-items-center p-4"
      style={{ minHeight: "100vh", backgroundColor: "#f0f2f5" }}
    >
      <Card
        className="shadow-sm text-center p-3"
        style={{ maxWidth: 420, width: "100%" }}
      >
        <Space orientation="vertical" size="large" className="w-100">
          {/* Logo / Title */}
          <div>
            <div className="text-center mb-3" style={{ backgroundColor: "#0078d4", width: 90, height: 90, borderRadius: "50%", display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto" }}>
              <BarChartOutlined className="text-white" style={{ fontSize: 54 }} />
            </div>
            <Title level={3} className="mb-1">
              Scholarship Aid Analytics
            </Title>
            <Text type="secondary">
              Sign in to view your reports
            </Text>
          </div>

          {/* Sign In Button */}
          <Button
            type="primary"
            size="large"
            icon={<WindowsFilled />}
            onClick={() =>
              signIn("microsoft-entra-id", { callbackUrl: "/dashboard" })
            }
            block
          >
            Sign in with Microsoft Entra ID
          </Button>
        </Space>
      </Card>
    </div>
  );
}
