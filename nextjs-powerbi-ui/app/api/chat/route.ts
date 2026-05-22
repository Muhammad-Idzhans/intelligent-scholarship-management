import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";
import { AIProjectClient } from "@azure/ai-projects";

// Keywords that indicate internal routing — not meant for end user
const FILTER_KEYWORDS = [
    "please respond",
    "please skip",
    "skip this turn",
    "fabric-data-agent,",
    "scholarship-policies-agent,",
    "fabric-data-agent:",
    "scholarship-policies-agent:",
    "skipped",
    "not relevant to my scope",
];

function cleanResponse(rawText: string): string {
    // Remove all workflow tags
    let cleaned = rawText
        .replace(/\[COMPLETE\]/g, "")
        .replace(/\[ROUTE_DATA\]/g, "")
        .replace(/\[ROUTE_POLICY\]/g, "")
        .replace(/\[ROUTE_BOTH\]/g, "")
        .trim();

    // Remove lines that contain internal routing instructions
    const lines = cleaned.split("\n");
    const cleanedLines = lines.filter(line => {
        const lower = line.trim().toLowerCase();
        return !FILTER_KEYWORDS.some(keyword => lower.includes(keyword));
    });

    // Remove leading/trailing empty lines
    return cleanedLines.join("\n").trim();
}

export async function POST(req: Request) {
    try {
        // 1. Receive the message from the frontend
        const body = await req.json();
        const { message, conversationId } = body;
        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // 2. Set up the AI Foundry Project connection
        const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT!;
        const useWorkflow = process.env.USE_WORKFLOW_AGENT === "true";

        // Pick the right agent name and version based on toggle
        const agentName = useWorkflow
            ? process.env.WORKFLOW_NAME!
            : process.env.AGENT_NAME!;
        const agentVersion = useWorkflow
            ? process.env.WORKFLOW_VERSION || "1"
            : process.env.AGENT_VERSION || "1";

        // Create the AI Project client
        const projectClient = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());
        const openAIClient = projectClient.getOpenAIClient();

        // 3. THREAD MANAGEMENT
        let currentConversationId = conversationId;

        if (!currentConversationId) {
            // No Thread ID exists? Create a brand new Thread with the user's message
            const newConversation = await openAIClient.conversations.create({
                items: [{ type: "message", role: "user", content: [{ type: "input_text", text: message }] }]
            });
            currentConversationId = newConversation.id;
        } else {
            // Thread ID already exists? Add this message to it
            await openAIClient.conversations.items.create(currentConversationId, {
                items: [{ type: "message", role: "user", content: [{ type: "input_text", text: message }] }]
            });
        }

        // 4. Ask the agent (workflow or single) to generate a response
        const response = await openAIClient.responses.create(
            {
                conversation: currentConversationId,
            },
            {
                body: {
                    agent_reference: {
                        name: agentName,
                        version: agentVersion,
                        type: "agent_reference"
                    }
                },
            },
        );

        // 5. Clean up the response (remove workflow artifacts if any)
        let replyText = response.output_text || "Sorry, I couldn't process your request.";

        if (useWorkflow) {
            replyText = cleanResponse(replyText);
        }

        // 6. Return the Agent's answer AND the Thread ID back to the frontend
        return NextResponse.json({
            reply: replyText,
            conversationId: currentConversationId
        });

    } catch (error: unknown) {
        console.error("Error communicating with Foundry Agent:", error);

        const err = error as Error & { code?: string; status?: number; message?: string };
        let userMessage = "Sorry, I'm unable to respond right now. Please try again later.";

        if (err.code === "PermissionDenied" || err.status === 401) {
            userMessage = "I don't have permission to access the data service. Please contact your administrator.";
        } else if (err.code === "tool_user_error" || err.message?.includes("Create assistant failed")) {
            userMessage = "I was unable to retrieve data from Fabric. The data connection may be temporarily unavailable. Please try again shortly.";
        } else if (err.message?.includes("Failed to fetch") || err.message?.includes("ECONNREFUSED")) {
            userMessage = "Unable to reach the AI service. Please check your network connection and try again.";
        }

        return NextResponse.json({ error: userMessage }, { status: 500 });
    }
}