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
const JUMP_FORCE = 0.3
const GRAVITY = 0.015

// Game state
let score = 0
let isGameOver = false
let animationId: number

// Game elements
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let raccoon: THREE.Group
let path: THREE.Mesh
let obstacles: THREE.Object3D[] = []
let collectibles: THREE.Object3D[] = []
let currentLane = 1 // 0: left, 1: center, 2: right
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
const gameOverDisplay = document.getElementById('game-over') as HTMLElement
const finalScoreDisplay = document.getElementById('final-score') as HTMLElement
const restartButton = document.getElementById('restart-button') as HTMLElement

// Initialize the game
function init() {
  // Reset game state
  score = 0
  isGameOver = false
  obstacles = []
  collectibles = []
  currentLane = 1
  targetLanePosition = 0
  isJumping = false
  jumpVelocity = 0
  updateScoreDisplay()

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
  camera.position.set(0, 3, 5)
  camera.lookAt(0, 0, -10)

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

  // Create the raccoon character
  createRaccoon()
  raccoonDefaultY = raccoon.position.y

  // Generate initial obstacles and collectibles
  generateWorld()

  // Add event listeners
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('keydown', onKeyDown)
  restartButton.addEventListener('click', restartGame)

  // Start the game loop
  animate()
}

// Create the running path
function createPath() {
  const pathGeometry = new THREE.BoxGeometry(LANE_WIDTH * LANE_COUNT, 0.5, WORLD_DEPTH)
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }) // Brown color for the path
  path = new THREE.Mesh(pathGeometry, pathMaterial)
  path.position.y = -0.25
  path.position.z = -WORLD_DEPTH / 2
  path.receiveShadow = true
  scene.add(path)

  // Add grass on the sides
  const grassGeometry = new THREE.BoxGeometry(10, 0.5, WORLD_DEPTH)
  const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x7CFC00 }) // Light green for grass
  
  const leftGrass = new THREE.Mesh(grassGeometry, grassMaterial)
  leftGrass.position.x = -((LANE_WIDTH * LANE_COUNT) / 2 + 5)
  leftGrass.position.y = -0.25
  leftGrass.position.z = -WORLD_DEPTH / 2
  scene.add(leftGrass)
  
  const rightGrass = new THREE.Mesh(grassGeometry, grassMaterial)
  rightGrass.position.x = (LANE_WIDTH * LANE_COUNT) / 2 + 5
  rightGrass.position.y = -0.25
  rightGrass.position.z = -WORLD_DEPTH / 2
  scene.add(rightGrass)
}

// Create the raccoon character
function createRaccoon() {
  // For now, we'll use a simple placeholder for the raccoon
  raccoon = new THREE.Group()
  
  // Body
  const bodyGeometry = new THREE.BoxGeometry(0.8, 0.8, 1.2)
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
  body.position.y = 0.4
  body.castShadow = true
  raccoon.add(body)
  
  // Head
  const headGeometry = new THREE.SphereGeometry(0.5, 16, 16)
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
  const head = new THREE.Mesh(headGeometry, headMaterial)
  head.position.y = 1.1
  head.position.z = 0.3
  head.castShadow = true
  raccoon.add(head)
  
  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8)
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }) // Black color
  
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
  leftEye.position.set(-0.2, 1.2, 0.7)
  raccoon.add(leftEye)
  
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
  rightEye.position.set(0.2, 1.2, 0.7)
  raccoon.add(rightEye)
  
  // Nose
  const noseGeometry = new THREE.SphereGeometry(0.1, 8, 8)
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }) // Black color
  const nose = new THREE.Mesh(noseGeometry, noseMaterial)
  nose.position.set(0, 1.0, 0.8)
  raccoon.add(nose)
  
  // Ears
  const earGeometry = new THREE.ConeGeometry(0.2, 0.4, 16)
  const earMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
  
  const leftEar = new THREE.Mesh(earGeometry, earMaterial)
  leftEar.position.set(-0.3, 1.5, 0.3)
  leftEar.rotation.x = -Math.PI / 6
  raccoon.add(leftEar)
  
  const rightEar = new THREE.Mesh(earGeometry, earMaterial)
  rightEar.position.set(0.3, 1.5, 0.3)
  rightEar.rotation.x = -Math.PI / 6
  raccoon.add(rightEar)
  
  // Tail
  const tailGeometry = new THREE.CylinderGeometry(0.1, 0.2, 1, 8)
  const tailMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    side: THREE.DoubleSide
  })
  const tail = new THREE.Mesh(tailGeometry, tailMaterial)
  tail.position.set(0, 0.4, -0.8)
  tail.rotation.x = Math.PI / 2
  raccoon.add(tail)
  
  // Add raccoon to the scene
  raccoon.position.y = 0
  raccoon.position.z = 0
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
  for (let z = -10; z > -WORLD_DEPTH; z -= OBSTACLE_DISTANCE) {
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
  // Randomly choose obstacle type
  const obstacleType = Math.floor(Math.random() * 3)
  let obstacle: THREE.Mesh
  
  switch (obstacleType) {
    case 0: // Rock
      const rockGeometry = new THREE.SphereGeometry(0.7, 8, 8)
      const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }) // Gray color
      obstacle = new THREE.Mesh(rockGeometry, rockMaterial)
      obstacle.position.y = 0.3
      break
    case 1: // Tree stump
      const stumpGeometry = new THREE.CylinderGeometry(0.5, 0.7, 1, 8)
      const stumpMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }) // Brown color
      obstacle = new THREE.Mesh(stumpGeometry, stumpMaterial)
      obstacle.position.y = 0.5
      break
    case 2: // Barrel
      const barrelGeometry = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16)
      const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0xA52A2A }) // Brown color
      obstacle = new THREE.Mesh(barrelGeometry, barrelMaterial)
      obstacle.position.y = 0.6
      break
    default:
      const defaultGeometry = new THREE.BoxGeometry(1, 1, 1)
      const defaultMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 }) // Red color
      obstacle = new THREE.Mesh(defaultGeometry, defaultMaterial)
      obstacle.position.y = 0.5
  }
  
  // Position the obstacle
  const lanePosition = getLanePosition(lane)
  obstacle.position.x = lanePosition
  obstacle.position.z = z
  obstacle.castShadow = true
  obstacle.userData = { type: 'obstacle' }
  
  scene.add(obstacle)
  obstacles.push(obstacle)
}

// Create a collectible
function createCollectible(lane: number, z: number) {
  // Create a simple coin/acorn as a collectible
  const collectibleGeometry = new THREE.SphereGeometry(0.3, 16, 16)
  const collectibleMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xFFD700, // Gold color
    emissive: 0xFFD700,
    emissiveIntensity: 0.5
  })
  const collectible = new THREE.Mesh(collectibleGeometry, collectibleMaterial)
  
  // Position the collectible
  const lanePosition = getLanePosition(lane)
  collectible.position.x = lanePosition
  collectible.position.y = 0.8 // Slightly above the ground
  collectible.position.z = z
  collectible.userData = { type: 'collectible' }
  
  // Add a rotation animation
  collectible.userData.rotationSpeed = 0.05
  
  scene.add(collectible)
  collectibles.push(collectible)
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
  if (event.code === 'Space' && !isJumping) {
    jump()
  }
}

// Make the raccoon jump
function jump() {
  if (!isJumping) {
    isJumping = true
    jumpVelocity = JUMP_FORCE
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
  
  // Determine current lane
  currentLane = Math.round(raccoon.position.x / LANE_WIDTH) + 1
  
  // Update jump physics
  if (isJumping) {
    // Apply velocity to position
    raccoon.position.y += jumpVelocity
    
    // Apply gravity to velocity
    jumpVelocity -= GRAVITY
    
    // Check if raccoon has landed
    if (raccoon.position.y <= raccoonDefaultY) {
      raccoon.position.y = raccoonDefaultY
      isJumping = false
      jumpVelocity = 0
    }
  }
}

// Move obstacles and collectibles
function moveObjects() {
  // Move obstacles
  obstacles.forEach(obstacle => {
    obstacle.position.z += GAME_SPEED
    
    // Remove obstacles that are behind the camera
    if (obstacle.position.z > 5) {
      scene.remove(obstacle)
      obstacles = obstacles.filter(o => o !== obstacle)
    }
  })
  
  // Move collectibles
  collectibles.forEach(collectible => {
    collectible.position.z += GAME_SPEED
    
    // Rotate collectibles
    collectible.rotation.y += collectible.userData.rotationSpeed
    
    // Remove collectibles that are behind the camera
    if (collectible.position.z > 5) {
      scene.remove(collectible)
      collectibles = collectibles.filter(c => c !== collectible)
    }
  })
  
  // Generate new obstacles and collectibles if needed
  if (obstacles.length + collectibles.length < 20) {
    const lastZ = Math.min(
      ...obstacles.map(o => o.position.z),
      ...collectibles.map(c => c.position.z),
      -10
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
      
      // Increase score
      score += 10
      updateScoreDisplay()
    }
  }
}

// Update the score display
function updateScoreDisplay() {
  scoreDisplay.textContent = `Score: ${score}`
}

// Game over
function gameOver() {
  isGameOver = true
  finalScoreDisplay.textContent = `Your score: ${score}`
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
    // Update raccoon position
    updateRaccoonPosition()
    
    // Move obstacles and collectibles
    moveObjects()
    
    // Check for collisions
    checkCollisions()
    
    // Increment score
    score += 0.1
    if (Math.floor(score) % 10 === 0) {
      updateScoreDisplay()
    }
  }
  
  // Render the scene
  renderer.render(scene, camera)
}

// Start the game
init()
