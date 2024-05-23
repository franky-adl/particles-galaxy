import * as THREE from "three"
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader"

global.THREE = THREE

/**
 * 
 * @param {string} hex hex string without or without # prefix
 * @param {bool} forShaders if true, r,g,b components will be in 0..1 range
 * @returns an object with r,g,b components
 */
export const hexToRgb = (hex, forShaders = false) => {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (forShaders) {
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : null;
    }
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * @param {string} url - Path to equirectandular .hdr
 * @returns {Promise<THREE.Texture>}
 */
export const loadHDRI = (url) => {
    return new Promise((resolve) => {
        const hdrEquirect = new RGBELoader().load(url, function () {
            hdrEquirect.mapping = THREE.EquirectangularReflectionMapping
            resolve(hdrEquirect)
        })
    })
}

export const loadTexture = (url) => {
    return new Promise((resolve) => {
        new THREE.TextureLoader().load(url, (texture) => {
            resolve(texture)
        })
    })
}

export const lerp = (a, b, t) => {
    return a * (1 - t) + b * t
}

export const smoothstep = (x) => {
    return x*x*(3.0 - 2.0*x);   // y: 0.0 .. 1.0
}

// The formula is taken from the Box Muller transform https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
// returns range roughly from [-2.5, 2.5] with default mean and stdev values, some wanderers can go pass +/-3.5
export function gaussianRandom(mean=0, stdev=1) {
    let u = 1 - Math.random()
    let v = Math.random()
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)

    return z * stdev + mean
}

/**
 * 
 * @param {number} x from gaussianRandom(200, 100)
 * @param {number} y 
 * @param {number} z from gaussianRandom(100, 50)
 * @param {*} offset 
 * @returns 
 */
export function spiral(x,y,z,offset=0) {
    let r = Math.sqrt(x**2 + z**2)
    let theta = offset
    // This is to add a bit of deviation from the spiral, really comes down to the ratio of z and x
    // if z:x ratio is bigger, the deviation will become bigger
    theta += Math.atan(z/x)
    // This is what essentially makes the spiral, as r increases, so does the angle
    theta += (r/100) * 3
    return {x: r*Math.cos(theta), y: y, z: r*Math.sin(theta)}
}

/**
 * https://www.prowaretech.com/articles/current/javascript/three-js/cover-scene-background-with-image#!
 * Setting background for threejs that doesn't stretch
 * @param {*} scene
 * @param {*} backgroundImageWidth
 * @param {*} backgroundImageHeight
 */
export const maintainBgAspect = (scene, backgroundImageWidth, backgroundImageHeight) => {
    var windowSize = function (withScrollBar) {
        var wid = 0
        var hei = 0
        if (typeof window.innerWidth != "undefined") {
            wid = window.innerWidth
            hei = window.innerHeight
        } else {
            if (document.documentElement.clientWidth == 0) {
                wid = document.body.clientWidth
                hei = document.body.clientHeight
            } else {
                wid = document.documentElement.clientWidth
                hei = document.documentElement.clientHeight
            }
        }
        return { width: wid - (withScrollBar ? wid - document.body.offsetWidth + 1 : 0), height: hei }
    }

    if (scene.background) {
        var size = windowSize(true)
        var factor = backgroundImageWidth / backgroundImageHeight / (size.width / size.height)

        scene.background.offset.x = factor > 1 ? (1 - 1 / factor) / 2 : 0
        scene.background.offset.y = factor > 1 ? 0 : (1 - factor) / 2

        scene.background.repeat.x = factor > 1 ? 1 / factor : 1
        scene.background.repeat.y = factor > 1 ? 1 : factor
    }
}