"use client";

import { useState, useRef, use } from "react";
import * as React from 'react'

function Home(props: { params: Promise<{ id: number }> }) {
  const params = use(props.params);
  const [message, setMessage] = useState("");
  const textRef = useRef<HTMLInputElement>(null);
  const userName = params.id;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inputMessage = textRef.current?.value;
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputMessage, userName }),
    });
    const data = await res.json();
    setMessage(data.message);
  };

  return (
    <div>
      <h1>Home</h1>
      <p>{message}</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="message">Message</label>
        <input type="text" id="message" ref={textRef} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default Home;
