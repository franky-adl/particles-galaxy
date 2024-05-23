#pragma glslify: cnoise = require('./noise.glsl')
#pragma glslify: rotateY = require('./helpers.glsl')

uniform float u_time;
uniform float u_speed;
uniform bool u_dyn_trail;
uniform float uSizeBase;
uniform float uSizeMult;
uniform vec3 uCamPos;
uniform vec3 uMouse;
attribute vec3 pos;
attribute vec3 col;
varying vec2 vUv;
varying float radius;
varying vec3 color;

void main() {
    vUv = position.xy + vec2(0.5);
    color = col;
    radius = length(pos);

    float particleSize = cnoise(pos*10.) * uSizeMult + uSizeBase;
    vec3 particle_pos = pos;
    if (u_dyn_trail) {
        // add a bit of small circular motions for the stars
        particle_pos = vec3(particle_pos.x + sin(u_time * particleSize)*0.1, particle_pos.y, particle_pos.z + cos(u_time * particleSize)*0.1);
    }
    vec3 world_pos = (modelMatrix * vec4(particle_pos, 1.)).xyz;

    vec4 view_pos = viewMatrix * vec4(world_pos, 1.);
    // 1.
    // adding "position" to view_pos is to make the instance vertexes take up the instance blueprint's shape
    // without this addition, all vertexes of each instance will only end up at the same 3D spot
    // thus triangles of zero area would be drawn, effectively nothing is drawn
    // 2.
    // we add position after the modelView matrices transformations so that
    // the particles will always look at the camera
    // 3.
    // we increase the particle size a bit if the camera zooms out so as to create a more star-clusterly look
    // instead of all stars getting too dimmed out
    view_pos.xyz += position * (particleSize + length(uCamPos)/1000.);
    gl_Position = projectionMatrix * view_pos;
}