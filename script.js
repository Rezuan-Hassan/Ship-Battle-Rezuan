const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 400;

// Load Images
const ship1 = new Image(); ship1.src = 'ship1.png';
const ship2 = new Image(); ship2.src = 'ship2.png';

// 1. PEER SETUP (Fixed for GitHub Pages / HTTPS)
const peer = new Peer(undefined, {
    host: '0.peerjs.com',
    port: 443,
    secure: true,
    debug: 3 // Level 3 shows all connection details in Console
});

let conn = null;
let isHost = false;

// Handle ID Generation
peer.on('open', (id) => {
    console.log("Peer ID Generated: " + id);
    document.getElementById('my-id').innerText = "YOUR ID: " + id;
});

// Handle Errors (Crucial for Debugging)
peer.on('error', (err) => {
    console.error("PeerJS Error Type: " + err.type);
    document.getElementById('my-id').innerText = "Error: " + err.type;
    if (err.type === 'browser-incompatible') {
        alert("Your browser does not support WebRTC!");
    }
});

// HOST Logic: Someone else connects to you
peer.on('connection', (connection) => {
    conn = connection;
    isHost = true;
    setupData();
    document.getElementById('lobby').style.display = 'none';
    requestAnimationFrame(update);
});

// GUEST Logic: You connect to someone else
function connectToFriend() {
    const friendID = document.getElementById('friend-id').value.trim();
    if (!friendID) return alert("Please paste an ID!");
    
    document.getElementById('my-id').innerText = "Connecting...";
    conn = peer.connect(friendID);
    isHost = false;

    conn.on('open', () => {
        setupData();
        document.getElementById('lobby').style.display = 'none';
        requestAnimationFrame(update);
    });
}

// 2. GAME STATE
let gameState = {
    round: 1,
    gameOver: false,
    winner: ""
};

let p1 = { x: 350, y: 50, shields: 6, health: 100, money: 0, score: 0 };
let p2 = { x: 350, y: 270, shields: 6, health: 100, money: 0, score: 0 };
let bullets = [];
let moveDir = 0;

// 3. NETWORK DATA HANDLING
function setupData() {
    conn.on('data', (d) => {
        if (isHost) {
            // Host processes Guest's inputs
            if (d.type === 'move') p2.x = Math.max(0, Math.min(700, p2.x + d.dx));
            if (d.type === 'fire') bullets.push({ x: p2.x + 50, y: p2.y, vy: -7 });
            if (d.type === 'shop') {
                if (d.item === 'repair' && p2.money >= 75) { p2.money -= 75; p2.health = Math.min(100, p2.health + 30); }
                if (d.item === 'ulti' && p2.money >= 250) { 
                    p2.money -= 250; 
                    bullets.push({x: p2.x+20, y: p2.y, vy: -7}, {x: p2.x+50, y: p2.y, vy: -7}, {x: p2.x+80, y: p2.y, vy: -7}); 
                }
            }
        } else {
            // Guest receives full game state from Host
            p1 = d.p1; p2 = d.p2; bullets = d.bullets; gameState = d.gameState;
            if(gameState.gameOver) showGameOver();
        }
    });

    conn.on('close', () => {
        alert("Opponent Disconnected!");
        location.reload();
    });
}

// 4. MAIN GAME LOOP
function update() {
    if (gameState.gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (isHost && conn && conn.open) {
        // Handle Host Movement
        p1.x = Math.max(0, Math.min(700, p1.x + moveDir));
        
        // Bullet Collision & Memory Management
        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            b.y += b.vy;
            let hit = false;

            // Hit P1 (Host) from P2's bullet
            if (b.vy < 0 && b.y < p1.y + 80 && b.x > p1.x && b.x < p1.x + 100) {
                p1.shields > 0 ? p1.shields-- : p1.health -= 10;
                p2.money += 25; 
                hit = true;
            }
            // Hit P2 (Guest) from P1's bullet
            else if (b.vy > 0 && b.y > p2.y && b.x > p2.x && b.x < p2.x + 100) {
                p2.shields > 0 ? p2.shields-- : p2.health -= 10;
                p1.money += 25; 
                hit = true;
            }

            if (hit || b.y < 0 || b.y > canvas.height) {
                bullets.splice(i, 1);
            }
        }

        // Win/Loss Condition
        if (p1.health <= 0 || p2.health <= 0) {
            if (p1.health <= 0) p2.score++;
            if (p2.health <= 0) p1.score++;
            
            gameState.round++;
            
            if (gameState.round > 8) {
                gameState.gameOver = true;
                gameState.winner = p1.score > p2.score ? "HOST WINS!" : (p2.score > p1.score ? "GUEST WINS!" : "DRAW!");
                showGameOver();
            } else {
                p1.health = 100; p2.health = 100;
                p1.shields = 6; p2.shields = 6;
                bullets = [];
            }
        }
        
        // Broadcast state to Guest
        conn.send({ p1, p2, bullets, gameState });
    } 
    else if (conn && conn.open && !isHost) {
        // Guest only sends movement if actually moving to save bandwidth
        if(moveDir !== 0) conn.send({ type: 'move', dx: moveDir });
    }

    drawGame();
    updateUI();
    
    if(!gameState.gameOver) {
        requestAnimationFrame(update);
    }
}

// 5. DRAWING
function drawGame() {
    // P1 (Top)
    ctx.save(); 
    ctx.translate(p1.x+50, p1.y+40); 
    ctx.rotate(Math.PI); 
    if(ship1.complete) ctx.drawImage(ship1, -50, -40, 100, 80);
    else { ctx.fillStyle = '#00f2ff'; ctx.fillRect(-50, -40, 100, 80); }
    ctx.restore();
    drawStatusBars(p1, false);

    // P2 (Bottom)
    if(ship2.complete) ctx.drawImage(ship2, p2.x, p2.y, 100, 80);
    else { ctx.fillStyle = '#ff4757'; ctx.fillRect(p2.x, p2.y, 100, 80); }
    drawStatusBars(p2, true);

    // Bullets
    ctx.fillStyle = '#ffff00';
    bullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 12));
}

function drawStatusBars(ship, isBottom) {
    let barY = isBottom ? ship.y + 85 : ship.y - 10;
    // Health Bar
    ctx.fillStyle = '#444'; ctx.fillRect(ship.x, barY, 100, 6);
    ctx.fillStyle = ship.health > 30 ? '#39ff14' : '#ff4757';
    ctx.fillRect(ship.x, barY, Math.max(0, ship.health), 6);
    
    // Shield Orbs
    ctx.fillStyle = '#00f2ff';
    for(let i=0; i < ship.shields; i++) {
        ctx.beginPath();
        ctx.arc(ship.x + 8 + (i * 16), isBottom ? ship.y - 15 : ship.y + 95, 4, 0, Math.PI*2);
        ctx.fill();
    }
}

function updateUI() {
    document.getElementById('p1-money').innerText = p1.money;
    document.getElementById('p2-money').innerText = p2.money;
    document.getElementById('p1-score').innerText = p1.score;
    document.getElementById('p2-score').innerText = p2.score;
    document.getElementById('round-display').innerText = gameState.round > 8 ? 8 : gameState.round;
}

function showGameOver() {
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('winner-text').innerText = gameState.winner;
    document.getElementById('score-text').innerText = `Host: ${p1.score} | Guest: ${p2.score}`;
}

// 6. SHOP
function buyRepair() {
    if (!conn || !conn.open) return;
    if (isHost && p1.money >= 75) { p1.money -= 75; p1.health = Math.min(100, p1.health + 30); }
    else if (!isHost) { conn.send({ type: 'shop', item: 'repair' }); }
}

function buyUlti() {
    if (!conn || !conn.open) return;
    if (isHost && p1.money >= 250) { 
        p1.money -= 250; 
        bullets.push({x: p1.x+20, y: p1.y+80, vy: 7}, {x: p1.x+50, y: p1.y+80, vy: 7}, {x: p1.x+80, y: p1.y+80, vy: 7}); 
    }
    else if (!isHost) { conn.send({ type: 'shop', item: 'ulti' }); }
}

// 7. INPUTS
const handleMove = (dir) => moveDir = dir;
const fireAction = () => {
    if (!conn || !conn.open || gameState.gameOver) return;
    if (isHost) bullets.push({ x: p1.x + 50, y: p1.y + 80, vy: 7 });
    else conn.send({ type: 'fire' });
};

// Touch/Mouse Controls
const lBtn = document.getElementById('left-btn');
const rBtn = document.getElementById('right-btn');
const fBtn = document.getElementById('fire-btn');

lBtn.onmousedown = lBtn.ontouchstart = (e) => { e.preventDefault(); handleMove(-7); };
rBtn.onmousedown = rBtn.ontouchstart = (e) => { e.preventDefault(); handleMove(7); };
fBtn.onmousedown = fBtn.ontouchstart = (e) => { e.preventDefault(); fireAction(); };

window.onmouseup = window.ontouchend = (e) => { handleMove(0); };

// Keyboard Support
window.onkeydown = (e) => {
    if(e.key === 'ArrowLeft' || e.key === 'a') handleMove(-7);
    if(e.key === 'ArrowRight' || e.key === 'd') handleMove(7);
    if(e.key === ' ' || e.key === 'Enter') fireAction();
};
window.onkeyup = (e) => {
    if(['a','d','ArrowLeft','ArrowRight'].includes(e.key)) handleMove(0);
};
