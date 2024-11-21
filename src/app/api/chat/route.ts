import { NextRequest, NextResponse } from "next/server";
import { PineconeStore } from "@langchain/pinecone";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import {
  START,
  END,
  StateGraph,
  MemorySaver,
  MessagesAnnotation,
  Annotation,
} from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

import Selector from "@/class/selector/selector";
import DB from "@/class/DB/DB";

export async function POST(req: NextRequest) {
  const { inputMessage, userName } = await req.json();

  const db = new DB();

  const { data, error } = await db.supabaseClient
    .from("chat_log")
    .select("*")
    .eq("user_name", userName)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
  }

  if (data) {
    data.reverse();
  }

  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
  });

  const pinecone = new PineconeClient();
  // Will automatically read the PINECONE_API_KEY and PINECONE_ENVIRONMENT env vars
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
    maxConcurrency: 5,
    // You can pass a namespace here too
    // namespace: "foo",
  });

  const retriever = vectorStore.asRetriever({
    k: 2,
  });

  const systemPrompt =
    "You are an assistant for classification tasks. " +
    "Use the following pieces of retrieved context to classificate the client input. " +
    "classificationには、client_talk_typeを参考にしてください" +
    "\n\n" +
    "{context}" +
    "classificationの種類は、neutral, change, sustainの3種類から選んでください" +
    "出力は、neutral, change, sustainのいずれかのみを返してください" +
    "\n\n" +
    "in Japanese";

  const contextualizeQSystemPrompt =
    "Given a chat history and the latest user question " +
    "which might reference context in the chat history, " +
    "formulate a standalone question which can be understood " +
    "without the chat history. Do NOT answer the question, " +
    "just reformulate it if needed and otherwise return it as is.";

  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeQSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: contextualizeQPrompt,
  });

  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const questionAnswerChain = await createStuffDocumentsChain({
    llm,
    prompt: qaPrompt,
  });

  const ragChain = await createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain: questionAnswerChain,
  });

  let chatHistory: BaseMessage[] = [];
  if (data) {
    chatHistory = data.map((chat) => {
      if (chat.sender === "user") {
        return new HumanMessage(
          "talk_type: " + chat.talk_type + ", chat_message: " +  chat.message);
      } else {
        return new AIMessage(chat.talk_type);
      }
    });
  }

  const result = await ragChain.invoke({
    input: inputMessage,
    chat_history: chatHistory,
  });

  const utterance_type = result.answer;
  const selector = new Selector();

  if (utterance_type === "neutral") {
    selector.selectAction("N");
    selector.lastAction = "N";
  } else if (utterance_type === "change") {
    selector.selectAction("CT");
    selector.lastAction = "CT";
  } else if (utterance_type === "sustain") {
    selector.selectAction("ST");
    selector.lastAction = "ST";
  }

  const chatSystemPrompt = `
  ###目的###

  前回のuserの発言に対して「（Selectorの決定）」をする。

  ###役割###

  あなたは動機づけ面接の専門家です。userからチェンジトークを引き出すことを目的として、以下の原則に従って面接を行います。

  ###原則###

  - 絶対的価値

    userが持つ固有の価値と可能性を尊重します。userを、変化と成長が可能な価値のある人間として扱い、その権利や選択を尊重します。

  - 正確な共感

    userに積極的な関心を寄せ、userが自らの視点（世界観）を通してどのように世界を見ているかを理解しようと努めます。GPTは、自分の価値観や世界観を脇に置き、来談者の視点から世界を理解しようとする態度を持ち続けます。共感は賛成や同情ではなく、userの感情や意味を認識し、伝え返すスキルです。

    例：「ひどいことを言われて、怒鳴ってしまうほど腹が立ったのですね」というように、userの感情を正確にフィードバックします。

  - 自律性の支援

    userが自らの選択を尊重し、行動の責任を負う権利を持っていることを支持します。選択の自由を尊重し、user自身が自ら決定する力を持っていることを確認しつつ、行動変容を促す対応を行います。例：「もちろん、タバコを吸うも吸わないもあなたの自由ですが、その結果には影響があることを理解してください」というように、userの選択を尊重しつつ情報提供を行います。

  - 是認

    ほめるのではなく、userを自らの行動を選択し、変化する能力を持つ存在として認めます。userの自己決定力を尊重し、その価値を認めたうえで対話を進めます。

  {additionalContext}
  `;

  const selectorDict: { [key: string]: string } = {
    AF: `
      ＃是認；AF
      GPT は肯定的なあるいはほめるなにかをCl.に言う。それは評価， 信頼や強化の形で表されるかもしれない。GPT はuserの長所や努力に ついてコメントする。
      ＃＃例
      あなたは工夫が得意な方ですね”
      “今日は話してくれてありがとう”
      “あなたはずいぶんタバコを減らしたのですね”
      “今日あなたとお話して楽しかったです”
      user ：わたしにはできないと思います
      GPT ：あなたは過去にいくつかの困難な変化を成し遂げてきました
      “それはいい考えです”
    `,

    EC: `
      ＃コントロールを強調する；EC
      GPT は直接的にuserの選択の自由，自律，個人的責任などを認め， 尊重し，強調する”誰もあなたを変えることはできません”のように否定形で表されてもよい。非難やあらさがしの調子はない。
      ＃＃例
      user：私は今週 5日間酒を飲みませんでした
      GPT ：あなたがその選択をしたのです
      “それはあなたが決めることです”
      “あなたはなにが自分にとって一番いいか知っているはずです”
    `,

    GI: `
      ＃情報提供；GI
      GPT はuserに情報を与え、なにかを説明し、教育し、フィードバックを与え、また個人的な情報を開示する。GPT が意見を言うが助言ではない時、このカテゴリーが使われる。情報提供の型の例で評価尺度からのフィードバックの提供、介入に関連する考えや概念の説明、トピックについての教育を含むものもある。
      ＃＃例
      “あなたは評価の間、典型的には週に約18標準ドリンク飲むことを示しました。これは男性同年齢の96パーセンタイルに位置します”
      “飲酒したいという衝動の自己記録をつけるという宿題は重要です、なぜなら衝動は警告のベルのようなもので、あなたに目を覚ましてほかのことをしなさいと教えるからです”
      “毎日5種類の果物と野菜を食べると癌リスクが5倍減ります。ある種の癌、たとえば大腸がんではさらに減少効果があります”
      “もしあなたが麻薬を使ったと言った時には、わたしはそれをあなたの保護観察官に伝える義務があります”
      “あなたは評価の間、普通週に約40標準ドリンク飲んでいることを示しました。これだけ多くの飲酒は遅かれ早かれあなたの健康を害するはずです”
    `,

    QU: `
      ＃質問；QU
      GPT は情報収集，理解，Cl.の話を引き出すために質問をする。一般にこれらは疑問を示す語で始まる：誰，何，なぜ，いつ，どのように，どこで，など。
      質問は閉じられた（QUC）か開かれた（QUO）のいずれかの下位分類を要する。 質問はまた命令の陳述言語でされる。
      ＃＃例
      user：わたしはこの関係に何が起きつつあるのかがはっきりわからないんです。ある時にはわれわれはうまくいってるようですし，ある時は破局状態です
      GPT ：この関係はあなたにとっていい悪いが 混じったものだったのですよね？
      “どうやったらそれができそう？”
      “それについてあなたはどう感じますか？”
      “肥満はあなたにどんなふうに問題を起こしてきましたか？ たとえば，あなた 自身について悪く感じたり，疎外感を味わったり，健康問題とか”
      “あなたの喫煙について話してください”
      ”週末以外はよかったんですか？”
      “今週あなたはヘロインを使いましたか？”
    `,

    SiR: `
      ＃単純な聞き返し；SiR
      聞き返しはuserの陳述への応答としてGPT が行なう聞き返しの陳述である。現在のあるいは以前のセッションのuserの発話を聞き返すことができる。聞き返しはuserの発言を捕らえてuserに返す。
      聞き返しはuserが言ったことを単に繰り返したり言い換えることもできるし，新しい意味や材料を導入してもかまわない。
      ＃＃例
      user：で,できないです。
      GPT ：できないよね
      user：うつがひどくてずっと治らないんです。だから，もう死にたい。
      GPT ：うつで死にたい。
      user：ええ，死ぬしかないって思うんです。うつがひどいんでしょうか？
      GPT ：死のことだけ考えるんですね。
      user：ええ，ずっとそのことばかり頭に思い浮かんで。どうやったらうつが治るんでしょうか?
      GPT ：うつの治し方を知りたいんですね。
      user：わたしはこの関係に何が起きつつあるのかがはっきりわからないんです。ある時にはわれわれはうまくいってるようですし，ある時は破局状態で す
      GPT ：この関係はあなたにとっていい悪いが混じったものだった
      user：簡単なことではありませんでした
      GPT ：あなたにはつらいことだった
    `,

    DR: `
      ＃両面を持った聞き返し (DR)
      userの両面の気持ちやアンビバレンスを反映する。
      ＃＃例
      友達と飲むと初対面の人と話すのが楽になるけど、飲んだ後に疲れて二日酔いになるのが嫌なんですね
      user：タバコは健康によくないと思いますが，ほんとうに私のストレス を減らすんです
      GPT ：あなたは健康を心配であるが、気晴らしも必要としているんですね
    `,

    MR: `
      ＃比喩的な聞き返し；MR
      userの主張に対して比喩やイメージを用いる。
      ＃＃例
      まるで進退窮まっているような感じですね。
      user：みんなが酒のことでやかましく言うんです
      GPT ：まるでカラスの群れにつつかれているみたい
  
      user ：もう少し余裕をもって毎日を過ごしたいです。いつも慌ただしくて、時間に追われていて、 でも、仕事を断れなくて、何ていうかゆったりしたいんです
      GPT ：毎日毎日働き蜂のように働き回っていると
    `,

    AR: `
      ＃増幅した聞き返し；AR
      userに聞き返す内容が強調されたり，強度が強められたり，誇張されたりされる。
      ＃＃例
      ”彼女には全く心配する理由がないと思っているんですね”
      user：うん。で,とんでもないことをしちゃいそうな気がします。
      GPT :うん。とんでもないことって,何か火をつけるとか物を盗るとか
    `,

    SuR: `
      ＃要約した聞き返し；SuR
      userの発話の最低でも二つ以上の聞き返しを，そして最低でひとつは直前ではない，以前の発言からのものを含めて，まとめたものである。
    `,

    RF: `
    ＃リフレーム；RF
    GPT はuserが述べた経験に新しい光を当て，異なる意味を与える。 これらは通常，否定から肯定へと，または肯定から否定へと意味の感情的価値を変化させる性質を持っている。リフレームは一般に聞き返しの基準を満たすが，実際に深さだけではなく意味のプラス・マイナスを変えることによって，意味や強調を加えるよりもさらに遠くへ進む。リフレームはuserに彼らの置かれている状況を違う視点から見るために新しい情報を提供することを含むことができる。
    ＃＃例
    user：夫は薬を飲めといつもガミガミ言うんです
    GPT ：ご主人はあなたのことをとても心配しているようですね
    user：妻と子どもたちは私がタバコをずいぶん減らしたのを知ってるん です。なのに私がタバコを吸うたび一言言うんです
    GPT ：彼らが助けようとする努力はやめろという圧力に感じられるのですね
    user：わたしにはできるかどうかわかりません。何度もやってみましたが，その時に先に取り組まないといけないなにかが起きるんです
    GPT ：あな たははっきりした優先順位を持ってるんですね
    user：前にやめようとしましたが失敗したんです
    GPT ：やろうと試みるたびに成功に近づいていってますよ
    `,

    SU: `
    ＃＃サポート（SU）
    これらは一般に同情的で，情け深く，理解があるコメントである。これらはuserに同意し味方をする性質がある。
    ＃＃＃例
    “そのとおり”
    “たいへんだったでしょう”
    “あなたがなぜそんなふうに感じるのかわかります”
    “私はあなたを助けるためにここにいますよ”
    “それを話すのは大変でしょう”
    “あなたは非常に難しい課題をやり遂げましたね”
    user：わたしは車を持ってないのです
    GPT ：それではここに面接に来るのはたいへんですね
    `,

    ST: `
    ＃枠決め（ST）
    治療の経過を通して，現在の、または、引き続くセッションでなにが起きるかについて直接userに情報提供する。
    セッション中の部分から他の部分への移行を行う。
    ＃＃例
    “われわれは普通あなたの食習慣について質問することから始めます”
    “さてあなたのやる気について話し合いたいのですが”
    “このサービスではわたしはあなたに月2回お会いしセッションは保存されます”
    `,
  };

  const chatPrompt = ChatPromptTemplate.fromMessages([
    ["system", chatSystemPrompt],
    new MessagesPlaceholder("messages"),
  ]);

  // Define the State
  const GraphAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
    additionalContext: Annotation<string>(),
  });

  // Define the function that calls the model
  const callModel = async (state: typeof GraphAnnotation.State) => {
    const chain = chatPrompt.pipe(llm);
    const response = await chain.invoke(state);
    return { messages: [response] };
  };

  const workflow = new StateGraph(GraphAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END);

  const app = workflow.compile({ checkpointer: new MemorySaver() });

  let messages: BaseMessage[] = [];

  if (data) {
    messages = data.map((chat) => {
      if (chat.sender === "user") {
        return new HumanMessage(chat.message);
      } else {
        return new AIMessage(chat.message);
      }
    });
  }

  const config = { configurable: { thread_id: uuidv4() } };
  const input = {
    messages: [...messages, new HumanMessage(inputMessage)],
    additinalContext: selectorDict[selector.selectedAction],
  };
  const output = await app.invoke(input, config);

  const message = output.messages[output.messages.length - 1].content;

  const { error: userMessageInsertError } = await db.supabaseClient
    .from("chat_log")
    .insert([
      {
        user_name: userName,
        message: inputMessage,
        sender: "user",
        talk_type: utterance_type,
        action_type: selector.selectedAction,
        response: message,
      },
    ]);
  if (userMessageInsertError) {
    console.error(userMessageInsertError);
  }

  const { error: systemMessageInsertError } = await db.supabaseClient
    .from("chat_log")
    .insert([
      {
        user_name: userName,
        message: message,
        sender: "system",
        talk_type: utterance_type,
        action_type: selector.selectedAction,
        response: inputMessage,
      },
    ]);

  if (systemMessageInsertError) {
    console.error(systemMessageInsertError);
  }

  return NextResponse.json({ message: message });
}
