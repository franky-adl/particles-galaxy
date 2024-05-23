// ThreeJS and Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui'
import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass"

// Core boilerplate code deps
import { createCamera, getDefaultUniforms, createRenderer, runApp } from "./core-utils"
import { loadTexture, gaussianRandom, spiral } from "./common-utils"

import vertex from './shaders/vertex.glsl'
import fragment from './shaders/fragment.glsl'
import mixVertex from './shaders/mixVertex.glsl'
import mixFragment from './shaders/mixFragment.glsl'
import particleTexture from './assets/star.png'
import hazeTexture from './assets/haze.png'

global.THREE = THREE
// previously this feature is .legacyMode = false, see https://www.donmccurdy.com/2020/06/17/color-management-in-threejs/
// turning this on has the benefit of doing certain automatic conversions (for hexadecimal and CSS colors from sRGB to linear-sRGB)
THREE.ColorManagement.enabled = true

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
const params = {
  // bloom params
  bloomStrength: 0.4,
  bloomRadius: 1.0,
  bloomThreshold: 0.5
}
const uniforms = getDefaultUniforms()


/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene()

// selective bloom pass method from https://github.com/mrdoob/three.js/blob/master/examples/webgl_postprocessing_unreal_bloom_selective.html
const BLOOM_SCENE = 1
const bloomLayer = new THREE.Layers()
bloomLayer.set( BLOOM_SCENE )
const BASE_SCENE = 0
const baseLayer = new THREE.Layers()
baseLayer.set( BASE_SCENE )

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  // best practice: ensure output colorspace is in sRGB, see Color Management documentation:
  // https://threejs.org/docs/#manual/en/introduction/Color-management
  _renderer.outputEncoding = THREE.sRGBEncoding
  // _renderer.toneMapping = THREE.ReinhardToneMapping
})

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 5000, { x: 0, y: 300, z: 600 })
camera.layers.enable(BASE_SCENE)
camera.layers.enable(BLOOM_SCENE)

const renderScene = new RenderPass( scene, camera )

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength,
  params.bloomRadius,
  params.bloomThreshold
)
const bloomComposer = new EffectComposer( renderer )
bloomComposer.renderToScreen = false
bloomComposer.addPass( renderScene )
bloomComposer.addPass( bloomPass )

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial( {
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture }
    },
    vertexShader: mixVertex,
    fragmentShader: mixFragment,
    defines: {}
  } ), 'baseTexture'
);
mixPass.needsSwap = true

// OutputPass is usually the last pass in the chain which performs sRGB color space conversion and tone mapping.
const outputPass = new OutputPass()

const finalComposer = new EffectComposer( renderer )
finalComposer.addPass( renderScene )
finalComposer.addPass( mixPass )
finalComposer.addPass( outputPass )

/**************************************************
 * 2. Build your scene in this threejs app
 * This app object needs to consist of at least the async initScene() function (it is async so the animate function can wait for initScene() to finish before being called)
 * initScene() is called after a basic threejs environment has been set up, you can add objects/lighting to you scene in initScene()
 * if your app needs to animate things(i.e. not static), include a updateScene(interval, elapsed) function in the app as well
 *************************************************/
let app = {
  addPoints(mode = "disc", count = 5000, speed = 1, twist = 0) {
    let particlegeo = new THREE.PlaneGeometry(1,1)
    let geo = new THREE.InstancedBufferGeometry()
    geo.instanceCount = count
    geo.setAttribute('position', particlegeo.getAttribute('position'))
    geo.index = particlegeo.index

    let pos = new Float32Array(count * 3)
    let col = new Float32Array(count * 3)

    // parts of the sequences should add up to 1.0
    // we distribute the whole of "count" according to the portion(value) of each sequence
    // the specific portions of the sequence parts are manually defined such that the stars
    // look evenly distributed among the whole length of the spirals
    let sequences = [0.05, 0.1, 0.15, 0.25, 0.45]
    let start = 0
    for (let j = 0; j < sequences.length; j++) {
      let subcount = start + count * sequences[j]
      for (let i = start; i < subcount; i++) {
        let theta = Math.random() * 2 * Math.PI
        
        let x, y, z

        if (mode == "disc") {
          x = gaussianRandom(0, 40)
          z = gaussianRandom(0, 40)
          y = gaussianRandom(0, 5)

          // set colors
          col.set([
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5
          ], i*3)
        } else if (mode == "spiral") {
          let spos = spiral(gaussianRandom(200,100), gaussianRandom(0,5), gaussianRandom(100,50), twist)
          x = spos.x
          y = spos.y
          z = spos.z

          // set colors
          col.set([
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5
          ], i*3)
        }
        pos.set([
          x,y,z
        ], i*3)
      }
      // update start index for next loop
      start += count * sequences[j]
    }

    geo.setAttribute('pos', new THREE.InstancedBufferAttribute(pos, 3, false))
    geo.setAttribute('col', new THREE.InstancedBufferAttribute(col, 3, false))

    let material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ...uniforms,
        uMouse: { value: this.uMouse },
        u_speed: { value: speed },
        u_dyn_trail: { value: mode == 'disc' },
        uCamPos: { value: camera.position },
        uSizeBase: { value: 0.1 },
        uSizeMult: { value: 1.2 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false
    })

    let points = new THREE.Mesh(geo, material)
    // points.layers.enable(BLOOM_SCENE)
    points.layers.set(BLOOM_SCENE)
    scene.add(points)
  },
  addHaze() {
    let centralCount = 1000
    let spiral1Count = 3000
    let spiral2Count = 3000
    let particlegeo = new THREE.PlaneGeometry(1,1)
    let geo = new THREE.InstancedBufferGeometry()
    geo.instanceCount = centralCount + spiral1Count + spiral2Count
    geo.setAttribute('position', particlegeo.getAttribute('position'))
    geo.index = particlegeo.index

    let pos = new Float32Array(geo.instanceCount * 3)
    let col = new Float32Array(geo.instanceCount * 3)

    let start = 0
    for (let i = start; i < centralCount; i++) {
      pos.set([
        gaussianRandom(0, 40),
        gaussianRandom(0, 5),
        gaussianRandom(0, 40)
      ], i*3)
      col.set([
        Math.random() * 0.8,
        Math.random() * 0.8,
        Math.random() * 0.4
      ], i*3)
    }
    // update start index for next loop
    start += centralCount

    for (let i = start; i < start+spiral1Count; i++) {
      let spos = spiral(gaussianRandom(200,100), gaussianRandom(0,5), gaussianRandom(100,50))
      pos.set([
        spos.x,
        spos.y,
        spos.z
      ], i*3)
      col.set([
        Math.random() * 0.1,
        Math.random() * 0.5,
        Math.random() * 0.5 + 0.5
      ], i*3)
    }
    // update start index for next loop
    start += spiral1Count

    for (let i = start; i < start+spiral2Count; i++) {
      let spos = spiral(gaussianRandom(200,100), gaussianRandom(0,5), gaussianRandom(100,50), Math.PI)
      pos.set([
        spos.x,
        spos.y,
        spos.z
      ], i*3)
      col.set([
        Math.random() * 0.1,
        Math.random() * 0.5,
        Math.random() * 0.5 + 0.5
      ], i*3)
    }

    geo.setAttribute('pos', new THREE.InstancedBufferAttribute(pos, 3, false))
    geo.setAttribute('col', new THREE.InstancedBufferAttribute(col, 3, false))

    let material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ...uniforms,
        u_Texture: { value: this.hazeText },
        uMouse: { value: this.uMouse },
        u_speed: { value: 0.1 },
        uSizeBase: { value: 30.0 },
        uSizeMult: { value: 80.0 },
        uOpacity: { value: 0.01 },
        u_dyn_trail: { value: false },
        uCamPos: { value: camera.position }
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    let points = new THREE.Mesh(geo, material)
    // points.layers.enable(BASE_SCENE)
    points.layers.set(BASE_SCENE)
    scene.add(points)
  },
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement)
    this.controls.enableDamping = true
    this.controls.autoRotate = true
    this.controls.autoRotateSpeed = 0.2

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    // init with a value outside the galaxy, so the star sphere won't start at the galaxy center by default
    this.uMouse = new THREE.Vector3(10,10,10)

    let hitmesh = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10, 10, 10).rotateX(-Math.PI/2),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    )

    window.addEventListener( "pointermove", (event) => {
      this.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

      this.raycaster.setFromCamera( this.pointer, camera )

      const intersects = this.raycaster.intersectObjects([hitmesh])
      // if (intersects[0]) {
      //   this.uMouse.copy(intersects[0].point)
      // }
    })

    uniforms.u_Texture = {
      value: await loadTexture(particleTexture)
    }

    this.addPoints("disc", 4000, 0.1)
    this.addPoints("spiral", 5000, 0.1)
    this.addPoints("spiral", 5000, 0.1, Math.PI)

    this.hazeText = await loadTexture(hazeTexture)
    this.addHaze()

    // GUI controls
    const gui = new dat.GUI()
    let bloomFolder = gui.addFolder(`Bloom`)
    bloomFolder.add(params, "bloomStrength", 0, 3, 0.05).onChange((val) => {
      bloomPass.strength = Number(val)
      this.render()
    })
    bloomFolder.add(params, "bloomRadius", 0, 1, 0.05).onChange((val) => {
      bloomPass.radius = Number(val)
      this.render()
    })
    bloomFolder.add(params, "bloomThreshold", 0, 1, 0.05).onChange((val) => {
      bloomPass.threshold = Number(val)
      this.render()
    })

    // Stats - show fps
    this.stats1 = new Stats()
    this.stats1.showPanel(0) // Panel 0 = fps
    this.stats1.domElement.style.cssText = "position:absolute;top:0px;left:0px;"
    // this.container is the parent DOM element of the threejs canvas element
    this.container.appendChild(this.stats1.domElement)
  },
  render() {
    // render bloom
    camera.layers.set(BLOOM_SCENE)
    bloomComposer.render()

    // render final
    camera.layers.set(BASE_SCENE)
    finalComposer.render()
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update()
    this.stats1.update()

    this.render()
  }
}

/**************************************************
 * 3. Run the app
 * 'runApp' will do most of the boilerplate setup code for you:
 * e.g. HTML container, window resize listener, mouse move/touch listener for shader uniforms, THREE.Clock() for animation
 * Executing this line puts everything together and runs the app
 * ps. if you don't use custom shaders, pass undefined to the 'uniforms'(2nd-last) param
 * ps. if you don't use post-processing, pass undefined to the 'composer'(last) param
 *************************************************/
runApp(app, scene, renderer, camera, true, uniforms)
