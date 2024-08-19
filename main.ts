import OpenAI from "openai";
import initialState from "./intial-state.json";

type Thread = OpenAI.Beta.Threads.Thread;
type Assistant = OpenAI.Beta.Assistants.Assistant;
type ToolOutput =
  OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput;
const openai = new OpenAI();

const getAssistant = async (): Promise<Assistant> => {
  const assistantId = process.env.ASSISTANT_ID;
  if (!assistantId) throw new Error("Assistant not defined");
  const myAssistant = await openai.beta.assistants.retrieve(assistantId);
  return myAssistant;
};
const createThread = async (): Promise<Thread> => {
  const thread = await openai.beta.threads.create({
    messages: [
      {
        role: "assistant",
        content: `The initial state of the devices is: ${JSON.stringify(initialState)}`,
      },
    ],
  });
  return thread;
};

const createRun = async (assistantId: string, threadId: string) => {
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: assistantId,
  });
  return run;
};

async function main2() {
  const myAssistant = await getAssistant();
  const thread = await createThread();
  const threadMessages = await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: "Its so hot outside, change my thermostat to 4 degrees",
  });
  let newStateOfDevices = structuredClone(initialState);
  const run = await createRun(myAssistant.id, thread.id);
  if (run.status === "completed") {
    console.log("all up to date!");
  } else if (run.status === "requires_action") {
    const functions = run.required_action?.submit_tool_outputs.tool_calls;
    const mappedFunctions = functions?.map<ToolOutput>((openAiFunction) => {
      if (openAiFunction.function.name === "update_device") {
        const args: {
          deviceId: string;
          changingProperty: { propertyKey: string; propertyValue: string };
        } = JSON.parse(openAiFunction.function.arguments);
        const deviceChanging = newStateOfDevices.find(
          (device) => Number(device.id) === Number(args.deviceId)
        );
        deviceChanging!.deviceProperties[args.changingProperty.propertyKey] =
          args.changingProperty.propertyValue;
        return {
          tool_call_id: openAiFunction.id,
          output: JSON.stringify({
            message: "success",
            device: deviceChanging,
          }),
        };
      }
      if (openAiFunction.function.name === "get_device_status") {
        const args: { deviceId: string } = JSON.parse(
          openAiFunction.function.arguments
        );
        return {
          tool_call_id: openAiFunction.id,
          output: JSON.stringify({
            message: "success",
            device: newStateOfDevices.find(
              (device) => Number(device.id) === Number(args.deviceId)
            ),
          }),
        };
      } else {
        return {
          tool_call_id: openAiFunction.id,
          output: "ERROR, FUNCTION NOT FOUND",
        };
      }
    });
    if (!mappedFunctions) return;
    const submitOutput = await openai.beta.threads.runs.submitToolOutputs(
      thread.id,
      run.id,
      {
        tool_outputs: mappedFunctions,
      }
    );
    console.log(submitOutput);
  } else {
    console.log(run.status);
  }
}

async function main() {
  const threadMessages = await openai.beta.threads.messages.list(
    "thread_Ms5HglSVX3bc2ccMZC2nEY6m"
  );

  const run = await openai.beta.threads.runs.retrieve(
    "thread_Ms5HglSVX3bc2ccMZC2nEY6m",
    "run_6ojhu9dPv3q7N1LSLC2vu615"
  );
  console.log(run);
}

export default main;
