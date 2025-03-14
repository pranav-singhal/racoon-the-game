import * as THREE from 'three'
import './style.css'

// Game constants
const GAME_SPEED = 0.2
const LANE_WIDTH = 2
const LANE_COUNT = 3
const OBSTACLE_DISTANCE = 20
const OBSTACLE_PROBABILITY = 0.5
const COLLECTIBLE_PROBABILITY = 0.3
const WORLD_DEPTH = 100
const JUMP_FORCE = 0.2 
const GRAVITY = 0.008
const SAFE_START_DISTANCE = 40 // Distance at the start with no obstacles
const CLOUD_COUNT = 15 // Number of clouds in the sky
const TREE_COUNT = 30 // Number of trees on each side

// Game state
let score = 0
let cloverCount = 0 // Track clovers separately
let isGameOver = false
let animationId: number
let isGameStarted = false
let countdownValue = 3

// Game elements
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let raccoon: THREE.Group
let path: THREE.Mesh
let obstacles: THREE.Object3D[] = []
let collectibles: THREE.Object3D[] = []
let clouds: THREE.Object3D[] = []
let trees: THREE.Object3D[] = []
let targetLanePosition = 0
let mouseX = 0
let lastMouseX = 0

// Jump physics
let isJumping = false
let jumpVelocity = 0
let raccoonDefaultY = 0

// DOM elements
const gameContainer = document.getElementById('game-container') as HTMLElement
const scoreDisplay = document.getElementById('score-display') as HTMLElement
const cloverDisplay = document.getElementById('clover-display') as HTMLElement // New element for clover count
const gameOverDisplay = document.getElementById('game-over') as HTMLElement
const finalScoreDisplay = document.getElementById('final-score') as HTMLElement
const finalCloverDisplay = document.getElementById('final-clover-display') as HTMLElement // New element for final clover count
const restartButton = document.getElementById('restart-button') as HTMLElement
const countdownDisplay = document.getElementById('countdown') as HTMLElement

// Initialize the game
function init() {
  // Reset game state
  score = 0
  cloverCount = 0 // Reset clover count
  isGameOver = false
  isGameStarted = false
  countdownValue = 3
  obstacles = []
  collectibles = []
  clouds = []
  trees = []
  targetLanePosition = 0
  isJumping = false
  jumpVelocity = 0
  updateScoreDisplay()
  updateCloverDisplay() // Initialize clover display

  // Create scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87CEEB) // Sky blue background

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  
  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  
  // Clear the container and add the renderer
  gameContainer.innerHTML = ''
  gameContainer.appendChild(renderer.domElement)

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 10, 7)
  directionalLight.castShadow = true
  directionalLight.shadow.camera.near = 0.5
  directionalLight.shadow.camera.far = 50
  directionalLight.shadow.camera.left = -10
  directionalLight.shadow.camera.right = 10
  directionalLight.shadow.camera.top = 10
  directionalLight.shadow.camera.bottom = -10
  scene.add(directionalLight)

  // Create the running path
  createPath()
  
  // Create environmental elements
  createClouds()
  createTrees()

  // Create the raccoon character
  createRaccoon()
  raccoonDefaultY = 0
  
  // Position camera to make road start from bottom of screen and zoom in on raccoon
  camera.position.set(0, 8, 16) // Lower and closer to the raccoon
  camera.rotation.x = -0.3 // Less steep angle to shift scene down
  camera.fov = 55 // Even narrower field of view for more zoom
  camera.updateProjectionMatrix() // Apply the new field of view
  
  // Generate initial world with a safe start area
  generateWorld()

  // Add event listeners
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('keydown', onKeyDown)
  restartButton.addEventListener('click', restartGame)

  // Start the countdown
  startCountdown()

  // Start the game loop
  animate()
}

// Start the countdown
function startCountdown() {
  // Show the countdown display
  countdownDisplay.style.display = 'block'
  countdownDisplay.textContent = countdownValue.toString()
  
  // Update the countdown every second
  const countdownInterval = setInterval(() => {
    countdownValue--
    
    if (countdownValue > 0) {
      countdownDisplay.textContent = countdownValue.toString()
    } else {
      // Countdown finished, start the game
      clearInterval(countdownInterval)
      countdownDisplay.style.display = 'none'
      isGameStarted = true
    }
  }, 1000)
}

// Create the running path
function createPath() {
  // Create a textured path with more details
  const pathWidth = LANE_WIDTH * LANE_COUNT
  const pathLength = WORLD_DEPTH
  
  // Create the base path
  const pathGeometry = new THREE.BoxGeometry(pathWidth, 0.5, pathLength)
  
  // Create a more realistic dirt path texture
  const pathMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513, // Brown color for the path
    roughness: 0.9,
    metalness: 0.1
  })
  
  path = new THREE.Mesh(pathGeometry, pathMaterial)
  path.position.y = -0.25
  path.position.z = -pathLength / 2 + 15 // Move the path forward more so it starts at the bottom of the screen
  path.receiveShadow = true
  scene.add(path)
  
  // Add lane markings
  for (let i = 1; i < LANE_COUNT; i++) {
    const markingGeometry = new THREE.BoxGeometry(0.1, 0.01, pathLength)
    const markingMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFFFFF,
      emissive: 0xFFFFFF,
      emissiveIntensity: 0.2
    })
    
    const marking = new THREE.Mesh(markingGeometry, markingMaterial)
    marking.position.x = (i - LANE_COUNT / 2) * LANE_WIDTH + LANE_WIDTH / 2
    marking.position.y = 0.01
    marking.position.z = -pathLength / 2 + 15 // Match the path position
    scene.add(marking)
  }
  
  // Add small rocks and details to the path
  for (let i = 0; i < 100; i++) {
    const rockSize = 0.05 + Math.random() * 0.1
    const rockGeometry = new THREE.SphereGeometry(rockSize, 4, 4)
    const rockMaterial = new THREE.MeshStandardMaterial({ 
      color: Math.random() > 0.5 ? 0x777777 : 0x999999,
      roughness: 1.0
    })
    
    const rock = new THREE.Mesh(rockGeometry, rockMaterial)
    
    // Position rocks randomly along the path but not in the center of lanes
    const laneOffset = (Math.random() - 0.5) * 0.5
    const lane = Math.floor(Math.random() * LANE_COUNT)
    const x = (lane - (LANE_COUNT - 1) / 2) * LANE_WIDTH + laneOffset
    
    rock.position.set(
      x,
      0.01, // Just above the path
      -Math.random() * pathLength + 15 // Adjust for new path position
    )
    
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )
    
    rock.castShadow = true
    rock.receiveShadow = true
    scene.add(rock)
  }

  // Add grass on the sides
  const grassGeometry = new THREE.BoxGeometry(10, 0.5, WORLD_DEPTH)
  const grassMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x7CFC00, // Light green for grass
    roughness: 0.8
  })
  
  const leftGrass = new THREE.Mesh(grassGeometry, grassMaterial)
  leftGrass.position.x = -((LANE_WIDTH * LANE_COUNT) / 2 + 5)
  leftGrass.position.y = -0.25
  leftGrass.position.z = -WORLD_DEPTH / 2 + 15 // Match the path position
  leftGrass.receiveShadow = true
  scene.add(leftGrass)
  
  const rightGrass = new THREE.Mesh(grassGeometry, grassMaterial)
  rightGrass.position.x = (LANE_WIDTH * LANE_COUNT) / 2 + 5
  rightGrass.position.y = -0.25
  rightGrass.position.z = -WORLD_DEPTH / 2 + 15 // Match the path position
  rightGrass.receiveShadow = true
  scene.add(rightGrass)
  
  // Add grass blades for more realism
  for (let i = 0; i < 500; i++) {
    const bladeHeight = 0.2 + Math.random() * 0.3
    const bladeGeometry = new THREE.BoxGeometry(0.05, bladeHeight, 0.05)
    const bladeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x7CFC00 + Math.random() * 0x009900, // Slightly varied green
      roughness: 1.0
    })
    
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial)
    
    // Position on either left or right grass
    const side = Math.random() > 0.5 ? 1 : -1
    const distanceFromPath = (LANE_WIDTH * LANE_COUNT) / 2 + Math.random() * 9
    
    blade.position.set(
      side * distanceFromPath,
      bladeHeight / 2 - 0.25, // Half height above the grass
      -Math.random() * WORLD_DEPTH + 15 // Adjust for new path position
    )
    
    // Slight random rotation for natural look
    blade.rotation.y = Math.random() * Math.PI
    blade.rotation.x = (Math.random() - 0.5) * 0.2
    blade.rotation.z = (Math.random() - 0.5) * 0.2
    
    blade.castShadow = true
    scene.add(blade)
  }
}

// Create clouds in the sky
function createClouds() {
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const cloud = new THREE.Group()
    
    // Number of puffs in this cloud
    const puffCount = 3 + Math.floor(Math.random() * 5)
    
    // Create cloud puffs
    for (let j = 0; j < puffCount; j++) {
      const puffSize = 0.8 + Math.random() * 1.5
      const puffGeometry = new THREE.SphereGeometry(puffSize, 7, 7)
      const puffMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFFFFFF,
        roughness: 0.7,
        metalness: 0.1,
        emissive: 0xCCCCCC,
        emissiveIntensity: 0.1
      })
      
      const puff = new THREE.Mesh(puffGeometry, puffMaterial)
      
      // Position puffs to form a cloud shape
      puff.position.set(
        (Math.random() - 0.5) * 2 * puffCount,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 2
      )
      
      cloud.add(puff)
    }
    
    // Position the cloud in the sky
    cloud.position.set(
      (Math.random() - 0.5) * 100, // Wide spread on x-axis
      15 + Math.random() * 10,     // Height in the sky
      -Math.random() * WORLD_DEPTH + 15 // Adjust for new path position
    )
    
    // Add some random scaling
    const cloudScale = 1 + Math.random() * 2
    cloud.scale.set(cloudScale, cloudScale * 0.6, cloudScale)
    
    // Store cloud speed for animation
    cloud.userData = {
      speed: 0.01 + Math.random() * 0.03
    }
    
    scene.add(cloud)
    clouds.push(cloud)
  }
}

// Create trees on the sides
function createTrees() {
  for (let i = 0; i < TREE_COUNT; i++) {
    // Create a tree for each side
    createTree(-1, i) // Left side
    createTree(1, i)  // Right side
  }
}

// Create a single tree
function createTree(side: number, index: number) {
  const tree = new THREE.Group()
  
  // Create the trunk
  const trunkHeight = 1.5 + Math.random() * 2
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 8)
  const trunkMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513, // Brown
    roughness: 0.9
  })
  
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
  trunk.position.y = trunkHeight / 2
  trunk.castShadow = true
  tree.add(trunk)
  
  // Create the foliage (different tree types)
  const treeType = Math.floor(Math.random() * 3)
  
  if (treeType === 0) {
    // Pine tree (conical)
    const foliageHeight = 2 + Math.random() * 2
    const foliageGeometry = new THREE.ConeGeometry(1, foliageHeight, 8)
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x006400, // Dark green
      roughness: 0.8
    })
    
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial)
    foliage.position.y = trunkHeight + foliageHeight / 2 - 0.3
    foliage.castShadow = true
    tree.add(foliage)
  } 
  else if (treeType === 1) {
    // Deciduous tree (spherical)
    const foliageRadius = 1 + Math.random() * 1.5
    const foliageGeometry = new THREE.SphereGeometry(foliageRadius, 8, 8)
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x228B22, // Forest green
      roughness: 0.8
    })
    
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial)
    foliage.position.y = trunkHeight + foliageRadius - 0.3
    foliage.castShadow = true
    tree.add(foliage)
  }
  else {
    // Multi-layered pine
    const layers = 2 + Math.floor(Math.random() * 3)
    const maxRadius = 1.2
    
    for (let j = 0; j < layers; j++) {
      const layerRadius = maxRadius * (1 - j / layers * 0.5)
      const layerHeight = 0.8
      
      const layerGeometry = new THREE.ConeGeometry(layerRadius, layerHeight, 8)
      const layerMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x006400, // Dark green
        roughness: 0.8
      })
      
      const layer = new THREE.Mesh(layerGeometry, layerMaterial)
      layer.position.y = trunkHeight + j * (layerHeight * 0.7)
      layer.castShadow = true
      tree.add(layer)
    }
  }
  
  // Position the tree along the side of the path
  const distanceFromPath = (LANE_WIDTH * LANE_COUNT) / 2 + 2 + Math.random() * 7
  const z = -(index * (WORLD_DEPTH / TREE_COUNT)) - Math.random() * (WORLD_DEPTH / TREE_COUNT) + 15 // Adjust for new path position
  
  tree.position.set(
    side * distanceFromPath,
    0, // At ground level
    z
  )
  
  // Add slight random rotation
  tree.rotation.y = Math.random() * Math.PI * 2
  
  // Store tree data for animation
  tree.userData = {
    swaySpeed: 0.2 + Math.random() * 0.3,
    swayAmount: 0.01 + Math.random() * 0.02,
    originalX: side * distanceFromPath
  }
  
  scene.add(tree)
  trees.push(tree)
}

// Create the raccoon character
function createRaccoon() {
  // Create a group for the raccoon
  raccoon = new THREE.Group()
  
  // Add user data for special effects
  raccoon.userData = {
    legs: null,
    lastSpecialCount: 0 // Track the last special count we've shown feedback for
  }
  
  // Body - more elongated for a quadruped
  const bodyGeometry = new THREE.BoxGeometry(0.7, 0.5, 1.2)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.25
  body.castShadow = true
  raccoon.add(body)
  
  // Head
  const headGeometry = new THREE.BoxGeometry(0.6, 0.5, 0.6)
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.position.set(0, 0.5, 0.7)
  head.castShadow = true
  raccoon.add(head)
  
  // Face mask (raccoon's distinctive feature)
  const maskGeometry = new THREE.BoxGeometry(0.65, 0.25, 0.2)
  const maskMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }) // Dark gray/black
  const mask = new THREE.Mesh(maskGeometry, maskMaterial)
  mask.position.set(0, 0.5, 1.0)
  raccoon.add(mask)
  
  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8)
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }) // Black color
  
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
  leftEye.position.set(-0.2, 0.6, 1.0)
  raccoon.add(leftEye)
  
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
  rightEye.position.set(0.2, 0.6, 1.0)
  raccoon.add(rightEye)
  
  // Nose
  const noseGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.1)
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }) // Black color
  const nose = new THREE.Mesh(noseGeometry, noseMaterial)
  nose.position.set(0, 0.4, 1.1)
  raccoon.add(nose)
  
  // Ears
  const earGeometry = new THREE.ConeGeometry(0.15, 0.3, 4)
  const earMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
  
  const leftEar = new THREE.Mesh(earGeometry, earMaterial)
  leftEar.position.set(-0.25, 0.8, 0.7)
  leftEar.rotation.x = -Math.PI / 6
  raccoon.add(leftEar)
  
  const rightEar = new THREE.Mesh(earGeometry, earMaterial)
  rightEar.position.set(0.25, 0.8, 0.7)
  rightEar.rotation.x = -Math.PI / 6
  raccoon.add(rightEar)
  
  // Tail - distinctive raccoon striped tail
  const tailGroup = new THREE.Group()
  
  const tailBaseGeometry = new THREE.CylinderGeometry(0.15, 0.1, 0.8, 8)
  const tailBaseMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray
  const tailBase = new THREE.Mesh(tailBaseGeometry, tailBaseMaterial)
  tailBase.position.z = -0.4
  tailBase.rotation.x = Math.PI / 3
  tailGroup.add(tailBase)
  
  // Add stripes to tail
  for (let i = 0; i < 3; i++) {
    const stripeGeometry = new THREE.CylinderGeometry(0.15 - i * 0.02, 0.13 - i * 0.02, 0.15, 8)
    const stripeMaterial = new THREE.MeshStandardMaterial({ 
      color: i % 2 === 0 ? 0x333333 : 0x808080 // Alternating dark and light
    })
    const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial)
    stripe.position.z = -0.4 - (i * 0.15)
    stripe.rotation.x = Math.PI / 3
    tailGroup.add(stripe)
  }
  
  tailGroup.position.set(0, 0.3, -0.6)
  raccoon.add(tailGroup)
  
  // Legs
  const legGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.15)
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 }) // Darker gray
  
  // Front legs
  const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial)
  frontLeftLeg.position.set(-0.25, 0.15, 0.4)
  raccoon.add(frontLeftLeg)
  
  const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial)
  frontRightLeg.position.set(0.25, 0.15, 0.4)
  raccoon.add(frontRightLeg)
  
  // Back legs
  const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial)
  backLeftLeg.position.set(-0.25, 0.15, -0.4)
  raccoon.add(backLeftLeg)
  
  const backRightLeg = new THREE.Mesh(legGeometry, legMaterial)
  backRightLeg.position.set(0.25, 0.15, -0.4)
  raccoon.add(backRightLeg)
  
  // Store references to legs for animation
  raccoon.userData.legs = {
    frontLeft: frontLeftLeg,
    frontRight: frontRightLeg,
    backLeft: backLeftLeg,
    backRight: backRightLeg
  }
  
  // Add raccoon to the scene
  raccoon.position.y = 0
  raccoon.position.z = 6 // Position raccoon a bit further forward for better framing
  // Rotate the raccoon to face forward along the track
  raccoon.rotation.y = Math.PI
  scene.add(raccoon)
}

// Generate obstacles and collectibles
function generateWorld() {
  // Clear existing obstacles and collectibles
  obstacles.forEach(obstacle => scene.remove(obstacle))
  collectibles.forEach(collectible => scene.remove(collectible))
  obstacles = []
  collectibles = []
  
  // Generate new obstacles and collectibles
  for (let z = -SAFE_START_DISTANCE + 15; z > -WORLD_DEPTH + 15; z -= OBSTACLE_DISTANCE) {
    // Randomly decide which lanes will have obstacles
    const laneObstacles = Array(LANE_COUNT).fill(false).map(() => Math.random() < OBSTACLE_PROBABILITY)
    
    // Make sure at least one lane is free
    if (laneObstacles.every(hasObstacle => hasObstacle)) {
      const freeLane = Math.floor(Math.random() * LANE_COUNT)
      laneObstacles[freeLane] = false
    }
    
    // Create obstacles
    laneObstacles.forEach((hasObstacle, lane) => {
      if (hasObstacle) {
        createObstacle(lane, z)
      } else if (Math.random() < COLLECTIBLE_PROBABILITY) {
        // If no obstacle in this lane, maybe add a collectible
        createCollectible(lane, z)
      }
    })
  }
}

// Create an obstacle
function createObstacle(lane: number, z: number) {
  // Randomly choose trash can type
  const trashCanType = Math.floor(Math.random() * 3)
  let obstacle: THREE.Group
  
  // Create a group for the trash can
  obstacle = new THREE.Group()
  
  switch (trashCanType) {
    case 0: // Standard cylindrical trash can
      // Trash can body
      const standardBodyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 1.0, 16)
      const standardBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 }) // Dark gray
      const standardBody = new THREE.Mesh(standardBodyGeometry, standardBodyMaterial)
      standardBody.position.y = 0.5
      standardBody.castShadow = true
      obstacle.add(standardBody)
      
      // Trash can lid
      const standardLidGeometry = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16)
      const standardLidMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 }) // Darker gray
      const standardLid = new THREE.Mesh(standardLidGeometry, standardLidMaterial)
      standardLid.position.y = 1.05
      standardLid.castShadow = true
      obstacle.add(standardLid)
      
      // Add some details - handle
      const handleGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1)
      const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 })
      const handle = new THREE.Mesh(handleGeometry, handleMaterial)
      handle.position.set(0, 1.0, 0.5)
      obstacle.add(handle)
      
      break
      
    case 1: // Square trash can
      // Trash can body
      const squareBodyGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.8)
      const squareBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }) // Sea green
      const squareBody = new THREE.Mesh(squareBodyGeometry, squareBodyMaterial)
      squareBody.position.y = 0.6
      squareBody.castShadow = true
      obstacle.add(squareBody)
      
      // Trash can lid
      const squareLidGeometry = new THREE.BoxGeometry(0.85, 0.1, 0.85)
      const squareLidMaterial = new THREE.MeshStandardMaterial({ color: 0x1D704A }) // Darker green
      const squareLid = new THREE.Mesh(squareLidGeometry, squareLidMaterial)
      squareLid.position.y = 1.25
      squareLid.castShadow = true
      obstacle.add(squareLid)
      
      // Add recycling symbol
      const symbolGeometry = new THREE.BoxGeometry(0.4, 0.01, 0.4)
      const symbolMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }) // White
      const symbol = new THREE.Mesh(symbolGeometry, symbolMaterial)
      symbol.position.set(0, 0.8, 0.41)
      symbol.rotation.x = Math.PI / 2
      obstacle.add(symbol)
      
      break
      
    case 2: // Domed lid trash can
      // Trash can body
      const domeBodyGeometry = new THREE.CylinderGeometry(0.45, 0.4, 0.9, 16)
      const domeBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4682B4 }) // Steel blue
      const domeBody = new THREE.Mesh(domeBodyGeometry, domeBodyMaterial)
      domeBody.position.y = 0.45
      domeBody.castShadow = true
      obstacle.add(domeBody)
      
      // Domed lid
      const domeLidGeometry = new THREE.SphereGeometry(0.45, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2)
      const domeLidMaterial = new THREE.MeshStandardMaterial({ color: 0x36648B }) // Darker blue
      const domeLid = new THREE.Mesh(domeLidGeometry, domeLidMaterial)
      domeLid.position.y = 0.9
      domeLid.castShadow = true
      obstacle.add(domeLid)
      
      // Add a swinging door on the dome
      const doorGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.01)
      const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x36648B }) // Matching blue
      const door = new THREE.Mesh(doorGeometry, doorMaterial)
      door.position.set(0, 0.9, 0.45)
      door.rotation.x = Math.PI / 4 // Slightly open
      obstacle.add(door)
      
      break
      
    default:
      // Fallback to a simple trash can
      const fallbackGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 12)
      const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 })
      const fallbackBody = new THREE.Mesh(fallbackGeometry, fallbackMaterial)
      fallbackBody.position.y = 0.5
      fallbackBody.castShadow = true
      obstacle.add(fallbackBody)
  }
  
  // Add some random variation to size
  const scale = 0.8 + Math.random() * 0.4 // Scale between 0.8 and 1.2
  obstacle.scale.set(scale, scale, scale)
  
  // Add some random rotation for variety
  obstacle.rotation.y = Math.random() * Math.PI * 2
  
  // Position the obstacle
  const lanePosition = getLanePosition(lane)
  obstacle.position.x = lanePosition
  obstacle.position.z = z
  obstacle.userData = { type: 'obstacle' }
  
  scene.add(obstacle)
  obstacles.push(obstacle)
}

// Create a collectible
function createCollectible(lane: number, z: number) {
  // Create a 4-leaf clover as a collectible
  const clover = new THREE.Group();
  
  // Create the stem
  const stemGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
  const stemMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x228B22, // Forest green
  });
  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = -0.2;
  stem.castShadow = true;
  clover.add(stem);
  
  // Create the four leaves
  const leafGeometry = new THREE.SphereGeometry(0.15, 8, 8);
  const leafMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x32CD32, // Lime green
    emissive: 0x32CD32,
    emissiveIntensity: 0.2
  });
  
  // Position the four leaves in a clover pattern
  const leafPositions = [
    { x: 0.15, y: 0, z: 0 },    // Right
    { x: -0.15, y: 0, z: 0 },   // Left
    { x: 0, y: 0, z: 0.15 },    // Front
    { x: 0, y: 0, z: -0.15 }    // Back
  ];
  
  leafPositions.forEach(pos => {
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(pos.x, pos.y, pos.z);
    leaf.castShadow = true;
    clover.add(leaf);
  });
  
  // Add a slight rotation to make it look more natural
  clover.rotation.x = Math.PI / 6;
  
  // Position the clover
  const lanePosition = getLanePosition(lane);
  clover.position.x = lanePosition;
  clover.position.y = 0.6; // Slightly above the ground
  clover.position.z = z;
  clover.userData = { 
    type: 'collectible',
    rotationSpeed: 0.03 // Slower rotation for the clover
  };
  
  scene.add(clover);
  collectibles.push(clover);
}

// Get the x position for a lane
function getLanePosition(lane: number): number {
  return (lane - 1) * LANE_WIDTH
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// Handle mouse movement
function onMouseMove(event: MouseEvent) {
  mouseX = (event.clientX / window.innerWidth) * 2 - 1
}

// Handle keyboard input
function onKeyDown(event: KeyboardEvent) {
  // Only allow jumping if the game has started
  if ((event.code === 'Space' || event.key === ' ') && !isJumping && !isGameOver && isGameStarted) {
    jump()
    // Prevent default space bar behavior (like page scrolling)
    event.preventDefault()
  }
}

// Make the raccoon jump
function jump() {
  if (!isJumping) {
    isJumping = true
    jumpVelocity = JUMP_FORCE
    console.log('Jump initiated! Velocity:', jumpVelocity)
  }
}

// Update the raccoon's position based on mouse movement
function updateRaccoonPosition() {
  // Calculate the target lane based on mouse position
  const mouseDelta = mouseX - lastMouseX
  lastMouseX = mouseX
  
  // Move the raccoon based on mouse movement
  targetLanePosition += mouseDelta * 3
  
  // Clamp the position to stay within the lanes
  const maxPosition = (LANE_COUNT - 1) / 2 * LANE_WIDTH
  targetLanePosition = Math.max(-maxPosition, Math.min(maxPosition, targetLanePosition))
  
  // Smoothly move the raccoon towards the target position
  raccoon.position.x += (targetLanePosition - raccoon.position.x) * 0.1
  
  // Add a slight tilt when moving
  raccoon.rotation.z = (targetLanePosition - raccoon.position.x) * -0.5

}

// Update jump physics separately from position updates
function updateJumpPhysics() {
  if (isJumping) {
    // Apply velocity to position
    raccoon.position.y += jumpVelocity
    
    // Apply gravity to velocity
    jumpVelocity -= GRAVITY
    
    // Debug log
    console.log('Jump physics: y =', raccoon.position.y, 'velocity =', jumpVelocity)
    
    // Check if raccoon has landed
    if (raccoon.position.y <= raccoonDefaultY) {
      raccoon.position.y = raccoonDefaultY
      isJumping = false
      jumpVelocity = 0
      console.log('Landed at y =', raccoon.position.y)
    }
  }
}

// Move obstacles and collectibles
function moveObjects() {
  // Only move objects if the game has started
  if (!isGameStarted) return
  
  // Move obstacles
  obstacles.forEach(obstacle => {
    obstacle.position.z += GAME_SPEED
    
    // Remove obstacles that are behind the camera
    if (obstacle.position.z > 10) {
      scene.remove(obstacle)
      obstacles = obstacles.filter(o => o !== obstacle)
    }
  })
  
  // Move collectibles
  collectibles.forEach(collectible => {
    collectible.position.z += GAME_SPEED
    
    // Rotate collectibles - now rotating the whole clover
    collectible.rotation.y += collectible.userData.rotationSpeed
    
    // Remove collectibles that are behind the camera
    if (collectible.position.z > 10) {
      scene.remove(collectible)
      collectibles = collectibles.filter(c => c !== collectible)
    }
  })
  
  // Generate new obstacles and collectibles if needed
  if (obstacles.length + collectibles.length < 20) {
    const lastZ = Math.min(
      ...obstacles.map(o => o.position.z),
      ...collectibles.map(c => c.position.z),
      -SAFE_START_DISTANCE + 15
    )
    
    if (lastZ > -WORLD_DEPTH + 20) {
      // Randomly decide which lanes will have obstacles
      const z = lastZ - OBSTACLE_DISTANCE
      const laneObstacles = Array(LANE_COUNT).fill(false).map(() => Math.random() < OBSTACLE_PROBABILITY)
      
      // Make sure at least one lane is free
      if (laneObstacles.every(hasObstacle => hasObstacle)) {
        const freeLane = Math.floor(Math.random() * LANE_COUNT)
        laneObstacles[freeLane] = false
      }
      
      // Create obstacles
      laneObstacles.forEach((hasObstacle, lane) => {
        if (hasObstacle) {
          createObstacle(lane, z)
        } else if (Math.random() < COLLECTIBLE_PROBABILITY) {
          // If no obstacle in this lane, maybe add a collectible
          createCollectible(lane, z)
        }
      })
    }
  }
}

// Check for collisions
function checkCollisions() {
  if (isGameOver) return
  
  const raccoonBoundingBox = new THREE.Box3().setFromObject(raccoon)
  
  // Check collisions with obstacles
  for (const obstacle of obstacles) {
    const obstacleBoundingBox = new THREE.Box3().setFromObject(obstacle)
    
    if (raccoonBoundingBox.intersectsBox(obstacleBoundingBox)) {
      gameOver()
      return
    }
  }
  
  // Check collisions with collectibles
  for (const collectible of collectibles) {
    const collectibleBoundingBox = new THREE.Box3().setFromObject(collectible)
    
    if (raccoonBoundingBox.intersectsBox(collectibleBoundingBox)) {
      // Collect the item
      scene.remove(collectible)
      collectibles = collectibles.filter(c => c !== collectible)
      
      // Increase clover count instead of score
      cloverCount += 1
      updateCloverDisplay()
    }
  }
}

// Update the score display
function updateScoreDisplay() {
  // Round the score to the nearest integer
  const roundedScore = Math.round(score)
  scoreDisplay.textContent = `Distance: ${roundedScore}`
}

// Update the clover display
function updateCloverDisplay() {
  cloverDisplay.textContent = `Clovers: ${cloverCount}`
  
  // Check for special clover counts (4, 44, 444)
  checkSpecialCloverCount()
}

// Function to check for special clover counts and provide funky feedback
function checkSpecialCloverCount() {
  // Only trigger once for each special number
  if (cloverCount === 4 || cloverCount === 44 || cloverCount === 444) {
    // Store the current count to check if we've already shown feedback for this count
    if (raccoon.userData.lastSpecialCount === cloverCount) {
      return // Already shown feedback for this count
    }
    
    // Remember this count
    raccoon.userData.lastSpecialCount = cloverCount
    
    // Create a special text message
    const specialMessage = document.createElement('div')
    specialMessage.style.position = 'absolute'
    specialMessage.style.top = '50%'
    specialMessage.style.left = '50%'
    specialMessage.style.transform = 'translate(-50%, -50%)'
    specialMessage.style.fontSize = cloverCount === 444 ? '80px' : '60px'
    specialMessage.style.color = '#FFD700' // Gold color
    specialMessage.style.fontFamily = 'Arial, sans-serif'
    specialMessage.style.fontWeight = 'bold'
    specialMessage.style.textShadow = '0 0 10px #FF00FF, 0 0 20px #FF00FF, 0 0 30px #FF00FF' // Neon glow
    specialMessage.style.zIndex = '300'
    specialMessage.style.opacity = '1'
    specialMessage.style.transition = 'opacity 2s, transform 2s'
    
    // Different messages for different counts
    if (cloverCount === 4) {
      specialMessage.textContent = '4️⃣ FOUR-TUNATE! 4️⃣'
    } else if (cloverCount === 44) {
      specialMessage.textContent = '4️⃣4️⃣ DOUBLE FOUR-TUNE! 4️⃣4️⃣'
    } else if (cloverCount === 444) {
      specialMessage.textContent = '4️⃣4️⃣4️⃣ ULTIMATE FOUR-TUNE!!! 4️⃣4️⃣4️⃣'
    }
    
    document.body.appendChild(specialMessage)
    
    
    // Store original colors of raccoon parts with proper typing
    interface ColorData {
      mesh: THREE.Mesh;
      material: THREE.MeshStandardMaterial;
      color: THREE.Color;
    }
    
    const originalColors: ColorData[] = []
    raccoon.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        originalColors.push({
          mesh: child,
          material: child.material,
          color: child.material.color.clone()
        })
      }
    })
    
    // Funky color animation
    let colorPhase = 0
    const colorInterval = setInterval(() => {
      raccoon.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          // Rainbow color cycling
          child.material.color.setHSL((colorPhase + Math.random() * 0.2) % 1, 0.8, 0.6)
        }
      })
      colorPhase += 0.1
    }, 100)
    
    // Funky scale animation
    let scalePhase = 0
    const scaleInterval = setInterval(() => {
      const pulseScale = 1 + 0.2 * Math.sin(scalePhase)
      raccoon.scale.set(pulseScale, pulseScale, pulseScale)
      scalePhase += 0.2
    }, 50)
    
    // End the effects after a few seconds
    setTimeout(() => {
      // Fade out the message
      specialMessage.style.opacity = '0'
      specialMessage.style.transform = 'translate(-50%, -150%)'
      
      // Stop the intervals
      clearInterval(colorInterval)
      clearInterval(scaleInterval)
      
      // Reset raccoon appearance
      raccoon.scale.set(1, 1, 1)
      
      // Restore original colors
      originalColors.forEach(item => {
        item.material.color.copy(item.color)
      })
      
      // Remove the message element after fade out
      setTimeout(() => {
        document.body.removeChild(specialMessage)
      }, 2000)
    }, 4000)
    
    // Play a special sound (if you want to add sound)
    // const specialSound = new Audio('path/to/special-sound.mp3')
    // specialSound.play()
  }
}

// Game over
function gameOver() {
  isGameOver = true
  // Round the score to the nearest integer for consistency
  const roundedScore = Math.round(score)
  finalScoreDisplay.textContent = `Distance: ${roundedScore}`
  finalCloverDisplay.textContent = `Clovers: ${cloverCount}`
  gameOverDisplay.style.display = 'block'
  cancelAnimationFrame(animationId)
}

// Restart the game
function restartGame() {
  gameOverDisplay.style.display = 'none'
  init()
}

// Animation loop
function animate() {
  animationId = requestAnimationFrame(animate)
  
  if (!isGameOver) {
    // Always update raccoon position for smooth control
    updateRaccoonPosition()
    
    // Only update game elements if the game has started
    if (isGameStarted) {
      // Update jump physics separately
      updateJumpPhysics()
      
      // Move obstacles and collectibles
      moveObjects()
      
      // Check for collisions
      checkCollisions()
      
      // Increment score (now represents distance traveled)
      score += 0.1
      // Update score display every 5 frames to avoid too frequent updates
      if (Math.floor(score * 10) % 5 === 0) {
        updateScoreDisplay()
      }
    }
    
    // Always animate raccoon legs for visual appeal
    animateRaccoonRunning()
    
    // Animate environmental elements
    animateEnvironment()
  }
  
  // Render the scene
  renderer.render(scene, camera)
}

// Animate the raccoon's legs to create a running effect
function animateRaccoonRunning() {
  if (!raccoon.userData.legs) return
  
  const time = Date.now() * 0.01
  const legs = raccoon.userData.legs
  
  // Create a running animation by moving legs up and down
  legs.frontLeft.position.y = 0.15 + Math.sin(time * 2) * 0.1
  legs.backRight.position.y = 0.15 + Math.sin(time * 2) * 0.1
  
  legs.frontRight.position.y = 0.15 + Math.sin(time * 2 + Math.PI) * 0.1
  legs.backLeft.position.y = 0.15 + Math.sin(time * 2 + Math.PI) * 0.1
  
  // Only add the body bounce if not jumping
  if (!isJumping) {
    raccoon.position.y = raccoonDefaultY + Math.sin(time * 2) * 0.05
  }
}

// Animate environmental elements (clouds and trees)
function animateEnvironment() {
  const time = Date.now() * 0.001
  
  // Animate clouds
  clouds.forEach(cloud => {
    // Move clouds slowly across the sky
    cloud.position.x += cloud.userData.speed
    
    // Reset cloud position when it moves too far
    if (cloud.position.x > 50) {
      cloud.position.x = -50
      cloud.position.z = -Math.random() * WORLD_DEPTH
    }
  })
  
  // Animate trees (gentle swaying)
  trees.forEach(tree => {
    const swayAmount = tree.userData.swayAmount
    const swaySpeed = tree.userData.swaySpeed
    
    // Gentle swaying motion
    tree.rotation.z = Math.sin(time * swaySpeed) * swayAmount
    
    // If the game has started, move trees with the world
    if (isGameStarted) {
      tree.position.z += GAME_SPEED
      
      // Reset tree position when it moves behind the camera
      if (tree.position.z > 10) {
        tree.position.z = -WORLD_DEPTH
        tree.position.x = tree.userData.originalX
      }
    }
  })
}

// Start the game
init()
