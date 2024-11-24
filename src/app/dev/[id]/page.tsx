"use client";
import { useState } from "react";
import { Button, Container, Box } from "@mui/material";
import AudioCircle from "@/components/audioUI/audioUI";
import Gradients from "@/components/shadergradient/gradient";

const Recorder = ({ params }: { params: { id: number } }) => {
  const userName = params.id;

  // recordingの状態を管理
  const [recording, setRecording] = useState<boolean>(false);

  // MediaRecorderの状態を管理
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );

  // 録音データを保存する状態を管理
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // 録音開始処理
  const startRecording = async () => {
    // マイクの使用許可を取得
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // MediaRecorderの設定
    const mediaRecorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    // 録音データの取得
    mediaRecorder.addEventListener("dataavailable", (e: BlobEvent) => {
      chunks.push(e.data);
    });

    // 録音停止時の処理
    mediaRecorder.addEventListener("stop", async () => {
      // 録音データをBlob形式に変換
      const audioBlob = new Blob(chunks, { type: "audio/mp3" });

      // 録音データをURL形式に変換して保存
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);

      // 録音データをFormData形式に変換
      const formData = new FormData();
      formData.append("audio", audioBlob);

      // 録音データをサーバーに送信
      const response = await fetch("/api/openai/stt", {
        method: "POST",
        body: formData,
      });

      const sttData = await response.json();

      // テキストをchatAIに送信
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputMessage: sttData.output, userName }),
      });

      const data = await res.json();

      // chatAIの返答を音声に変換

      const ttsRes = await fetch("/api/openai/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ textMessage: data.message }),
      });

      const ttsData = await ttsRes.json();
      console.log(ttsData);
      const audio = new Audio(ttsData.audioURL);
      audio.play();
    });

    // 録音開始
    mediaRecorder.start();
    setMediaRecorder(mediaRecorder);
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // 録音データを再生する処理
  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  return (
    <>
      <Container>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          height="100vh"
        >
          <AudioCircle isPlaying={recording} />
          {!recording ? (
            <Button
              variant="contained"
              color="primary"
              onClick={startRecording}
              sx={{ mt: 2 }}
            >
              音声を送る
            </Button>
          ) : (
            <Button
              variant="contained"
              color="secondary"
              onClick={stopRecording}
              sx={{ mt: 2 }}
            >
              録音停止
            </Button>
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={playRecording}
            sx={{ mt: 2 }}
          >
            再生
          </Button>
        </Box>

        <Gradients />
      </Container>
    </>
  );
};

export default Recorder;
