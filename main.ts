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
  const startTime = Date.now();
  const run = await openai.beta.threads.runs.createAndPoll(
    threadId,
    {
      assistant_id: assistantId,
      parallel_tool_calls: true,
    },
    { pollIntervalMs: 500 }
  );
  const endTime = Date.now();
  console.log(`elapsed in run creation and polling ${endTime - startTime}`);
  return run;
};

async function main() {
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
          changingProperties: { propertyKey: string; propertyValue: string }[];
        } = JSON.parse(openAiFunction.function.arguments);
        const deviceChanging = newStateOfDevices.find(
          (device) => Number(device.id) === Number(args.deviceId)
        );
        if (!deviceChanging)
          return {
            tool_call_id: openAiFunction.id,
            output: JSON.stringify({
              message: "error, device not found",
            }),
          };
        for (const changingProperty of args.changingProperties) {
          deviceChanging.deviceProperties[changingProperty.propertyKey] =
            changingProperty.propertyValue;
        }
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
    const threadMessages = await openai.beta.threads.messages.list(thread.id);
    for (const message of threadMessages.data) {
      console.log(message.content);
    }
    debugger;
  } else {
    console.log(run.status);
  }
}

export async function main2() {
  //const threadId = "thread_Ms5HglSVX3bc2ccMZC2nEY6m";
  //const newMessage = await openai.beta.threads.messages.create(threadId, {
  //  role: "user",
  //  content: "Also I'd like to change the color to red for my smartbulb",
  //  //"Thanks for that!, can you change the mode to COOL and also turn off all my smartplugs ?",
  //});
  const threadMessages = await openai.beta.threads.messages.list(
    "thread_xX3PwM3ES1dldtiqHy9wxTTP"
  );
  for (const message of threadMessages.data) {
    console.log(message.content);
  }
  debugger;
}

export default main;
