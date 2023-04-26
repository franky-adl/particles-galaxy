// ThreeJS and Third-party deps
import * as THREE from "three"
import * as dat from 'dat.gui'
import Stats from "three/examples/jsm/libs/stats.module"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"

// Core boilerplate code deps
import { createCamera, getDefaultUniforms, createRenderer, runApp } from "./core-utils"
import { loadTexture, lerp, smoothstep } from "./common-utils"

import vertex from './shaders/vertex.glsl'
import fragment from './shaders/fragment.glsl'
import particleTexture from './assets/pTv3.jpg'

global.THREE = THREE
// previously this feature is .legacyMode = false, see https://www.donmccurdy.com/2020/06/17/color-management-in-threejs/
// turning this on has the benefit of doing certain automatic conversions (for hexadecimal and CSS colors from sRGB to linear-sRGB)
THREE.ColorManagement.enabled = true

/**************************************************
 * 0. Tweakable parameters for the scene
 *************************************************/
const params = {
  // general scene params
}
const uniforms = getDefaultUniforms()


/**************************************************
 * 1. Initialize core threejs components
 *************************************************/
// Create the scene
let scene = new THREE.Scene()

// Create the renderer via 'createRenderer',
// 1st param receives additional WebGLRenderer properties
// 2nd param receives a custom callback to further configure the renderer
let renderer = createRenderer({ antialias: true }, (_renderer) => {
  // best practice: ensure output colorspace is in sRGB, see Color Management documentation:
  // https://threejs.org/docs/#manual/en/introduction/Color-management
  // _renderer.outputEncoding = THREE.sRGBEncoding
})

// Create the camera
// Pass in fov, near, far and camera position respectively
let camera = createCamera(45, 1, 1000, { x: 0, y: 1.5, z: 3 })

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
    let sequences = [0.05, 0.1, 0.15, 0.25, 0.45]
    let start = 0
    for (let j = 0; j < sequences.length; j++) {
      subcount = start + count * sequences[j]
      for (let i = start; i < subcount; i++) {
        let theta = Math.random() * 2 * Math.PI
        
        let x, y, z

        if (mode == "disc") {
          // 1. standard disc
          let minRadius = 0.01
          // need to fit with size of spiral if you're adding both modes
          let maxRadius = 2.8
          let rPerc = Math.random()
          let r = lerp(minRadius, maxRadius, rPerc)
          x = r * Math.cos(theta)
          z = r * Math.sin(theta)
          // makes stars bulge more at the center
          y = (Math.random()-0.5) * 0.01 * Math.pow(smoothstep(1-rPerc)*6.5, 2)

          // set colors
          col.set([
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5,
            Math.random() * 0.5 + 0.5
          ], i*3)
        } else if (mode == "spiral") {
          // 2. logarithm spiral
          let a = 1.0, b = 0.2
          let scaleFactor = 0.05
          // need to fit with size of disc if you're adding both modes
          let maxT = 20
          let t = j*(maxT/5) + Math.random() * (maxT/5)
          let scatter = lerp(0.1, 7.5, t/maxT)
          // logarithmic spiral + limited fluctuations
          let ox = scaleFactor * (a * Math.pow(Math.E, b * t) * Math.cos(t) + (Math.random() * scatter - scatter/2))
          let oz = scaleFactor * (a * Math.pow(Math.E, b * t) * Math.sin(t) + (Math.random() * scatter - scatter/2))
          // calculate r and rPerc, notice need to fit with disc size above
          let r = Math.sqrt(Math.pow(ox, 2) + Math.pow(oz, 2))
          let rPerc = r/2.8
          y = (Math.random()-0.5) * 0.01 * Math.pow(smoothstep(1-rPerc)*6.5, 2)
          // add rotation(twist)
          x = ox * Math.cos(twist) - oz * Math.sin(twist)
          z = ox * Math.sin(twist) + oz * Math.cos(twist)

          // set colors
          col.set([
            Math.random() * Math.sqrt(rPerc) + Math.pow((1-rPerc), 2),
            Math.random() * Math.sqrt(rPerc) + Math.pow((1-rPerc), 2),
            Math.random() * Math.pow((1-rPerc), 2) + Math.sqrt(rPerc)
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
        u_dyn_trail: { value: mode == 'disc' }
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false
    })

    let points = new THREE.Mesh(geo, material)
    scene.add(points)
  },
  async initScene() {
    // OrbitControls
    this.controls = new OrbitControls(camera, renderer.domElement)
    this.controls.enableDamping = true

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
      if (intersects[0]) {
        this.uMouse.copy(intersects[0].point)
      }
    })

    uniforms.u_Texture = {
      value: await loadTexture(particleTexture)
    }

    this.addPoints("disc", 10000, 0.13)
    this.addPoints("spiral", 4000, 0.1)
    this.addPoints("spiral", 4000, 0.1, Math.PI * 2 / 3)
    this.addPoints("spiral", 4000, 0.1, Math.PI * 4 / 3)

    // GUI controls
    const gui = new dat.GUI()

    // Stats - show fps
    this.stats1 = new Stats()
    this.stats1.showPanel(0) // Panel 0 = fps
    this.stats1.domElement.style.cssText = "position:absolute;top:0px;left:0px;"
    // this.container is the parent DOM element of the threejs canvas element
    this.container.appendChild(this.stats1.domElement)
  },
  // @param {number} interval - time elapsed between 2 frames
  // @param {number} elapsed - total time elapsed since app start
  updateScene(interval, elapsed) {
    this.controls.update()
    this.stats1.update()
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
runApp(app, scene, renderer, camera, true, uniforms, undefined)
