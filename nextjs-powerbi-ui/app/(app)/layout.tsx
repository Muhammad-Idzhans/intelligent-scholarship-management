import SidebarLayout from "@/components/SidebarLayout";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
