"use client";
import React from "react";
import styles from "./index.module.css";
// import Gradient from "../shadergradient/gradient";
import CircleGradients from "../shadergradient/circleGradient";

interface AudioCircleProps {
  isPlaying: boolean;
}

const AudioCircle: React.FC<AudioCircleProps> = ({ isPlaying }) => {
  return (
    <div className={styles.audioCircle}>
      <div className={`${styles.circle} ${isPlaying ? styles.playing : ""}`}>
        <CircleGradients />
      </div>
    </div>
  );
};

export default AudioCircle;
