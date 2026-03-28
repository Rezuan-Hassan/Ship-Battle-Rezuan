const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 400;

// 1. NETWORKING SETUP
const peer = new Peer(); 
let conn, isHost = false;
let myMoney = 0, currentRound = 1;

peer.on('open', (id) => document.getElementById('my-id').innerText = "Your ID: " + id);
peer.on('connection', (c) => { conn = c; isHost = true; initGame(); });

function connectToFriend() {
    const id = document.getElementById('friend-id').value;
    conn = peer.connect(id);
    isHost = false;
    initGame();
}

function initGame() {
    document.getElementById('lobby').style.display = 'none';
    setupNetworking();
    update();
}

// 2. GAME OBJECTS
let p1 = { x: 100, y: 180, shields: 6, health: 100 };
let p2 = { x: 650, y: 180, shields: 6, health: 100 };
let bullets = [];

function setupNetworking() {
    conn.on('data', (data) => {
        if (isHost) {
            if (data.type === 'fire') spawnBullet(p2.x, p2.y + 40, -8);
            if (data.type === 'repair') p2.shields = Math.min(6, p2.shields + 2);
        } else {
            // Guest updates view based on Host data
            p1 = data.p1; p2 = data.p2; bullets = data.bullets;
            myMoney = data.moneyP2; currentRound = data.round;
            syncUI();
        }
    });
}

// 3. CORE LOGIC (HOST ONLY)
function spawnBullet(x, y, vx) { bullets.push({ x, y, vx }); }

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isHost && conn) {
        bullets.forEach((b, bi) => {
            b.x += b.vx;
            // Collision P2 (Guest)
            if (b.x > p2.x && b.x < p2.x + 50 && b.y > p2.y && b.y < p2.y + 80) {
                bullets.splice(bi, 1);
                if (p2.shields > 0) { p2.shields--; myMoney += 25; } 
                else { p2.health -= 10; }
            }
            // Collision P1 (Host)
            if (b.x < p1.x + 50 && b.x > p1.x && b.y > p1.y && b.y < p1.y + 80) {
                bullets.splice(bi, 1);
                if (p1.shields > 0) { p1.shields--; /* Guest Money sync would go here */ } 
                else { p1.health -= 10; }
            }
        });

        if (p1.health <= 0 || p2.health <= 0) {
            currentRound++;
            p1.health = 100; p2.health = 100; p1.shields = 6; p2.shields = 6;
            myMoney += 150; // Round bonus
        }
        conn.send({ p1, p2, bullets, moneyP2: 0, round: currentRound });
    }

    drawShip(p1, 'blue');
    drawShip(p2, 'red');
    
    ctx.fillStyle = 'yellow';
    bullets.forEach(b => ctx.fillRect(b.x, b.y, 15, 4));

    syncUI();
    requestAnimationFrame(update);
}

// 4. DRAWING & UI
function drawShip(p, color) {
    // Ship Body
    ctx.fillStyle = color;
    ctx.fillRect(p.x, p.y, 50, 80);
    
    // Health Bar
    ctx.fillStyle = 'gray'; ctx.fillRect(p.x - 10, p.y - 20, 70, 6);
    ctx.fillStyle = '#00ff00'; ctx.fillRect(p.x - 10, p.y - 20, (p.health/100)*70, 6);
    
    // 6 Shields (Dots)
    ctx.fillStyle = 'gold';
    for(let i=0; i<p.shields; i++) {
        let row = i < 3 ? 0 : 1;
        ctx.beginPath();
        ctx.arc(p.x + (i%3 * 18) + 7, p.y - 35 - (row * 10), 5, 0, Math.PI*2);
        ctx.fill();
    }
}

function syncUI() {
    document.getElementById('money-display').innerText = myMoney;
    document.getElementById('round-display').innerText = currentRound;
}

// Input
document.getElementById('fire-btn').ontouchstart = (e) => {
    e.preventDefault();
    if (isHost) spawnBullet(p1.x + 50, p1.y + 40, 8);
    else conn.send({ type: 'fire' });
};

function buyRepair() {
    if (myMoney >= 75) {
        myMoney -= 75;
        if (isHost) p1.shields = Math.min(6, p1.shields + 2);
        else conn.send({ type: 'repair' });
    }
}