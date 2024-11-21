import AI from "@/class/AI/AI";

export async function POST(req: Request) {
  const { textMessage } = await req.json();

  if (typeof textMessage !== "string") {
    return new Response(
      JSON.stringify({ error: "textPrompt must be a string" }),
      { status: 400 }
    );
  }

  const ai = new AI();
  const audioURL = await ai.textToSpeech(textMessage);

  console.log("audioBlob:", audioURL);

  return new Response(JSON.stringify({ audioURL }), { status: 200 });
}
