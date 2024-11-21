'use client';
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient';

function Gradients() {
  return (
    <>
      <ShaderGradientCanvas
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
        }}
      >
        <ShaderGradient
          control="query"
          urlString="https://www.shadergradient.co/customize?animate=on&axesHelper=on&bgColor1=%23000000&bgColor2=%23000000&brightness=1.2&cAzimuthAngle=0&cDistance=3.7&cPolarAngle=95&cameraZoom=1&color1=%23fedc3d&color2=%23F8FEDC&color3=%23f2c92f&destination=onCanvas&embedMode=off&envPreset=dawn&format=gif&fov=50&frameRate=10&grain=off&lightType=3d&pixelDensity=1.6&positionX=0&positionY=-0.8&positionZ=0&range=enabled&rangeEnd=40&rangeStart=0&reflection=0.1&rotationX=0&rotationY=0&rotationZ=225&shader=defaults&type=waterPlane&uAmplitude=0&uDensity=1.9&uFrequency=5.5&uSpeed=0.1&uStrength=2.3&uTime=0.2&wireframe=false"
        />
      </ShaderGradientCanvas>
    </>
  );
}

export default Gradients;
