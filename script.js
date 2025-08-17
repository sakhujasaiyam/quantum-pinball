class GateCloudGame {
    constructor() {
        this.gameState = 'stopped'; // stopped, running, paused
        this.level = 1;
        this.targetState = '|1⟩'; // Current level target
        this.qubits = []; // Array of qubit objects
        this.dustbin = { gates: [], count: 0 };
        this.fallingGates = []; // Array of currently falling gates
        this.gateQueue = ['X', 'H', 'Z', 'Y', 'X', 'H']; // Gates to drop
        this.currentGateIndex = 0;
        this.gameSpeed = 1; // Speed multiplier
        this.lastGateTime = 0;
        this.gateDropInterval = 2000; // ms between gate drops
        
        // Emitter settings
        this.emitter1 = { angle: 0, power: 1, active: false };
        this.emitter2 = { angle: 0, power: 1, active: false };
        
        // Physics constants
        this.gravity = 0.3;
        this.deflectionForce = 5;
        this.deflectorRadius = 75;
        
        this.initializeGame();
        this.setupEventListeners();
    }

    initializeGame() {
        // Initialize single qubit for level 1
        this.qubits = [{
            id: 'qubit1',
            state: '|0⟩',
            gates: [],
            element: document.getElementById('qubit1')
        }];
        
        this.updateQubitDisplay();
        this.updateGameStatus('Ready to start!');
    }

    setupEventListeners() {
        // Game control buttons
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('pauseButton').addEventListener('click', () => this.pauseGame());
        document.getElementById('resetButton').addEventListener('click', () => this.resetGame());
        document.getElementById('checkButton').addEventListener('click', () => this.checkTargetState());
        
        // Emitter angle controls
        document.getElementById('angleSlider1').addEventListener('input', (e) => {
            this.emitter1.angle = parseInt(e.target.value);
            this.updateEmitterDisplay(1);
        });
        
        document.getElementById('angleSlider2').addEventListener('input', (e) => {
            this.emitter2.angle = parseInt(e.target.value);
            this.updateEmitterDisplay(2);
        });
        
        // Mouse controls for emitter activation
        document.addEventListener('mousedown', (e) => this.activateEmitter(e));
        document.addEventListener('mouseup', (e) => this.deactivateEmitter(e));
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    startGame() {
        if (this.gameState === 'stopped') {
            this.gameState = 'running';
            this.lastGateTime = Date.now();
            document.getElementById('startButton').disabled = true;
            document.getElementById('pauseButton').disabled = false;
            this.updateGameStatus('Game started! Gates incoming...');
            this.gameLoop();
        } else if (this.gameState === 'paused') {
            this.gameState = 'running';
            document.getElementById('startButton').disabled = true;
            document.getElementById('pauseButton').disabled = false;
            this.updateGameStatus('Game resumed!');
            this.gameLoop();
        }
    }

    pauseGame() {
        if (this.gameState === 'running') {
            this.gameState = 'paused';
            document.getElementById('startButton').disabled = false;
            document.getElementById('pauseButton').disabled = true;
            this.updateGameStatus('Game paused');
        }
    }

    resetGame() {
        this.gameState = 'stopped';
        this.currentGateIndex = 0;
        this.fallingGates.forEach(gate => gate.element.remove());
        this.fallingGates = [];
        this.dustbin.gates = [];
        this.dustbin.count = 0;
        
        // Reset qubits
        this.qubits.forEach(qubit => {
            qubit.gates = [];
            qubit.state = '|0⟩';
        });
        
        this.updateQubitDisplay();
        this.updateDustbinDisplay();
        this.updateGameStatus('Game reset - Ready to start!');
        
        document.getElementById('startButton').disabled = false;
        document.getElementById('pauseButton').disabled = true;
    }

    gameLoop() {
        if (this.gameState !== 'running') return;
        
        const currentTime = Date.now();
        
        // Drop new gates
        if (currentTime - this.lastGateTime > this.gateDropInterval && 
            this.currentGateIndex < this.gateQueue.length) {
            this.dropGate();
            this.lastGateTime = currentTime;
        }
        
        // Update falling gates
        this.updateFallingGates();
        
        // Continue game loop
        requestAnimationFrame(() => this.gameLoop());
    }

    dropGate() {
        if (this.currentGateIndex >= this.gateQueue.length) return;
        
        const gateType = this.gateQueue[this.currentGateIndex];
        this.currentGateIndex++;
        
        // Create gate element
        const gateElement = document.createElement('div');
        gateElement.className = 'falling-gate';
        gateElement.textContent = gateType;
        
        // Random horizontal position in gate cloud area
        const cloudCenter = window.innerWidth / 2;
        const randomOffset = (Math.random() - 0.5) * 200;
        const startX = cloudCenter + randomOffset - 20; // -20 for half gate width
        
        gateElement.style.left = startX + 'px';
        gateElement.style.top = '120px'; // Below gate cloud
        
        document.getElementById('gameArea').appendChild(gateElement);
        
        // Create gate object
        const gate = {
            element: gateElement,
            type: gateType,
            x: startX,
            y: 120,
            vx: 0, // horizontal velocity
            vy: 0, // vertical velocity
            deflected: false
        };
        
        this.fallingGates.push(gate);
        
        // Update game status
        this.updateGameStatus(`Gate ${gateType} dropped! (${this.currentGateIndex}/${this.gateQueue.length})`);
    }

    updateFallingGates() {
        const gameArea = document.getElementById('gameArea');
        const gameRect = gameArea.getBoundingClientRect();
        
        this.fallingGates.forEach((gate, index) => {
            // Apply gravity
            gate.vy += this.gravity;
            
            // Check deflector collision
            this.checkDeflectorCollision(gate);
            
            // Check emitter effects
            this.applyEmitterForces(gate);
            
            // Update position
            gate.x += gate.vx;
            gate.y += gate.vy;
            
            // Update visual position
            gate.element.style.left = gate.x + 'px';
            gate.element.style.top = gate.y + 'px';
            
            // Check if gate reached bottom
            if (gate.y > gameRect.height - 220) { // Above control panel
                this.handleGateLanding(gate, index);
            }
        });
    }

    checkDeflectorCollision(gate) {
        const deflectorX = window.innerWidth / 2;
        const deflectorY = window.innerHeight / 2;
        
        const dx = gate.x + 20 - deflectorX; // +20 for gate center
        const dy = gate.y + 12.5 - deflectorY; // +12.5 for gate center
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.deflectorRadius + 20 && !gate.deflected) {
            // Calculate deflection
            const deflectionAngle = Math.atan2(dy, dx);
            gate.vx = Math.cos(deflectionAngle) * this.deflectionForce;
            gate.vy = Math.sin(deflectionAngle) * this.deflectionForce;
            
            // Visual feedback
            gate.element.classList.add('deflected');
            gate.deflected = true;
            
            // Add deflection effect
            this.createDeflectionEffect(gate.x + 20, gate.y + 12.5);
        }
    }

    applyEmitterForces(gate) {
        if (this.emitter1.active) {
            this.applyEmitterForce(gate, 1);
        }
        if (this.emitter2.active) {
            this.applyEmitterForce(gate, 2);
        }
    }

    applyEmitterForce(gate, emitterNum) {
        const emitter = emitterNum === 1 ? this.emitter1 : this.emitter2;
        const emitterX = emitterNum === 1 ? 120 : window.innerWidth - 120;
        const emitterY = window.innerHeight - 100;
        
        // Calculate distance and angle
        const dx = gate.x + 20 - emitterX;
        const dy = gate.y + 12.5 - emitterY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Apply force if within range
        if (distance < 200) {
            const forceStrength = (200 - distance) / 200 * 0.5 * emitter.power;
            const angleRad = (emitter.angle * Math.PI) / 180;
            
            // Direction based on emitter angle
            const forceX = Math.sin(angleRad) * forceStrength;
            const forceY = -Math.cos(angleRad) * forceStrength;
            
            gate.vx += forceX;
            gate.vy += forceY;
        }
    }

    handleGateLanding(gate, index) {
        const gateX = gate.x + 20; // Gate center
        
        // Check which area the gate landed in
        let landedIn = null;
        
        // Check qubits
        this.qubits.forEach(qubit => {
            const qubitElement = qubit.element;
            const rect = qubitElement.getBoundingClientRect();
            const gameAreaRect = document.getElementById('gameArea').getBoundingClientRect();
            
            const qubitLeft = rect.left - gameAreaRect.left;
            const qubitRight = rect.right - gameAreaRect.left;
            
            if (gateX >= qubitLeft && gateX <= qubitRight) {
                landedIn = qubit;
            }
        });
        
        // Check dustbin
        const dustbinElement = document.getElementById('dustbin');
        const dustbinRect = dustbinElement.getBoundingClientRect();
        const gameAreaRect = document.getElementById('gameArea').getBoundingClientRect();
        const dustbinLeft = dustbinRect.left - gameAreaRect.left;
        const dustbinRight = dustbinRect.right - gameAreaRect.left;
        
        if (gateX >= dustbinLeft && gateX <= dustbinRight) {
            landedIn = 'dustbin';
        }
        
        // Handle landing
        if (landedIn && landedIn !== 'dustbin') {
            // Gate landed on qubit
            landedIn.gates.push(gate.type);
            this.updateQubitState(landedIn);
            this.updateGameStatus(`Gate ${gate.type} applied to ${landedIn.id.toUpperCase()}!`);
        } else if (landedIn === 'dustbin') {
            // Gate landed in dustbin
            this.dustbin.gates.push(gate.type);
            this.dustbin.count++;
            this.updateDustbinDisplay();
            this.updateGameStatus(`Gate ${gate.type} disposed in dustbin.`);
        } else {
            // Gate missed everything
            this.updateGameStatus(`Gate ${gate.type} missed all targets!`);
        }
        
        // Remove gate from game
        gate.element.remove();
        this.fallingGates.splice(index, 1);
        
        // Check if all gates have been processed
        if (this.currentGateIndex >= this.gateQueue.length && this.fallingGates.length === 0) {
            this.endGame();
        }
    }

    updateQubitState(qubit) {
        // Simple quantum state calculation
        let state = 0; // Start with |0⟩
        
        qubit.gates.forEach(gateType => {
            switch(gateType) {
                case 'H': // Hadamard - creates superposition
                    state = state === 0 ? 0.5 : (state === 1 ? 0.5 : state);
                    break;
                case 'X': // Pauli-X - bit flip
                    state = state === 0 ? 1 : (state === 1 ? 0 : 1 - state);
                    break;
                case 'Y': // Pauli-Y - bit and phase flip
                    state = state === 0 ? 1 : (state === 1 ? 0 : 1 - state);
                    break;
                case 'Z': // Pauli-Z - phase flip (doesn't change computational basis)
                    // In computational basis, Z doesn't change |0⟩ or |1⟩
                    break;
            }
        });
        
        // Update visual state
        if (state === 0) {
            qubit.state = '|0⟩';
        } else if (state === 1) {
            qubit.state = '|1⟩';
        } else {
            qubit.state = '|+⟩'; // Superposition
        }
        
        this.updateQubitDisplay();
    }

    updateQubitDisplay() {
        this.qubits.forEach(qubit => {
            const stateElement = document.getElementById(`qubitState${qubit.id.slice(-1)}`);
            const gatesElement = document.getElementById(`qubitGates${qubit.id.slice(-1)}`);
            
            stateElement.textContent = qubit.state;
            
            // Clear and rebuild gates display
            gatesElement.innerHTML = '';
            qubit.gates.forEach(gateType => {
                const gateDiv = document.createElement('div');
                gateDiv.className = 'gate-in-qubit';
                gateDiv.textContent = gateType;
                gatesElement.appendChild(gateDiv);
            });
        });
    }

    updateDustbinDisplay() {
        const countElement = document.getElementById('dustbinCount');
        countElement.textContent = this.dustbin.count;
    }

    updateEmitterDisplay(emitterNum) {
        const angleDisplay = document.getElementById(`angleDisplay${emitterNum}`);
        const emitterBody = document.getElementById(`emitter${emitterNum}`).querySelector('.emitter-body');
        const angle = emitterNum === 1 ? this.emitter1.angle : this.emitter2.angle;
        
        angleDisplay.textContent = `${angle}°`;
        emitterBody.style.transform = `rotate(${angle}deg)`;
    }

    activateEmitter(e) {
        const emitter1Element = document.getElementById('emitter1');
        const emitter2Element = document.getElementById('emitter2');
        
        if (emitter1Element.contains(e.target) || e.target.closest('#emitter1')) {
            this.emitter1.active = true;
            document.getElementById('beam1').classList.add('active');
        }
        
        if (emitter2Element.contains(e.target) || e.target.closest('#emitter2')) {
            this.emitter2.active = true;
            document.getElementById('beam2').classList.add('active');
        }
    }

    deactivateEmitter(e) {
        this.emitter1.active = false;
        this.emitter2.active = false;
        document.getElementById('beam1').classList.remove('active');
        document.getElementById('beam2').classList.remove('active');
    }

    handleKeyPress(e) {
        switch(e.key) {
            case ' ': // Spacebar - start/pause
                e.preventDefault();
                if (this.gameState === 'stopped' || this.gameState === 'paused') {
                    this.startGame();
                } else {
                    this.pauseGame();
                }
                break;
            case 'r': // R - reset
            case 'R':
                this.resetGame();
                break;
            case 'c': // C - check
            case 'C':
                this.checkTargetState();
                break;
        }
    }

    checkTargetState() {
        let allCorrect = true;
        let message = 'State Check:\n';
        
        this.qubits.forEach((qubit, index) => {
            message += `${qubit.id.toUpperCase()}: ${qubit.state}\n`;
            
            // For level 1, target is |1⟩
            if (qubit.state !== '|1⟩') {
                allCorrect = false;
            }
        });
        
        if (allCorrect) {
            message += '\n✅ TARGET STATE ACHIEVED!';
            this.updateGameStatus('🎉 Level Complete! Target state achieved!');
            
            // Add celebration effect
            this.createCelebrationEffect();
        } else {
            message += `\n❌ Target: ${this.targetState}`;
            this.updateGameStatus('Target state not yet achieved. Keep trying!');
        }
        
        alert(message);
    }

    createDeflectionEffect(x, y) {
        const effect = document.createElement('div');
        effect.style.position = 'absolute';
        effect.style.left = x + 'px';
        effect.style.top = y + 'px';
        effect.style.width = '20px';
        effect.style.height = '20px';
        effect.style.background = 'radial-gradient(circle, #ffff00, transparent)';
        effect.style.borderRadius = '50%';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '999';
        effect.style.animation = 'deflectionBurst 0.5s ease-out forwards';
        
        document.getElementById('gameArea').appendChild(effect);
        
        setTimeout(() => {
            effect.remove();
        }, 500);
    }

    createCelebrationEffect() {
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const spark = document.createElement('div');
                spark.style.position = 'absolute';
                spark.style.left = (Math.random() * window.innerWidth) + 'px';
                spark.style.top = (Math.random() * window.innerHeight) + 'px';
                spark.style.width = '10px';
                spark.style.height = '10px';
                spark.style.background = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'][Math.floor(Math.random() * 4)];
                spark.style.borderRadius = '50%';
                spark.style.pointerEvents = 'none';
                spark.style.zIndex = '1001';
                spark.style.animation = 'sparkle 2s ease-out forwards';
                
                document.body.appendChild(spark);
                
                setTimeout(() => {
                    spark.remove();
                }, 2000);
            }, i * 100);
        }
    }

    updateGameStatus(message) {
        const statusElement = document.getElementById('gameStatus');
        statusElement.textContent = message;
        
        // Auto-hide status after 3 seconds
        setTimeout(() => {
            if (statusElement.textContent === message) {
                statusElement.textContent = '';
            }
        }, 3000);
    }

    endGame() {
        this.gameState = 'stopped';
        document.getElementById('startButton').disabled = false;
        document.getElementById('pauseButton').disabled = true;
        this.updateGameStatus('All gates processed! Check your result.');
    }
}

// Add CSS animations for effects
const style = document.createElement('style');
style.textContent = `
    @keyframes deflectionBurst {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(3); opacity: 0; }
    }
    
    @keyframes sparkle {
        0% { transform: scale(1) translateY(0); opacity: 1; }
        50% { transform: scale(1.5) translateY(-50px); opacity: 0.8; }
        100% { transform: scale(0) translateY(-100px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new GateCloudGame();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.game) {
        window.game.updateEmitterDisplay(1);
        window.game.updateEmitterDisplay(2);
    }
});
