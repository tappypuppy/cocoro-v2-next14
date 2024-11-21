"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Container, TextField, Button, Typography, Box } from '@mui/material';

function Home() {
  const nameRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userName = nameRef.current?.value;
    router.push(`/dev/${userName}`);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          名前を入力してください
        </Typography>
        <form onSubmit={onSubmit}>
          <TextField
            fullWidth
            label="Name"
            variant="outlined"
            inputRef={nameRef}
            margin="normal"
          />
          <Button type="submit" variant="contained" color="primary">
            Send
          </Button>
        </form>
      </Box>
    </Container>
  );
}

export default Home;