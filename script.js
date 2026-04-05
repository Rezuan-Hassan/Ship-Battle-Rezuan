const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 400;

// Fallback drawing if images fail to load
const ship1 = new Image(); ship1.src = 'ship1.png';
const ship2 = new Image(); ship2.src = 'ship2.png';

// 1. PEER SETUP
const peer = new Peer(); 
let conn = null;
let isHost = false;

peer.on('open', (id) => {
    document.getElementById('my-id').innerText = "Your ID: " + id;
});

peer.on('error', (err) => {
    console.error(err);
    alert("Connection Error: " + err.type + ". Check if the ID is correct!");
});

// HOST Logic
peer.on('connection', (connection) => {
    conn = connection;
    isHost = true;
    setupData();
    document.getElementById('lobby').style.display = 'none';
    requestAnimationFrame(update);
});

// GUEST Logic
function connectToFriend() {
    const friendID = document.getElementById('friend-id').value.trim();
    if (!friendID) return alert("Please paste an ID!");
    
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
            // Guest receives full state from host
            p1 = d.p1; p2 = d.p2; bullets = d.bullets; gameState = d.gameState;
            
            if(gameState.gameOver) showGameOver();
        }
    });
}

// 4. MAIN GAME LOOP
function update() {
    if (gameState.gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // HOST computes logic
    if (isHost && conn && conn.open) {
        p1.x = Math.max(0, Math.min(700, p1.x + moveDir));
        
        // Reverse iterate to safely remove off-screen or hit bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            let b = bullets[i];
            b.y += b.vy;
            let hit = false;

            // Hit P1 (Host)
            if (b.vy < 0 && b.y < p1.y + 80 && b.x > p1.x && b.x < p1.x + 100) {
                p1.shields > 0 ? p1.shields-- : p1.health -= 10;
                p2.money += 25; // Reward P2
                hit = true;
            }
            // Hit P2 (Guest)
            else if (b.vy > 0 && b.y > p2.y && b.x > p2.x && b.x < p2.x + 100) {
                p2.shields > 0 ? p2.shields-- : p2.health -= 10;
                p1.money += 25; // Reward P1
                hit = true;
            }

            // Clean up bullet
            if (hit || b.y < 0 || b.y > canvas.height) {
                bullets.splice(i, 1);
            }
        }

        // Round Logic Fix
        if (p1.health <= 0 || p2.health <= 0) {
            if (p1.health <= 0) p2.score++;
            if (p2.health <= 0) p1.score++;
            
            gameState.round++;
            
            if (gameState.round > 8) {
                gameState.gameOver = true;
                gameState.winner = p1.score > p2.score ? "HOST WINS!" : (p2.score > p1.score ? "GUEST WINS!" : "DRAW!");
                showGameOver();
            } else {
                // Reset round stats
                p1.health = 100; p2.health = 100;
                p1.shields = 6; p2.shields = 6;
                bullets = [];
            }
        }
        
        // Sync to Guest
        conn.send({ p1, p2, bullets, gameState });
    } 
    // GUEST sends inputs
    else if (conn && conn.open && !isHost && moveDir !== 0) {
        conn.send({ type: 'move', dx: moveDir });
    }

    drawGame();
    updateUI();
    
    if(!gameState.gameOver) {
        requestAnimationFrame(update);
    }
}

// 5. DRAWING ROUTINE
function drawGame() {
    // Draw P1 (Top / Host)
    ctx.save(); 
    ctx.translate(p1.x+50, p1.y+40); 
    ctx.rotate(Math.PI); 
    if(ship1.complete && ship1.naturalHeight !== 0) ctx.drawImage(ship1, -50, -40, 100, 80);
    else { ctx.fillStyle = 'blue'; ctx.fillRect(-50, -40, 100, 80); } // Fallback
    ctx.restore();
    drawBars(p1, false);

    // Draw P2 (Bottom / Guest)
    if(ship2.complete && ship2.naturalHeight !== 0) ctx.drawImage(ship2, p2.x, p2.y, 100, 80);
    else { ctx.fillStyle = 'red'; ctx.fillRect(p2.x, p2.y, 100, 80); } // Fallback
    drawBars(p2, true);

    // Draw Bullets
    ctx.fillStyle = '#ffbd2e'; 
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'yellow';
    bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, 6, 15);
    });
    ctx.shadowBlur = 0; // reset
}

function drawBars(ship, isBottom) {
    let barY = isBottom ? ship.y + 90 : ship.y - 15;
    // Health
    ctx.fillStyle = '#ff4757'; ctx.fillRect(ship.x, barY, 100, 5);
    ctx.fillStyle = '#27c93f'; ctx.fillRect(ship.x, barY, Math.max(0, ship.health), 5);
    // Shields
    ctx.fillStyle = 'rgba(0, 242, 255, 0.8)';
    for(let i=0; i<ship.shields; i++) {
        ctx.beginPath();
        ctx.arc(ship.x + 10 + (i*16), isBottom ? ship.y - 10 : ship.y + 90, 4, 0, Math.PI*2);
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

// 6. SHOP LOGIC
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

// 7. INPUTS (Mouse, Touch, and Keyboard)
const handleMove = (dir) => moveDir = dir;
const fireLogic = () => {
    if (!conn || !conn.open || gameState.gameOver) return;
    if (isHost) bullets.push({ x: p1.x + 47, y: p1.y + 80, vy: 7 });
    else conn.send({ type: 'fire' });
};

// Touch & Mouse
const btnL = document.getElementById('left-btn');
const btnR = document.getElementById('right-btn');
const btnF = document.getElementById('fire-btn');

btnL.onmousedown = btnL.ontouchstart = (e) => { e.preventDefault(); handleMove(-6); };
btnR.onmousedown = btnR.ontouchstart = (e) => { e.preventDefault(); handleMove(6); };
window.onmouseup = window.ontouchend = () => handleMove(0);

btnF.onmousedown = btnF.ontouchstart = (e) => { e.preventDefault(); fireLogic(); };

// Keyboard (For PC Testing)
window.onkeydown = (e) => {
    if(e.key === 'ArrowLeft' || e.key === 'a') handleMove(-6);
    if(e.key === 'ArrowRight' || e.key === 'd') handleMove(6);
    if(e.key === ' ' || e.key === 'Enter') fireLogic();
};
window.onkeyup = (e) => {
    if(['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(e.key)) handleMove(0);
};
