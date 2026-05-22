import os
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import ResponseStreamEventType

endpoint = "https://demo-scholarshipManagement-foundry.services.ai.azure.com/api/projects/demo-scholarshipManagement-foundryProject"

project_client = AIProjectClient(
    endpoint=endpoint,
    credential=DefaultAzureCredential(),
)

with project_client:
    workflow = {
        "name": "test-workflow-hidden", # Ensure this matches your published YAML name
        "version": "1",
    }
    
    openai_client = project_client.get_openai_client()

    # 1. Initialize the conversation ONCE
    conversation = openai_client.conversations.create()
    print(f"--- Session Started (ID: {conversation.id}) ---")
    print("Type 'exit' or 'quit' to end the chat.\n")

    # 2. Start the continuous chat loop
    while True:
        # Capture dynamic user input
        user_input = input("You: ")
        
        # 3. Set up the exit condition
        if user_input.strip().lower() in ['exit', 'quit']:
            break
            
        print("Pembantu Biasiswa: ", end="", flush=True)

        # 4. Send the input to the workflow
        stream = openai_client.responses.create(
            conversation=conversation.id,
            extra_body={"agent_reference": {"name": workflow["name"], "type": "agent_reference"}},
            input=user_input,
            stream=True,
            # metadata={"x-ms-debug-mode-enabled": "1"}, # Uncomment to enable backend tracing
        )

        # 5. Process and format the stream
        for event in stream:
            # We specifically look for TEXT_DELTA to print tokens as they arrive seamlessly
            if event.type == ResponseStreamEventType.RESPONSE_OUTPUT_TEXT_DELTA:
                print(event.delta, end="", flush=True)
            
            # NOTE: I have commented out the debug prints below so your terminal 
            # looks like a clean chat. Uncomment them if you want to see the 
            # router and specialist agents firing in the background.
            
            # elif event.type == ResponseStreamEventType.RESPONSE_OUTPUT_ITEM_ADDED and event.item.type == "workflow_action":
            #     print(f"\n[Trace: Started {event.item.action_id}]", end="")
            # elif event.type == ResponseStreamEventType.RESPONSE_OUTPUT_ITEM_DONE and event.item.type == "workflow_action":
            #     print(f"\n[Trace: Finished {event.item.action_id}]", end="")

        print("\n") # Add a blank line after the agent finishes its full response

    # 6. Clean up the conversation only after exiting the loop
    print("\n--- Cleaning up ---")
    openai_client.conversations.delete(conversation_id=conversation.id)
    print("Conversation deleted. Session ended.")