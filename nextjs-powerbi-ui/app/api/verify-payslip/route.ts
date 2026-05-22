import { NextRequest, NextResponse } from "next/server";

// Payslip verification via Azure AI Foundry Content Understanding

async function verifyPayslipMock(): Promise<{
  parent_name: string;
  employer_name: string;
  gross_salary: number;
  net_salary: number;
}> {
  // Simulate API delay (kept as fallback if env vars are missing)
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    parent_name: "Ahmad bin Ibrahim",
    employer_name: "Syarikat ABC Sdn Bhd",
    gross_salary: 3500,
    net_salary: 3150,
  };
}

async function verifyPayslipReal(
  fileBuffer: Buffer,
  fileName: string
): Promise<{
  parent_name: string;
  employer_name: string;
  gross_salary: number;
  net_salary: number;
}> {
  const endpoint = process.env.AZURE_CONTENT_UNDERSTANDING_ENDPOINT;
  const apiKey = process.env.AZURE_CONTENT_UNDERSTANDING_API_KEY;
  const analyzerName = process.env.AZURE_CONTENT_UNDERSTANDING_ANALYZER_NAME;

  if (!endpoint || !apiKey || !analyzerName) {
    throw new Error("Content Understanding environment variables not configured");
  }

  // Normalize endpoint — remove trailing slash
  const baseUrl = endpoint.replace(/\/+$/, "");

  // Use GA API version (2025-11-01) with base64 inline data
  const analyzeUrl = `${baseUrl}/contentunderstanding/analyzers/${analyzerName}:analyze?api-version=2025-11-01`;

  // Encode PDF as base64 for inline submission
  const base64Data = fileBuffer.toString("base64");

  const analyzeResponse = await fetch(analyzeUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [
        {
          data: base64Data,
          mimeType: "application/pdf",
          name: fileName,
        },
      ],
    }),
  });

  if (!analyzeResponse.ok) {
    const errorText = await analyzeResponse.text();
    throw new Error(
      `Content Understanding API error: ${analyzeResponse.status} - ${errorText}`
    );
  }

  // Check for operation-location header (long-running operation)
  const operationLocation = analyzeResponse.headers.get("operation-location");

  if (!operationLocation) {
    // Result returned directly (synchronous)
    const result = await analyzeResponse.json();
    return extractFields(result);
  }

  // Poll for completion (async operation)
  let analysisResult;
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pollResponse = await fetch(operationLocation, {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    });

    const pollResult = await pollResponse.json();

    if (pollResult.status === "succeeded" || pollResult.status === "Succeeded") {
      analysisResult = pollResult;
      break;
    } else if (pollResult.status === "failed" || pollResult.status === "Failed") {
      console.error("Content Understanding analysis failed:", JSON.stringify(pollResult));
      throw new Error("Content Understanding analysis failed");
    }
    // else "running" / "Running" — continue polling
  }

  if (!analysisResult) {
    throw new Error("Content Understanding analysis timed out");
  }

  return extractFields(analysisResult);
}

function extractFields(result: any): {
  parent_name: string;
  employer_name: string;
  gross_salary: number;
  net_salary: number;
} {
  // Extract fields from Content Understanding result
  // Try multiple possible response structures to be robust
  const fields =
    result?.result?.contents?.[0]?.fields ||
    result?.result?.fields ||
    result?.analyzeResult?.documents?.[0]?.fields ||
    result?.analyzeResult?.fields ||
    {};

  // Log the raw result for debugging during integration
  console.log("Content Understanding raw result:", JSON.stringify(result, null, 2));
  console.log("Extracted fields object:", JSON.stringify(fields, null, 2));

  return {
    parent_name:
      fields.parent_name?.valueString ||
      fields.employee_name?.valueString ||
      fields.ParentName?.valueString ||
      fields.EmployeeName?.valueString ||
      "N/A",
    employer_name:
      fields.employer_name?.valueString ||
      fields.company_name?.valueString ||
      fields.EmployerName?.valueString ||
      fields.CompanyName?.valueString ||
      "N/A",
    gross_salary: parseFloat(
      fields.gross_salary?.valueNumber ??
      fields.gross_salary?.valueString ??
      fields.GrossSalary?.valueNumber ??
      fields.GrossSalary?.valueString ??
      "0"
    ),
    net_salary: parseFloat(
      fields.net_salary?.valueNumber ??
      fields.net_salary?.valueString ??
      fields.NetSalary?.valueNumber ??
      fields.NetSalary?.valueString ??
      "0"
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("payslip") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No payslip file provided" },
        { status: 400 }
      );
    }

    // Check if Content Understanding env vars are configured
    const isRealApiReady =
      process.env.AZURE_CONTENT_UNDERSTANDING_ENDPOINT &&
      process.env.AZURE_CONTENT_UNDERSTANDING_API_KEY &&
      process.env.AZURE_CONTENT_UNDERSTANDING_ANALYZER_NAME;

    let extractedData;

    if (isRealApiReady) {
      // Real Azure Content Understanding API call
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      extractedData = await verifyPayslipReal(fileBuffer, file.name);
    } else {
      // Fallback: Mock response
      extractedData = await verifyPayslipMock();
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
    });
  } catch (error: any) {
    console.error("Payslip verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Verification failed",
      },
      { status: 500 }
    );
  }
}
