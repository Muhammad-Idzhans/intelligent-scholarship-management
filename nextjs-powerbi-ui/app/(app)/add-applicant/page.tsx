"use client";

import { useState, useCallback } from "react";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Upload,
  Button,
  Steps,
  Card,
  Row,
  Col,
  Typography,
  Alert,
  Modal,
  Space,
  Divider,
  App,
  Layout,
  Avatar,
  Dropdown,
  theme,
  Spin,
} from "antd";
import {
  UserOutlined,
  BookOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SendOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import type { UploadFile, MenuProps } from "antd";
import { useSession, signOut } from "next-auth/react";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// ─── Step definitions ────────────────────────────────────────────────────────

const steps = [
  {
    title: "Maklumat Peribadi",
    description: "Personal Information",
    icon: <UserOutlined />,
  },
  {
    title: "Maklumat Akademik",
    description: "Academic Information",
    icon: <BookOutlined />,
  },
  {
    title: "Maklumat Kewangan",
    description: "Financial Information",
    icon: <BankOutlined />,
  },
  {
    title: "Pilihan Biasiswa",
    description: "Scholarship Selection",
    icon: <SafetyCertificateOutlined />,
  },
];

// ─── Field name groups per step (for per-step validation) ────────────────────

const stepFields: string[][] = [
  // Step 1: Personal Info
  [
    "fullName",
    "icNumber",
    "email",
    "phone",
    "gender",
    "homeState",
    "disabilityStatus",
  ],
  // Step 2: Academic Info
  [
    "university",
    "faculty",
    "program",
    "programLevel",
    "fieldOfStudy",
    "currentSemester",
    "cgpa",
  ],
  // Step 3: Financial Info
  [
    "parentName",
    "parentIc",
    "incomeRange",
    "payslip",
  ],
  // Step 4: Scholarship
  ["scholarshipApplied"],
];

// ─── Dropdown options ────────────────────────────────────────────────────────

const genderOptions = ["Lelaki", "Perempuan"];

const stateOptions = [
  "Selangor",
  "Johor",
  "Perak",
  "Kedah",
  "Kelantan",
  "Terengganu",
  "Pahang",
  "Sabah",
  "Sarawak",
  "Pulau Pinang",
  "Negeri Sembilan",
  "Melaka",
  "Kuala Lumpur",
  "Perlis",
];

const disabilityOptions = ["Tiada", "OKU"];

const universityOptions = [
  "Universiti Malaya",
  "Universiti Teknologi Malaysia",
  "Universiti Kebangsaan Malaysia",
  "Universiti Putra Malaysia",
  "Universiti Teknologi MARA",
  "Universiti Sains Malaysia",
];

const programLevelOptions = ["Sarjana Muda", "Diploma"];

const fieldOfStudyOptions = [
  "Kejuruteraan",
  "Sains Komputer",
  "Sains Tulen",
  "Sains Kesihatan",
  "Pengurusan",
  "Undang-Undang",
  "Sastera",
  "Pendidikan",
  "Ekonomi",
  "Sains Sosial",
];

const incomeRangeOptions = [
  "RM1,000 - RM2,000",
  "RM2,000 - RM3,000",
  "RM3,000 - RM5,000",
  "RM5,000 - RM8,000",
  "RM8,000 - RM10,000",
];

const scholarshipOptions = [
  "Biasiswa Kecemerlangan Akademik",
  "Bantuan Kewangan Pelajar (BKP)",
  "Biasiswa B40",
  "Biasiswa Sains & Teknologi",
];

// ─── Scholarship info cards ──────────────────────────────────────────────────

const scholarshipInfo: Record<
  string,
  { minCGPA: string; maxIncome: string; extra: string; color: string }
> = {
  "Biasiswa Kecemerlangan Akademik": {
    minCGPA: "3.50",
    maxIncome: "RM5,000",
    extra: "Keutamaan STEM / STEM priority",
    color: "#1890ff",
  },
  "Bantuan Kewangan Pelajar (BKP)": {
    minCGPA: "2.00",
    maxIncome: "RM3,000",
    extra: "B40 sahaja / B40 only",
    color: "#52c41a",
  },
  "Biasiswa B40": {
    minCGPA: "2.50",
    maxIncome: "RM4,850",
    extra: "Semester 2 ke atas / Sem 2 and above",
    color: "#fa8c16",
  },
  "Biasiswa Sains & Teknologi": {
    minCGPA: "3.00",
    maxIncome: "RM8,000",
    extra: "Bidang STEM sahaja / STEM fields only",
    color: "#722ed1",
  },
};

// ─── Income range parsing utility ────────────────────────────────────────────

function parseIncomeRange(range: string): { min: number; max: number } {
  // e.g. "RM1,000 - RM2,000" → { min: 1000, max: 2000 }
  const nums = range.match(/[\d,]+/g);
  if (!nums || nums.length < 2) return { min: 0, max: 0 };
  return {
    min: parseInt(nums[0].replace(/,/g, ""), 10),
    max: parseInt(nums[1].replace(/,/g, ""), 10),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AddApplicantPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState<string>("");
  const [verificationResult, setVerificationResult] = useState<{
    status: "match" | "mismatch" | "skipped" | "flagged";
    extractedData?: { parent_name: string; employer_name: string; gross_salary: number; net_salary: number };
    declaredRange?: string;
  } | null>(null);
  const [isStepComplete, setIsStepComplete] = useState(false);

  const { message, modal } = App.useApp();

  // Check whether all required fields in the current step are filled
  const checkCurrentStepComplete = useCallback(
    (step: number) => {
      const fields = stepFields[step];
      const values = form.getFieldsValue(fields);
      const allFilled = fields.every((field) => {
        const val = values[field];
        if (val === undefined || val === null || val === "") return false;
        if (Array.isArray(val) && val.length === 0) return false;
        return true;
      });
      setIsStepComplete(allFilled);
    },
    [form]
  );

  // ── Step Navigation ──────────────────────────────────────────────────────

  const handleNext = async () => {
    try {
      // Validate only current step's fields
      await form.validateFields(stepFields[currentStep]);

      // If leaving Step 3 (Financial Info), trigger payslip verification
      if (currentStep === 2) {
        await handleVerification();
        return; // handleVerification manages the step transition
      }

      setCurrentStep((prev) => {
        const next = prev + 1;
        // Re-evaluate completeness for the new step
        setTimeout(() => checkCurrentStepComplete(next), 0);
        return next;
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Validation failed — Ant Design shows inline errors
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => {
      const next = prev - 1;
      // Re-evaluate completeness for the previous step
      setTimeout(() => checkCurrentStepComplete(next), 0);
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    form.resetFields();
    setFileList([]);
    setCurrentStep(0);
    setSelectedScholarship("");
    setVerificationResult(null);
    setIsStepComplete(false);
    message.info("Borang telah diset semula / Form has been reset");
  };

  // ── Payslip Verification (triggered between Step 3 → Step 4) ──────────

  const handleVerification = async () => {
    setVerifying(true);

    const values = form.getFieldsValue();
    const declaredRange = values.incomeRange;

    // Build FormData with the payslip file
    const formData = new FormData();
    if (fileList.length > 0 && fileList[0].originFileObj) {
      formData.append("payslip", fileList[0].originFileObj);
    }

    try {
      const response = await fetch("/api/verify-payslip", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data) {
        const extracted = result.data;
        const { min, max } = parseIncomeRange(declaredRange);
        const grossSalary = extracted.gross_salary;

        // Check if extracted salary matches declared range
        if (grossSalary >= min && grossSalary <= max) {
          // ✅ Match — show success modal, then advance to Step 4
          setVerificationResult({ status: "match", extractedData: extracted, declaredRange });
          modal.success({
            title: "Pengesahan Berjaya / Verification Successful",
            content: (
              <div>
                <p>
                  Gaji yang diekstrak (<strong>RM {grossSalary.toLocaleString()}</strong>)
                  sepadan dengan julat pendapatan yang diisytiharkan (
                  <strong>{declaredRange}</strong>).
                </p>
                <Divider />
                <p style={{ fontSize: 12, color: "#888" }}>
                  Nama Penjaga: {extracted.parent_name}
                  <br />
                  Nama Majikan: {extracted.employer_name}
                  <br />
                  Gaji Kasar: RM {extracted.gross_salary.toLocaleString()}
                  <br />
                  Gaji Bersih: RM {extracted.net_salary.toLocaleString()}
                </p>
              </div>
            ),
            okText: "Teruskan ke Langkah 4 / Continue to Step 4",
            onOk: () => {
              setCurrentStep(3);
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
          });
        } else {
          // ❌ Mismatch — show warning, user chooses to go back or proceed
          modal.confirm({
            classNames: {
              footer: "d-flex flex-column gap-2"
            },
            // You still need this to fix Ant Design's default button sizing/margins in a column
            cancelButtonProps: { className: "w-100 m-0 mb-2" },
            okButtonProps: { className: "w-100 m-0" },

            title: "Percanggahan Dikesan / Discrepancy Detected",
            icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
            content: (
              <div>
                <p>
                  Gaji yang diekstrak daripada slip gaji ialah{" "}
                  <strong>RM {grossSalary.toLocaleString()}</strong> tetapi
                  julat pendapatan yang diisytiharkan ialah{" "}
                  <strong>{declaredRange}</strong>.
                </p>
                <p>Sila semak semula maklumat anda.</p>
              </div>
            ),
            okText: "Teruskan juga / Proceed Anyway",
            cancelText: "Semak Semula / Review Again",
            onOk: () => {
              setVerificationResult({ status: "flagged", extractedData: extracted, declaredRange });
              setCurrentStep(3);
              window.scrollTo({ top: 0, behavior: "smooth" });
            },
            onCancel: () => {
              // Stay on Step 3 to fix
              setVerificationResult(null);
            },
          });
        }
      } else {
        // API returned error — skip verification, proceed to Step 4
        setVerificationResult({ status: "skipped" });
        message.warning("Pengesahan automatik tidak tersedia. Permohonan akan disemak secara manual.");
        setCurrentStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      // Network/API error — skip verification, proceed to Step 4
      setVerificationResult({ status: "skipped" });
      message.warning("Pengesahan automatik tidak tersedia. Permohonan akan disemak secara manual.");
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setVerifying(false);
    }
  };

  // ── Submit (Step 4 — just submits the application) ───────────────────────

  const handleSubmit = async () => {
    try {
      await form.validateFields();
      setSubmitting(true);

      // Simulate submission delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const isFlagged = verificationResult?.status === "flagged" || verificationResult?.status === "skipped";
      showSuccessModal(isFlagged);
    } catch {
      // Form validation failed
    } finally {
      setSubmitting(false);
    }
  };

  const showSuccessModal = (flagged = false) => {
    const appId = `APP-${Math.floor(1000 + Math.random() * 9000)}`;
    modal.success({
      title: "Permohonan Berjaya Dihantar / Application Submitted",
      content: (
        <div>
          <p>
            Permohonan anda telah berjaya dihantar.
          </p>
          <p>
            <strong>ID Permohonan: {appId}</strong>
          </p>
          {flagged && (
            <Alert
              type="warning"
              title="Permohonan ini ditandakan untuk semakan manual kerana percanggahan pendapatan."
              style={{ marginTop: 12 }}
              showIcon
            />
          )}
        </div>
      ),
      okText: "Tutup / Close",
      onOk: () => {
        handleReset();
      },
    });
  };

  const showSuccessModalWithSkip = () => {
    const appId = `APP-${Math.floor(1000 + Math.random() * 9000)}`;
    modal.success({
      title: "Permohonan Berjaya Dihantar / Application Submitted",
      content: (
        <div>
          <p>
            Permohonan anda telah berjaya dihantar.
          </p>
          <p>
            <strong>ID Permohonan: {appId}</strong>
          </p>
          <Alert
            type="info"
            title="Pengesahan automatik tidak tersedia. Permohonan akan disemak secara manual."
            description="Automatic verification is not available. Application will be reviewed manually."
            style={{ marginTop: 12 }}
            showIcon
          />
        </div>
      ),
      okText: "Tutup / Close",
      onOk: () => {
        handleReset();
      },
    });
  };

  // ── Upload handlers ──────────────────────────────────────────────────────

  const uploadProps = {
    beforeUpload: (file: File) => {
      // Prevent auto-upload; we'll handle it on submit
      return false;
    },
    accept: ".pdf",
    maxCount: 1,
    fileList,
    onChange: ({ fileList: newFileList }: { fileList: UploadFile[] }) => {
      setFileList(newFileList);
      // Set form field value for validation
      form.setFieldsValue({
        payslip: newFileList.length > 0 ? newFileList : undefined,
      });
    },
    onRemove: () => {
      setFileList([]);
      form.setFieldsValue({ payslip: undefined });
    },
  };

  // ── Demo Auto-Fill (for client demo — fills all fields except payslip) ───

  const handleDemoFill = () => {
    form.setFieldsValue({
      // Step 1: Personal Info
      fullName: "Nurul Aisyah binti Ahmad",
      icNumber: "020315-10-1234",
      email: "nurul.aisyah@student.um.edu.my",
      phone: "012-3456 7890",
      gender: "Perempuan",
      homeState: "Selangor",
      disabilityStatus: "Tiada",
      // Step 2: Academic Info
      university: "Universiti Malaya",
      faculty: "Fakulti Kejuruteraan",
      program: "Sarjana Muda Kejuruteraan Elektrik",
      programLevel: "Sarjana Muda",
      fieldOfStudy: "Kejuruteraan",
      currentSemester: 5,
      cgpa: 3.72,
      // Step 3: Financial Info
      parentName: "Ahmad bin Ibrahim",
      parentIc: "750812-10-5678",
      incomeRange: "RM3,000 - RM5,000",
      // Step 4: Scholarship
      scholarshipApplied: "Biasiswa Kecemerlangan Akademik",
    });
    setSelectedScholarship("Biasiswa Kecemerlangan Akademik");
    checkCurrentStepComplete(currentStep);
    message.success("Data demo telah diisi / Demo data filled");
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const { data: session, status } = useSession();

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

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";

  const profileMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      label: (
        <div className="py-1">
          <Text strong>{userName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {userEmail}
          </Text>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" },
    {
      key: "sign-out",
      icon: <LogoutOutlined />,
      label: "Sign Out",
      danger: true,
      onClick: () => signOut({ callbackUrl: "/" }),
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Header */}
      <Header className="d-flex align-items-center px-4 border-bottom" style={{ background: colorBgContainer }}>
        <div className="d-flex align-items-center gap-2" style={{ flex: 1 }}>
          <UserOutlined style={{ fontSize: 20, color: "#0078d4" }} />
          <Text className="fw-bold" style={{ fontSize: 16 }}>
            Tambah Pemohon Baru
          </Text>
        </div>

        <Button
          icon={<ThunderboltOutlined />}
          onClick={handleDemoFill}
          style={{
            background: "linear-gradient(135deg, #722ed1 0%, #9254de 100%)",
            border: "none",
            color: "#fff",
            fontWeight: 500,
          }}
        >
          Demo Auto-Fill
        </Button>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Dropdown menu={{ items: profileMenuItems }} placement="bottomRight">
            <div className="d-flex align-items-center gap-2" style={{ cursor: "pointer" }}>
              <div className="d-none d-md-inline text-end">
                <Text style={{ display: 'block', lineHeight: 1.3 }}>{userName}</Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.3 }}>{userEmail}</Text>
              </div>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#0078d4" }} />
            </div>
          </Dropdown>
        </div>
      </Header>

      <Content style={{ padding: 24, background: "#f0f2f5" }}>

        {/* Steps Indicator */}
        <Card
          style={{ marginBottom: 24, borderRadius: 8 }}
          styles={{ body: { padding: "20px 24px" } }}
        >
          <Steps
            current={currentStep}
            items={steps.map((s, i) => ({
              title: s.title,
              content: s.description,
              icon: (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    ...(i < currentStep
                      ? { backgroundColor: '#1677ff', color: '#fff' }
                      : i === currentStep
                        ? { backgroundColor: '#1677ff', color: '#fff' }
                        : { backgroundColor: '#f0f0f0', color: '#bfbfbf' }),
                  }}
                >
                  {s.icon}
                </div>
              ),
              status:
                i < currentStep ? "finish" : i === currentStep ? "process" : "wait",
            }))}
            responsive
          />
        </Card>

        {/* Form (single instance, never unmounted) */}
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          scrollToFirstError
          size="large"
          onValuesChange={() => {
            // Re-check completeness whenever any field value changes
            checkCurrentStepComplete(currentStep);
          }}
        >
          {/* ── STEP 1: Personal Information ──────────────────────────────── */}
          <div style={{ display: currentStep === 0 ? "block" : "none" }}>
            <Card
              title={
                <span>
                  <UserOutlined style={{ color: "#0078d4", marginRight: 8 }} />
                  <Text strong style={{ fontSize: 16 }}>
                    Maklumat Peribadi / Personal Information
                  </Text>
                </span>
              }
              style={{ borderRadius: 8 }}
            >
              <Row gutter={[24, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="fullName"
                    label="Nama Penuh / Full Name"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan nama penuh",
                      },
                    ]}
                  >
                    <Input
                      placeholder="Nama penuh seperti dalam kad pengenalan"
                      prefix={<UserOutlined style={{ color: "#bfbfbf" }} />}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="icNumber"
                    label="No. Kad Pengenalan / IC Number"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan nombor IC",
                      },
                    ]}
                  >
                    <Input placeholder="XXXXXX-XX-XXXX" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="E-mel / Email"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan e-mel",
                      },
                      {
                        type: "email",
                        message: "Sila masukkan e-mel yang sah",
                      },
                    ]}
                  >
                    <Input type="email" placeholder="contoh@email.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="phone"
                    label="No. Telefon / Phone Number"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan nombor telefon",
                      },
                    ]}
                  >
                    <Input placeholder="01X-XXXX XXXX" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="gender"
                    label="Jantina / Gender"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih jantina",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih jantina">
                      {genderOptions.map((g) => (
                        <Option key={g} value={g}>
                          {g}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="homeState"
                    label="Negeri / Home State"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih negeri",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih negeri" showSearch>
                      {stateOptions.map((s) => (
                        <Option key={s} value={s}>
                          {s}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="disabilityStatus"
                    label="Status OKU / Disability Status"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih status",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih status">
                      {disabilityOptions.map((d) => (
                        <Option key={d} value={d}>
                          {d}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </div>

          {/* ── STEP 2: Academic Information ───────────────────────────────── */}
          <div style={{ display: currentStep === 1 ? "block" : "none" }}>
            <Card
              title={
                <span>
                  <BookOutlined style={{ color: "#0078d4", marginRight: 8 }} />
                  <Text strong style={{ fontSize: 16 }}>
                    Maklumat Akademik / Academic Information
                  </Text>
                </span>
              }
              style={{ borderRadius: 8 }}
            >
              <Row gutter={[24, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="university"
                    label="Universiti / University"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih universiti",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih universiti" showSearch>
                      {universityOptions.map((u) => (
                        <Option key={u} value={u}>
                          {u}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="faculty"
                    label="Fakulti / Faculty"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan fakulti",
                      },
                    ]}
                  >
                    <Input placeholder="e.g. Fakulti Kejuruteraan" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="program"
                    label="Program / Program"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan program",
                      },
                    ]}
                  >
                    <Input placeholder="e.g. Sarjana Muda Kej. Elektrik" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="programLevel"
                    label="Tahap Program / Program Level"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih tahap program",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih tahap">
                      {programLevelOptions.map((p) => (
                        <Option key={p} value={p}>
                          {p}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="fieldOfStudy"
                    label="Bidang Pengajian / Field of Study"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih bidang pengajian",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih bidang" showSearch>
                      {fieldOfStudyOptions.map((f) => (
                        <Option key={f} value={f}>
                          {f}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="currentSemester"
                    label="Semester Semasa / Current Semester"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan semester semasa",
                      },
                    ]}
                  >
                    <InputNumber
                      min={1}
                      max={14}
                      placeholder="1 - 14"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="cgpa"
                    label="CGPA"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan CGPA",
                      },
                    ]}
                  >
                    <InputNumber
                      min={0}
                      max={4.0}
                      step={0.01}
                      placeholder="0.00 - 4.00"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </div>

          {/* ── STEP 3: Financial Information ──────────────────────────────── */}
          <div style={{ display: currentStep === 2 ? "block" : "none" }}>
            <Card
              title={
                <span>
                  <BankOutlined style={{ color: "#0078d4", marginRight: 8 }} />
                  <Text strong style={{ fontSize: 16 }}>
                    Maklumat Kewangan / Financial Information
                  </Text>
                </span>
              }
              style={{ borderRadius: 8 }}
            >
              <Row gutter={[24, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="parentName"
                    label="Nama Ibu/Bapa/Penjaga / Parent/Guardian Name"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan nama penjaga",
                      },
                    ]}
                  >
                    <Input placeholder="Nama penuh ibu/bapa/penjaga" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="parentIc"
                    label="No. IC Ibu/Bapa/Penjaga / Parent/Guardian IC"
                    rules={[
                      {
                        required: true,
                        message: "Sila masukkan nombor IC penjaga",
                      },
                    ]}
                  >
                    <Input placeholder="XXXXXX-XX-XXXX" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="incomeRange"
                    label="Julat Pendapatan Isi Rumah / Household Income Range"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih julat pendapatan",
                      },
                    ]}
                  >
                    <Select placeholder="Pilih julat pendapatan">
                      {incomeRangeOptions.map((i) => (
                        <Option key={i} value={i}>
                          {i}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    name="payslip"
                    label="Muat Naik Slip Gaji / Upload Payslip"
                    rules={[
                      {
                        required: true,
                        message: "Sila muat naik slip gaji (PDF)",
                      },
                    ]}
                    valuePropName="fileList"
                    getValueFromEvent={(e) => {
                      if (Array.isArray(e)) return e;
                      return e?.fileList;
                    }}
                  >
                    <Upload.Dragger {...uploadProps}>
                      <p className="ant-upload-drag-icon">
                        <FilePdfOutlined style={{ color: "#0078d4", fontSize: 40 }} />
                      </p>
                      <p className="ant-upload-text">
                        Klik atau seret fail PDF ke sini
                      </p>
                      <p className="ant-upload-hint">
                        Click or drag PDF file to this area to upload
                      </p>
                    </Upload.Dragger>
                  </Form.Item>
                  <Alert
                    type="info"
                    showIcon
                    icon={<InfoCircleOutlined />}
                    title="Pengesahan AI / AI Verification"
                    description="Slip gaji akan disahkan menggunakan AI (Content Understanding) untuk pengesahan pendapatan automatik sebelum ke Langkah 4."
                    style={{ marginTop: -8, marginBottom: 16, borderRadius: 6 }}
                  />
                </Col>
              </Row>
            </Card>
          </div>

          {/* ── STEP 4: Scholarship Selection & Verification ───────────────── */}
          <div style={{ display: currentStep === 3 ? "block" : "none" }}>
            <Card
              title={
                <span>
                  <SafetyCertificateOutlined
                    style={{ color: "#0078d4", marginRight: 8 }}
                  />
                  <Text strong style={{ fontSize: 16 }}>
                    Pilihan Biasiswa & Pengesahan / Scholarship Selection &
                    Verification
                  </Text>
                </span>
              }
              style={{ borderRadius: 8 }}
            >
              <Row gutter={[24, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="scholarshipApplied"
                    label="Biasiswa Dipohon / Scholarship Applied"
                    rules={[
                      {
                        required: true,
                        message: "Sila pilih biasiswa",
                      },
                    ]}
                  >
                    <Select
                      placeholder="Pilih biasiswa"
                      onChange={(val: string) => setSelectedScholarship(val)}
                    >
                      {scholarshipOptions.map((s) => (
                        <Option key={s} value={s}>
                          {s}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {/* Verification result summary (shown in Step 4 if verification was done) */}
              {verificationResult && (
                <Card
                  size="small"
                  style={{
                    borderLeft: `4px solid ${verificationResult.status === "match"
                      ? "#52c41a"
                      : verificationResult.status === "flagged"
                        ? "#faad14"
                        : "#1890ff"
                      }`,
                    borderRadius: 6,
                    marginBottom: 16,
                    background: "#fafafa",
                  }}
                >
                  <Title
                    level={5}
                    style={{
                      color:
                        verificationResult.status === "match"
                          ? "#52c41a"
                          : verificationResult.status === "flagged"
                            ? "#faad14"
                            : "#1890ff",
                      marginBottom: 12,
                    }}
                  >
                    {verificationResult.status === "match" ? (
                      <><CheckCircleOutlined style={{ marginRight: 8 }} />Pengesahan Slip Gaji Berjaya / Payslip Verified</>
                    ) : verificationResult.status === "flagged" ? (
                      <><ExclamationCircleOutlined style={{ marginRight: 8 }} />Percanggahan Pendapatan (Diteruskan) / Income Discrepancy (Proceeded)</>
                    ) : (
                      <><InfoCircleOutlined style={{ marginRight: 8 }} />Pengesahan Manual Diperlukan / Manual Verification Required</>
                    )}
                  </Title>
                  {verificationResult.extractedData && (
                    <Row gutter={[16, 8]}>
                      <Col xs={24} sm={6}>
                        <Text type="secondary">Nama Penjaga:</Text>
                        <br />
                        <Text strong>{verificationResult.extractedData.parent_name}</Text>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Text type="secondary">Nama Majikan:</Text>
                        <br />
                        <Text strong>{verificationResult.extractedData.employer_name}</Text>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Text type="secondary">Gaji Kasar:</Text>
                        <br />
                        <Text strong>RM {verificationResult.extractedData.gross_salary.toLocaleString()}</Text>
                      </Col>
                      <Col xs={24} sm={6}>
                        <Text type="secondary">Gaji Bersih:</Text>
                        <br />
                        <Text strong>RM {verificationResult.extractedData.net_salary.toLocaleString()}</Text>
                      </Col>
                    </Row>
                  )}
                  {verificationResult.status === "skipped" && (
                    <Alert
                      type="info"
                      title="Pengesahan automatik tidak tersedia. Permohonan akan disemak secara manual."
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                  {verificationResult.status === "flagged" && verificationResult.declaredRange && (
                    <Alert
                      type="warning"
                      title={`Julat diisytiharkan: ${verificationResult.declaredRange} — Gaji diekstrak: RM ${verificationResult.extractedData?.gross_salary.toLocaleString()}`}
                      style={{ marginTop: 8 }}
                      showIcon
                    />
                  )}
                </Card>
              )}

              {/* Dynamic scholarship info card */}
              {selectedScholarship && scholarshipInfo[selectedScholarship] && (
                <Card
                  size="small"
                  style={{
                    borderLeft: `4px solid ${scholarshipInfo[selectedScholarship].color}`,
                    borderRadius: 6,
                    marginBottom: 16,
                    background: "#fafafa",
                  }}
                >
                  <Title
                    level={5}
                    style={{
                      color: scholarshipInfo[selectedScholarship].color,
                      marginBottom: 12,
                    }}
                  >
                    <InfoCircleOutlined style={{ marginRight: 8 }} />
                    Syarat Kelayakan / Eligibility Criteria
                  </Title>
                  <Row gutter={[16, 8]}>
                    <Col xs={24} sm={8}>
                      <Text type="secondary">CGPA Minimum:</Text>
                      <br />
                      <Text strong>
                        {scholarshipInfo[selectedScholarship].minCGPA}
                      </Text>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Text type="secondary">Pendapatan Maksimum:</Text>
                      <br />
                      <Text strong>
                        {scholarshipInfo[selectedScholarship].maxIncome}
                      </Text>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Text type="secondary">Syarat Tambahan:</Text>
                      <br />
                      <Text strong>
                        {scholarshipInfo[selectedScholarship].extra}
                      </Text>
                    </Col>
                  </Row>
                </Card>
              )}
            </Card>
          </div>
        </Form>

        {/* ── Navigation Buttons ──────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            {currentStep > 0 && (
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handlePrev}
                size="large"
              >
                Kembali / Back
              </Button>
            )}
          </div>
          <Space>
            {currentStep === steps.length - 1 ? (
              <>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                  size="large"
                >
                  Set Semula / Reset
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSubmit}
                  loading={submitting}
                  size="large"
                  style={{
                    background: "linear-gradient(135deg, #0078d4 0%, #005a9e 100%)",
                    border: "none",
                  }}
                >
                  Hantar Permohonan / Submit Application
                </Button>
              </>
            ) : (
              <Button
                type="primary"
                onClick={handleNext}
                loading={verifying}
                disabled={!isStepComplete}
                size="large"
                style={{
                  background: isStepComplete
                    ? "linear-gradient(135deg, #0078d4 0%, #005a9e 100%)"
                    : undefined,
                  border: "none",
                }}
              >
                {currentStep === 2 && verifying
                  ? "Mengesahkan Slip Gaji... / Verifying Payslip..."
                  : "Seterusnya / Next"}
                {!verifying && <ArrowRightOutlined />}
              </Button>
            )}
          </Space>
        </div>
      </Content>
    </Layout>
  );
}
