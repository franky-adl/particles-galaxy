#ifdef GL_ES
precision mediump float;
#endif

#define PI 3.14159265359
#define TWO_PI 6.28318530718

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_Texture;
uniform float uOpacity;
varying vec3 color;
varying vec2 vUv;
varying float radius;

void main() {
    vec4 ttt = texture2D(u_Texture, vUv);
    // brighter at center, max radius should follow what's defined in index.js
    float oF = smoothstep(0., 0.7, 2.8-radius);
    gl_FragColor = vec4(color, ttt.a * uOpacity);
}